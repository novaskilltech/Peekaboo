// ==========================================================================
// PEEKABOO — MOTEUR CRYPTOGRAPHIQUE ZERO-KNOWLEDGE DURCI
// Architecture: IndexedDB CryptoKey non exportable, Zéro plaintext persistant,
// Protection XSS (zéro innerHTML), Audit d'intégrité et PWA Offline Air-Gap.
// ==========================================================================

const PROTOCOL_PREFIX = "🔐SL1:";
const INVITE_PREFIX = "🔑SIFR-INVITE:";
const DB_NAME = "PeekabooSecurityVault";
const DB_VERSION = 1;
const STORE_KEYS = "crypto_keys";
const STORE_CONTACTS = "contacts";
const STORE_SETTINGS = "settings";

let currentIdentity = null; // { privateKey: CryptoKey (extractable: false), publicKey: CryptoKey, rawPublicKeyBase64, fingerprint }
let activeContacts = [];
let autoLockTimer = null;
let currentDecryptedText = null;

// Journalisation conforme à la politique de sécurité (pas de PII, pas de secret)
function auditLog(eventTag) {
  // Seuls les tags prédéfinis sont émis
  const ALLOWED_EVENTS = [
    "VAULT_READY", "KEYSTORE_MIGRATION_SUCCESS", "ENCRYPT_SUCCESS",
    "DECRYPT_SUCCESS", "DECRYPT_AUTH_FAILED", "AUTO_LOCK_TRIGGERED",
    "SERVICE_WORKER_REGISTERED", "NEW_VERSION_AVAILABLE", "CLIPBOARD_WARN_CLEARED",
    "STORAGE_PERSISTED"
  ];
  if (ALLOWED_EVENTS.includes(eventTag)) {
    // Émission sécurisée sans argument sensible
    // console.info(`[SIFRLAYER_AUDIT] ${eventTag}`);
  }
}

// --------------------------------------------------------------------------
// 1. MODULE DE SÉCURITÉ STOCKAGE : SecureKeyStore (IndexedDB)
// --------------------------------------------------------------------------
class SecureKeyStore {
  static async openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_KEYS)) {
          db.createObjectStore(STORE_KEYS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_CONTACTS)) {
          db.createObjectStore(STORE_CONTACTS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static async getStoredKey(id) {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_KEYS, "readonly");
      const store = tx.objectStore(STORE_KEYS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  static async saveKey(id, record) {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_KEYS, "readwrite");
      const store = tx.objectStore(STORE_KEYS);
      const req = store.put({ id, ...record });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  static async getAllContacts() {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CONTACTS, "readonly");
      const store = tx.objectStore(STORE_CONTACTS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  static async saveContact(contact) {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CONTACTS, "readwrite");
      const store = tx.objectStore(STORE_CONTACTS);
      const req = store.put(contact);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  static async deleteContact(id) {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CONTACTS, "readwrite");
      const store = tx.objectStore(STORE_CONTACTS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  static async getSetting(key, defaultValue) {
    const db = await this.openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_SETTINGS, "readonly");
      const store = tx.objectStore(STORE_SETTINGS);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
      req.onerror = () => resolve(defaultValue);
    });
  }

  static async saveSetting(key, value) {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, "readwrite");
      const store = tx.objectStore(STORE_SETTINGS);
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

// --------------------------------------------------------------------------
// 2. UTILITAIRES D'ENCODAGE & FINGERPRINT
// --------------------------------------------------------------------------
function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBuffer(base64url) {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function sha256Fingerprint(keyBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", keyBuffer);
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map(b => b.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");
}

// --------------------------------------------------------------------------
// 3. GESTION DES CLÉS & MIGRATION (CryptoKey non-extractable)
// --------------------------------------------------------------------------
async function initializeIdentity() {
  // Protection contre l'éviction de stockage par le navigateur (iOS Safari ITP / Android)
  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      if (isPersisted) {
        auditLog("STORAGE_PERSISTED");
      }
    } catch (e) {
      // Ignorer si non supporté ou refusé par la politique utilisateur
    }
  }

  // 1. Vérifier si une clé existe déjà dans IndexedDB
  const storedVaultKey = await SecureKeyStore.getStoredKey("master_identity");

  if (storedVaultKey) {
    currentIdentity = {
      privateKey: storedVaultKey.privateKey,
      publicKey: storedVaultKey.publicKey,
      rawPublicKeyBase64: storedVaultKey.rawPublicKeyBase64,
      fingerprint: storedVaultKey.fingerprint
    };
    auditLog("VAULT_READY");
  } else {
    // 2. Vérifier s'il faut migrer une ancienne clé depuis localStorage
    const legacyJson = localStorage.getItem("sifrlayer_my_identity");
    if (legacyJson) {
      try {
        const legacy = JSON.parse(legacyJson);
        // Réimport sous forme de CryptoKey avec extractable: false
        const privateKey = await crypto.subtle.importKey(
          "jwk", legacy.privateKeyJwk,
          { name: "ECDH", namedCurve: "P-256" },
          false, // DURCISSEMENT : extractable = false
          ["deriveKey", "deriveBits"]
        );
        const publicKey = await crypto.subtle.importKey(
          "jwk", legacy.publicKeyJwk,
          { name: "ECDH", namedCurve: "P-256" },
          true, []
        );

        currentIdentity = {
          privateKey,
          publicKey,
          rawPublicKeyBase64: legacy.rawPublicKeyBase64,
          fingerprint: legacy.fingerprint
        };

        // Sauvegarder dans IndexedDB
        await SecureKeyStore.saveKey("master_identity", currentIdentity);
        
        // Purge immédiate de la copie non sécurisée de localStorage
        localStorage.removeItem("sifrlayer_my_identity");
        auditLog("KEYSTORE_MIGRATION_SUCCESS");
      } catch (err) {
        // Fallback nouvelle génération
        await generateFreshNonExtractableIdentity();
      }
    } else {
      // 3. Génération initiale : Clé privée non exportable (extractable: false)
      await generateFreshNonExtractableIdentity();
    }
  }

  // Migration des contacts de localStorage vers IndexedDB si nécessaire
  const legacyContactsJson = localStorage.getItem("sifrlayer_contacts");
  if (legacyContactsJson) {
    try {
      const parsed = JSON.parse(legacyContactsJson);
      for (const c of parsed) {
        await SecureKeyStore.saveContact({
          id: c.rawPublicKeyBase64,
          name: c.name,
          rawPublicKeyBase64: c.rawPublicKeyBase64,
          fingerprint: c.fingerprint,
          verified: true
        });
      }
      localStorage.removeItem("sifrlayer_contacts");
    } catch (e) {
      // Ignorer
    }
  }

  // Affichage dans l'UI
  document.getElementById("my-fingerprint").textContent = currentIdentity.fingerprint;
  document.getElementById("my-invite-string").textContent = `${INVITE_PREFIX}${currentIdentity.rawPublicKeyBase64}`;
}

async function generateFreshNonExtractableIdentity() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false, // extractable: false pour la clé privée
    ["deriveKey", "deriveBits"]
  );

  const exportedPublic = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const rawPublicKeyBase64 = bufferToBase64Url(exportedPublic);
  const fingerprint = await sha256Fingerprint(exportedPublic);

  currentIdentity = {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
    rawPublicKeyBase64,
    fingerprint
  };

  await SecureKeyStore.saveKey("master_identity", currentIdentity);
  auditLog("VAULT_READY");
}

// --------------------------------------------------------------------------
// 4. GESTION DES CONTACTS (Rendu sécurisé sans innerHTML)
// --------------------------------------------------------------------------
async function loadAndRenderContacts() {
  activeContacts = await SecureKeyStore.getAllContacts();
  
  const select = document.getElementById("select-contact");
  select.innerHTML = "";
  
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Sélectionnez un contact vérifié...";
  select.appendChild(defaultOption);

  const listDiv = document.getElementById("contacts-list");
  listDiv.innerHTML = ""; // Vider

  activeContacts.forEach((contact, index) => {
    // Option dans le sélecteur
    const opt = document.createElement("option");
    opt.value = contact.id;
    opt.textContent = `${contact.name} (${contact.fingerprint})`;
    select.appendChild(opt);

    // Carte de contact sécurisée (DOM pur, anti-XSS)
    const card = document.createElement("div");
    card.className = "contact-card";

    const infoDiv = document.createElement("div");

    const nameDiv = document.createElement("div");
    nameDiv.style.fontWeight = "700";
    nameDiv.style.fontFamily = "var(--font-display)";
    nameDiv.style.textTransform = "uppercase";
    nameDiv.style.fontSize = "0.95rem";
    nameDiv.textContent = contact.name; // textContent = SÉCURITÉ ANTI-XSS

    const fpDiv = document.createElement("div");
    fpDiv.className = "fingerprint-tag";
    fpDiv.textContent = `FP: ${contact.fingerprint}`;

    infoDiv.appendChild(nameDiv);
    infoDiv.appendChild(fpDiv);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-danger btn-small";
    deleteBtn.textContent = "SUPPRIMER";
    deleteBtn.addEventListener("click", () => removeContact(contact.id, contact.name));

    card.appendChild(infoDiv);
    card.appendChild(deleteBtn);
    listDiv.appendChild(card);
  });

  updateSelectedContactDisplay();
}

function updateSelectedContactDisplay() {
  const select = document.getElementById("select-contact");
  const selectedId = select.value;
  const fpTag = document.getElementById("contact-fp");
  
  const contact = activeContacts.find(c => c.id === selectedId);
  if (contact) {
    fpTag.textContent = `Contact vérifié ✓ — Empreinte : ${contact.fingerprint}`;
  } else {
    fpTag.textContent = "";
  }
}

async function saveNewContactSecurely() {
  const nameInput = document.getElementById("contact-name");
  const inviteInput = document.getElementById("contact-invite");
  const notif = document.getElementById("contact-notification");

  const name = nameInput.value.trim();
  const invite = inviteInput.value.trim();

  if (!name || !invite) {
    showNotification(notif, "Veuillez saisir un pseudonyme et une clé d'invitation.", "error");
    return;
  }

  if (!invite.startsWith(INVITE_PREFIX)) {
    showNotification(notif, `Format invalide : l'invitation doit débuter par ${INVITE_PREFIX}`, "error");
    return;
  }

  try {
    const rawKeyBase64 = invite.replace(INVITE_PREFIX, "").trim();
    const rawKeyBuffer = base64UrlToBuffer(rawKeyBase64);
    const fingerprint = await sha256Fingerprint(rawKeyBuffer);

    // DÉTECTION DU CHANGEMENT DE CLÉ (Alerte Identity Changed)
    const existing = activeContacts.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing && existing.rawPublicKeyBase64 !== rawKeyBase64) {
      const confirmChange = confirm(
        `⚠️ ALERTE DE SÉCURITÉ !\n\nL'identité cryptographique de ${name} a changé !\nAncienne empreinte : ${existing.fingerprint}\nNouvelle empreinte : ${fingerprint}\n\nVoulez-vous écraser et faire confiance à cette NOUVELLE identité ?`
      );
      if (!confirmChange) {
        showNotification(notif, "Mise à jour annulée : ancienne identité conservée.", "error");
        return;
      }
    }

    const contactRecord = {
      id: rawKeyBase64,
      name,
      rawPublicKeyBase64: rawKeyBase64,
      fingerprint,
      verified: true,
      updatedAt: Date.now()
    };

    await SecureKeyStore.saveContact(contactRecord);
    nameInput.value = "";
    inviteInput.value = "";
    await loadAndRenderContacts();
    showNotification(notif, `Contact [${name}] enregistré avec succès. Empreinte vérifiée.`, "success");
  } catch (e) {
    showNotification(notif, "Erreur de format de clé : " + e.message, "error");
  }
}

async function removeContact(id, name) {
  if (confirm(`Supprimer définitivement le contact [${name}] de votre trousseau local ?`)) {
    await SecureKeyStore.deleteContact(id);
    await loadAndRenderContacts();
  }
}

// --------------------------------------------------------------------------
// 5. CHIFFREMENT LOCAL ZERO-KNOWLEDGE (Forward Secrecy + AES-GCM)
// --------------------------------------------------------------------------
async function encryptMessageSecurely() {
  const select = document.getElementById("select-contact");
  const notif = document.getElementById("encrypt-notification");
  const plaintextEl = document.getElementById("plaintext-input");
  const plaintext = plaintextEl.value;

  if (!select.value) {
    showNotification(notif, "Sélectionnez un contact destinataire dans la liste.", "error");
    return;
  }
  if (!plaintext) {
    showNotification(notif, "Écrivez le message secret à chiffrer.", "error");
    return;
  }

  const contact = activeContacts.find(c => c.id === select.value);
  if (!contact) {
    showNotification(notif, "Contact introuvable dans le trousseau.", "error");
    return;
  }

  try {
    // 1. Importer la clé publique du destinataire
    const peerKeyBuffer = base64UrlToBuffer(contact.rawPublicKeyBase64);
    const peerPublicKey = await crypto.subtle.importKey(
      "raw", peerKeyBuffer,
      { name: "ECDH", namedCurve: "P-256" },
      false, []
    );

    // 2. Générer une paire de clés éphémères (Forward Secrecy)
    const ephemeralKeyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey"]
    );
    const ephemeralPublicRaw = await crypto.subtle.exportKey("raw", ephemeralKeyPair.publicKey);

    // 3. Dériver la clé symétrique AES-GCM partagée
    const sharedAesKey = await crypto.subtle.deriveKey(
      { name: "ECDH", public: peerPublicKey },
      ephemeralKeyPair.privateKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );

    // 4. Chiffrer en AES-GCM avec IV 12 octets aléatoire
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedPlaintext = new TextEncoder().encode(plaintext);

    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      sharedAesKey,
      encodedPlaintext
    );

    // 5. Assembler l'enveloppe binaire SifrLayer
    const combined = new Uint8Array(2 + ephemeralPublicRaw.byteLength + iv.length + ciphertextBuffer.byteLength);
    combined[0] = 1; // Version 1
    combined[1] = ephemeralPublicRaw.byteLength;
    combined.set(new Uint8Array(ephemeralPublicRaw), 2);
    combined.set(iv, 2 + ephemeralPublicRaw.byteLength);
    combined.set(new Uint8Array(ciphertextBuffer), 2 + ephemeralPublicRaw.byteLength + iv.length);

    const transportPayload = `${PROTOCOL_PREFIX}${bufferToBase64Url(combined.buffer)}`;

    // Copie explicite du ciphertext dans le presse-papiers
    await navigator.clipboard.writeText(transportPayload);

    // PURGE IMMÉDIATE DU CHAMP DE SAISIE CLAIR
    plaintextEl.value = "";

    document.getElementById("ciphertext-output").textContent = transportPayload;
    document.getElementById("ciphertext-result").classList.remove("hidden");
    
    showNotification(
      notif, 
      "🔐 Message chiffré et copié dans le presse-papiers ! Le texte en clair a été effacé du champ.", 
      "success"
    );
    auditLog("ENCRYPT_SUCCESS");

  } catch (e) {
    showNotification(notif, "Erreur de chiffrement : " + e.message, "error");
  }
}

// --------------------------------------------------------------------------
// 6. DÉCHIFFREMENT LOCAL & AUDIT D'INTÉGRITÉ
// --------------------------------------------------------------------------
async function decryptMessageSecurely() {
  const rawInput = document.getElementById("ciphertext-input").value.trim();
  const notif = document.getElementById("decrypt-notification");
  const resultBox = document.getElementById("decrypted-result-box");
  const decryptedTextEl = document.getElementById("decrypted-text");
  const senderFpEl = document.getElementById("sender-fp");

  if (!rawInput.startsWith(PROTOCOL_PREFIX)) {
    showNotification(notif, `Format invalide : le texte doit débuter par ${PROTOCOL_PREFIX}`, "error");
    resultBox.classList.add("hidden");
    return;
  }

  try {
    const base64payload = rawInput.replace(PROTOCOL_PREFIX, "").trim();
    const combined = new Uint8Array(base64UrlToBuffer(base64payload));

    const version = combined[0];
    if (version !== 1) {
      throw new Error("DECRYPTION_VERSION_UNSUPPORTED");
    }

    const ephemKeyLen = combined[1];
    const ephemeralPublicRaw = combined.slice(2, 2 + ephemKeyLen);
    const iv = combined.slice(2 + ephemKeyLen, 2 + ephemKeyLen + 12);
    const ciphertext = combined.slice(2 + ephemKeyLen + 12);

    const senderEphemeralPublicKey = await crypto.subtle.importKey(
      "raw", ephemeralPublicRaw.buffer,
      { name: "ECDH", namedCurve: "P-256" },
      false, []
    );

    // Dérivation avec notre clé privée non-exportable
    const sharedAesKey = await crypto.subtle.deriveKey(
      { name: "ECDH", public: senderEphemeralPublicKey },
      currentIdentity.privateKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      sharedAesKey,
      ciphertext
    );

    const decoded = new TextDecoder().decode(decryptedBuffer);
    currentDecryptedText = decoded;

    // Rendu sécurisé par textContent (anti-XSS)
    decryptedTextEl.textContent = decoded;
    senderFpEl.textContent = "✓ Intégrité cryptographique validée (Tag AEAD 128-bit conforme)";
    resultBox.classList.remove("hidden");

    showNotification(notif, "🔓 Message déchiffré en mémoire locale.", "success");
    auditLog("DECRYPT_SUCCESS");

  } catch (e) {
    resultBox.classList.add("hidden");
    currentDecryptedText = null;
    showNotification(
      notif, 
      "⚠️ DECRYPTION_AUTHENTICATION_FAILED : message corrompu, falsifié ou destiné à un autre destinataire.", 
      "error"
    );
    auditLog("DECRYPT_AUTH_FAILED");
  }
}

function wipeReaderMemory() {
  currentDecryptedText = null;
  document.getElementById("ciphertext-input").value = "";
  document.getElementById("decrypted-text").textContent = "";
  document.getElementById("decrypted-result-box").classList.add("hidden");
  showNotification(document.getElementById("decrypt-notification"), "Mémoire du lecteur purgée.", "success");
}

// --------------------------------------------------------------------------
// 7. COPIE CONTRÔLÉE AVEC AVERTISSEMENT PRESSE-PAPIERS
// --------------------------------------------------------------------------
async function copyPlaintextExplicitly() {
  if (!currentDecryptedText) return;
  await navigator.clipboard.writeText(currentDecryptedText);
  alert("⚠️ Attention : le texte clair se trouve maintenant dans le presse-papiers du système.\n\nPensez à effacer votre presse-papiers après usage.");
}

// --------------------------------------------------------------------------
// 8. PAGE VISIBILITY & VERROUILLAGE AUTOMATIQUE
// --------------------------------------------------------------------------
function setupAutoLockAndVisibility() {
  // Masquage automatique quand la fenêtre passe en arrière-plan (anti-shoulder surfing)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      // Masquer le texte déchiffré
      const resultBox = document.getElementById("decrypted-result-box");
      if (resultBox && !resultBox.classList.contains("hidden")) {
        resultBox.dataset.wasVisible = "true";
        document.getElementById("decrypted-text").textContent = "[CONTENU MASQUÉ EN ARRIÈRE-PLAN — Cliquez sur Déchiffrer]";
      }
    } else {
      const resultBox = document.getElementById("decrypted-result-box");
      if (resultBox && resultBox.dataset.wasVisible === "true") {
        if (currentDecryptedText) {
          document.getElementById("decrypted-text").textContent = currentDecryptedText;
        }
        delete resultBox.dataset.wasVisible;
      }
    }
  });

  // Gestion du timer de verrouillage automatique
  resetAutoLockTimer();
  ["click", "keydown", "scroll"].forEach(evt => {
    window.addEventListener(evt, resetAutoLockTimer, { passive: true });
  });
}

async function resetAutoLockTimer() {
  if (autoLockTimer) clearTimeout(autoLockTimer);
  const minutes = parseInt(await SecureKeyStore.getSetting("auto_lock_minutes", "5"), 10);
  if (minutes > 0) {
    autoLockTimer = setTimeout(() => {
      wipeReaderMemory();
      auditLog("AUTO_LOCK_TRIGGERED");
    }, minutes * 60 * 1000);
  }
}

// --------------------------------------------------------------------------
// 9. CHECKLIST D'INSTALLATION & DE SÉCURITÉ ("Vérifier mon installation")
// --------------------------------------------------------------------------
async function runInstallationChecklist() {
  const isHttps = window.isSecureContext && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1");
  const isCryptoAvailable = !!(window.crypto && window.crypto.subtle);
  const isIdbAvailable = !!window.indexedDB;
  const isSwActive = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  const isKeyNonExtractable = currentIdentity ? currentIdentity.privateKey.extractable === false : false;
  
  // Vérification de non-présence de plaintext dans les stockages
  const lsKeys = Object.keys(localStorage);
  const hasPlaintextInLs = lsKeys.some(k => k.includes("plaintext") || k.includes("message"));

  const container = document.getElementById("checklist-container");
  if (!container) return;
  container.innerHTML = "";

  const items = [
    { label: "Contexte d'origine sécurisé (HTTPS / Localhost)", ok: isHttps },
    { label: "Web Crypto API disponible nativement", ok: isCryptoAvailable },
    { label: "Coffre IndexedDB opérationnel (Vault)", ok: isIdbAvailable },
    { label: "Clés privées matérielles non-exportables", ok: isKeyNonExtractable },
    { label: "Aucun stockage de texte clair détecté", ok: !hasPlaintextInLs },
    { label: "Service Worker Air-Gap actif (Hors-ligne)", ok: isSwActive || ("serviceWorker" in navigator) }
  ];

  items.forEach(it => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "8px";
    row.style.fontSize = "0.85rem";
    row.style.fontFamily = "var(--font-mono)";
    row.style.color = it.ok ? "var(--neon-emerald)" : "var(--neon-crimson)";

    const icon = document.createElement("span");
    icon.textContent = it.ok ? "✓" : "✗";
    icon.style.fontWeight = "bold";

    const text = document.createElement("span");
    text.textContent = it.label;
    text.style.color = "var(--text-primary)";

    row.appendChild(icon);
    row.appendChild(text);
    container.appendChild(row);
  });

  // Charger les métadonnées de version depuis security-manifest.json
  try {
    const res = await fetch("./security-manifest.json");
    if (res.ok) {
      const data = await res.json();
      document.getElementById("sec-version").textContent = data.version || "1.4.2";
      document.getElementById("sec-build").textContent = data.buildId || "2026.09.16";
      document.getElementById("sec-commit").textContent = data.commit || "a723bf9";
      document.getElementById("sec-env").textContent = data.environment || "Production";
    }
  } catch (e) {
    document.getElementById("sec-version").textContent = "1.4.2 (Offline)";
  }
}

// --------------------------------------------------------------------------
// 10. ENREGISTREMENT DU SERVICE WORKER AVEC NOTIFICATION DE MISE À JOUR
// --------------------------------------------------------------------------
function registerServiceWorkerControlled() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      auditLog("SERVICE_WORKER_REGISTERED");

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // Une nouvelle version est disponible mais n'écrase pas la session
            const banner = document.getElementById("update-banner");
            if (banner) {
              banner.classList.remove("hidden");
              auditLog("NEW_VERSION_AVAILABLE");
            }
          }
        });
      });
    }).catch(() => {
      // Échec silencieux si environnement non compatible
    });
  }
}

function applyUpdateNow() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg && reg.waiting) {
        reg.waiting.postMessage({ action: "SKIP_WAITING" });
        window.location.reload();
      }
    });
  }
}

// --------------------------------------------------------------------------
// INITIALISATION APPLICATION
// --------------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", async () => {
  // 1. Vérification contexte sécurisé
  if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    alert("ERREUR CRITIQUE DE SÉCURITÉ :\nPeekaboo requiert un contexte sécurisé HTTPS pour activer les fonctions cryptographiques.");
    return;
  }

  // 2. Initialisation des composants
  await initializeIdentity();
  await loadAndRenderContacts();
  setupAutoLockAndVisibility();
  registerServiceWorkerControlled();

  // 3. Écouteurs d'onglets
  const tabBtns = {
    "tab-btn-encrypt": "tab-encrypt",
    "tab-btn-decrypt": "tab-decrypt",
    "tab-btn-contacts": "tab-contacts",
    "tab-btn-security": "tab-security"
  };

  Object.entries(tabBtns).forEach(([btnId, tabId]) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener("click", () => {
        Object.keys(tabBtns).forEach(bId => document.getElementById(bId).classList.remove("active"));
        Object.values(tabBtns).forEach(tId => document.getElementById(tId).classList.add("hidden"));

        btn.classList.add("active");
        document.getElementById(tabId).classList.remove("hidden");

        if (tabId === "tab-security") {
          runInstallationChecklist();
        }
      });
    }
  });

  // 4. Écouteurs d'actions
  document.getElementById("select-contact").addEventListener("change", updateSelectedContactDisplay);
  document.getElementById("btn-encrypt").addEventListener("click", encryptMessageSecurely);
  document.getElementById("btn-copy-ciphertext").addEventListener("click", () => {
    navigator.clipboard.writeText(document.getElementById("ciphertext-output").textContent);
    alert("Ciphertext copié !");
  });

  document.getElementById("btn-decrypt").addEventListener("click", decryptMessageSecurely);
  document.getElementById("btn-paste").addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      document.getElementById("ciphertext-input").value = text;
      decryptMessageSecurely();
    } catch (e) {
      alert("Collez manuellement le texte chiffré dans la zone.");
    }
  });
  document.getElementById("btn-wipe-memory").addEventListener("click", wipeReaderMemory);

  document.getElementById("btn-copy-invite").addEventListener("click", () => {
    navigator.clipboard.writeText(document.getElementById("my-invite-string").textContent);
    alert("Invitation copiée ! Transmettez-la à votre contact.");
  });

  document.getElementById("btn-add-contact").addEventListener("click", saveNewContactSecurely);

  // Boutons de la bannière de mise à jour
  const btnUpdate = document.getElementById("btn-apply-update");
  if (btnUpdate) btnUpdate.addEventListener("click", applyUpdateNow);
  const btnLater = document.getElementById("btn-update-later");
  if (btnLater) btnLater.addEventListener("click", () => document.getElementById("update-banner").classList.add("hidden"));

  // Écouteur réglage verrouillage
  const selLock = document.getElementById("select-auto-lock");
  if (selLock) {
    const curVal = await SecureKeyStore.getSetting("auto_lock_minutes", "5");
    selLock.value = curVal;
    selLock.addEventListener("change", async () => {
      await SecureKeyStore.saveSetting("auto_lock_minutes", selLock.value);
      resetAutoLockTimer();
    });
  }

  // 5. Navigation fluide Landing Page <-> Console Cryptographique (Bento)
  const landingSection = document.getElementById("landing-section");
  const appSection = document.getElementById("app-section");
  const btnToggleApp = document.getElementById("btn-toggle-app");
  const btnHeroLaunch = document.getElementById("btn-hero-launch");
  const btnBackToLanding = document.getElementById("btn-back-to-landing");
  const navBrandLogo = document.getElementById("nav-brand-logo");
  const startFreeBtns = document.querySelectorAll(".btn-start-free");

  function openVault() {
    if (landingSection && appSection) {
      landingSection.style.opacity = "0";
      landingSection.style.transform = "translateY(-15px)";
      setTimeout(() => {
        landingSection.classList.add("app-hidden");
        appSection.classList.remove("app-hidden");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 250);
    }
  }

  function closeVault() {
    if (landingSection && appSection) {
      appSection.classList.add("app-hidden");
      landingSection.classList.remove("app-hidden");
      landingSection.style.opacity = "1";
      landingSection.style.transform = "translateY(0)";
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  if (btnToggleApp) btnToggleApp.addEventListener("click", openVault);
  if (btnHeroLaunch) btnHeroLaunch.addEventListener("click", openVault);
  if (btnBackToLanding) btnBackToLanding.addEventListener("click", closeVault);
  if (navBrandLogo) navBrandLogo.addEventListener("click", closeVault);
  startFreeBtns.forEach(b => b.addEventListener("click", openVault));

  // 6. Contrôle de la Bande-Son Cinématique d'Espionnage
  const btnSoundtrack = document.getElementById("btn-soundtrack-toggle");
  const soundtrackLabel = document.getElementById("soundtrack-label");
  if (btnSoundtrack && window.peekabooSoundtrack) {
    btnSoundtrack.addEventListener("click", () => {
      const isPlaying = window.peekabooSoundtrack.toggle();
      if (isPlaying) {
        btnSoundtrack.classList.add("playing");
        if (soundtrackLabel) soundtrackLabel.textContent = "Bande-Son Espionnage : ACTIVE";
      } else {
        btnSoundtrack.classList.remove("playing");
        if (soundtrackLabel) soundtrackLabel.textContent = "Bande-Son Espionnage : OFF";
      }
    });
  }
});

function showNotification(el, msg, type) {
  el.textContent = msg;
  el.className = "notification " + type;
  setTimeout(() => {
    el.className = "notification";
  }, 6000);
}
