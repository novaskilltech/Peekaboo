import os

HTML_CONTENT = """<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SifrLayer — Messagerie Zero-Knowledge</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <span class="brand-icon">🔐</span>
        <div>
          <h1>SifrLayer Web</h1>
          <div class="helper-text">Messagerie Zero-Knowledge (Zero-Server / 100% Hors-ligne)</div>
        </div>
      </div>
      <span class="badge-offline">Mode Avion OK</span>
    </header>

    <div class="tabs">
      <button class="tab-btn active" id="tab-btn-encrypt">✍️ Écrire & Chiffrer</button>
      <button class="tab-btn" id="tab-btn-decrypt">🔓 Lire & Déchiffrer</button>
      <button class="tab-btn" id="tab-btn-contacts">👥 Identités & Contacts</button>
    </div>

    <!-- ONGLET 1 : CHIFFREMENT -->
    <div id="tab-encrypt" class="card">
      <div class="card-title">
        <span>Rédaction sécurisée</span>
        <span class="sub-badge">Protocole SifrLayer v1</span>
      </div>

      <div class="form-group">
        <label for="select-contact">Destinataire vérifié :</label>
        <select id="select-contact">
          <option value="">Sélectionnez un contact...</option>
        </select>
        <div id="contact-fp" class="fingerprint-tag"></div>
      </div>

      <div class="form-group">
        <label for="plaintext-input">Votre message secret (ne transite jamais en clair) :</label>
        <textarea id="plaintext-input" placeholder="Écrivez votre message privé ici..."></textarea>
      </div>

      <button class="btn" id="btn-encrypt">
        <span>🔐</span> Chiffrer et Copier le message
      </button>

      <div id="encrypt-notification" class="notification"></div>

      <div id="ciphertext-result" class="hidden">
        <div class="form-group margin-top">
          <label>Texte chiffré prêt à coller dans WhatsApp / Telegram :</label>
          <div id="ciphertext-output" class="output-box"></div>
        </div>
        <button class="btn btn-secondary" id="btn-copy-ciphertext">📋 Re-copier le texte chiffré</button>
      </div>
    </div>

    <!-- ONGLET 2 : DÉCHIFFREMENT -->
    <div id="tab-decrypt" class="card hidden">
      <div class="card-title">
        <span>Lecteur sécurisé</span>
        <button class="btn-danger btn-small" id="btn-wipe-memory">🧹 Effacer la mémoire</button>
      </div>

      <div class="form-group">
        <label for="ciphertext-input">Collez le message reçu (🔐SL1:...) :</label>
        <textarea id="ciphertext-input" placeholder="Collez ici le message chiffré provenant de WhatsApp ou Telegram..."></textarea>
      </div>

      <div class="row-btn">
        <button class="btn" id="btn-decrypt">
          <span>🔓</span> Déchiffrer le message
        </button>
        <button class="btn btn-secondary btn-auto" id="btn-paste">
          📋 Coller
        </button>
      </div>

      <div id="decrypt-notification" class="notification"></div>

      <div id="decrypted-result-box" class="hidden">
        <div class="form-group margin-top">
          <label>Message déchiffré en mémoire locale :</label>
          <div id="decrypted-text" class="decrypted-box"></div>
          <div id="sender-fp" class="fingerprint-tag"></div>
        </div>
      </div>
    </div>

    <!-- ONGLET 3 : CONTACTS & MON IDENTITÉ -->
    <div id="tab-contacts" class="card hidden">
      <div class="card-title">Mon Identité Cryptographique</div>
      
      <div class="identity-box">
        <div>
          <label>Mon empreinte publique de sécurité :</label>
          <div id="my-fingerprint" class="my-fp-text">Génération...</div>
        </div>
        <div>
          <label>Mon invitation sécurisée (à envoyer à votre contact) :</label>
          <div id="my-invite-string" class="output-box selectable"></div>
        </div>
        <button class="btn btn-secondary" id="btn-copy-invite">📋 Copier mon invitation</button>
      </div>

      <div class="card-title margin-top-large">Ajouter un contact sécurisé</div>
      <div class="form-group">
        <label for="contact-name">Nom ou Pseudonyme du contact :</label>
        <input type="text" id="contact-name" placeholder="Ex: Mohammed, Sarah...">
      </div>

      <div class="form-group">
        <label for="contact-invite">Invitation reçue du contact (🔑SIFR-INVITE:...) :</label>
        <textarea id="contact-invite" placeholder="Collez l'invitation reçue de votre correspondant..." class="textarea-small"></textarea>
      </div>

      <button class="btn" id="btn-add-contact">
        <span>👥</span> Valider et Ajouter le contact
      </button>

      <div id="contact-notification" class="notification"></div>

      <div class="card-title margin-top-large">Mes contacts enregistrés</div>
      <div id="contacts-list" class="contacts-container"></div>
    </div>

  </div>

  <script src="app.js"></script>
</body>
</html>
"""

CSS_CONTENT = """
:root {
  --bg-dark: #0f172a;
  --card-bg: #1e293b;
  --card-border: #334155;
  --accent-green: #10b981;
  --accent-green-hover: #059669;
  --accent-blue: #3b82f6;
  --accent-red: #ef4444;
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: var(--font);
}

body {
  background-color: var(--bg-dark);
  color: var(--text-main);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
}

.container {
  width: 100%;
  max-width: 680px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--card-border);
  padding-bottom: 16px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-icon {
  font-size: 1.8rem;
}

.brand h1 {
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.badge-offline {
  background-color: rgba(16, 185, 129, 0.15);
  color: var(--accent-green);
  font-size: 0.75rem;
  padding: 4px 10px;
  border-radius: 9999px;
  font-weight: 600;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.card {
  background-color: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
}

.card-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sub-badge {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: normal;
}

.tabs {
  display: flex;
  gap: 8px;
  background-color: rgba(0,0,0,0.2);
  padding: 4px;
  border-radius: 8px;
}

.tab-btn {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: 10px 12px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background-color: var(--card-bg);
  color: var(--text-main);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

label {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-weight: 500;
}

textarea, input, select {
  background-color: #0f172a;
  border: 1px solid var(--card-border);
  color: var(--text-main);
  padding: 12px;
  border-radius: 8px;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s;
}

textarea:focus, input:focus, select:focus {
  border-color: var(--accent-blue);
}

textarea {
  resize: vertical;
  min-height: 110px;
}

.textarea-small {
  min-height: 70px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background-color: var(--accent-green);
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.95rem;
  transition: background-color 0.2s;
  width: 100%;
}

.btn:hover {
  background-color: var(--accent-green-hover);
}

.btn-secondary {
  background-color: #334155;
}
.btn-secondary:hover {
  background-color: #475569;
}

.btn-danger {
  background-color: rgba(239, 68, 68, 0.2);
  color: var(--accent-red);
  border: 1px solid rgba(239, 68, 68, 0.4);
}
.btn-danger:hover {
  background-color: rgba(239, 68, 68, 0.3);
}

.btn-small {
  padding: 4px 10px;
  font-size: 0.75rem;
  border-radius: 4px;
  width: auto;
}

.btn-auto {
  width: auto;
}

.row-btn {
  display: flex;
  gap: 10px;
}

.output-box {
  background-color: #090d16;
  border: 1px dashed var(--card-border);
  border-radius: 8px;
  padding: 14px;
  margin-top: 6px;
  word-break: break-all;
  font-family: monospace;
  font-size: 0.85rem;
  color: #38bdf8;
  user-select: all;
}

.decrypted-box {
  background-color: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #a7f3d0;
  font-family: var(--font);
  font-size: 1.05rem;
  padding: 16px;
  border-radius: 8px;
  margin-top: 6px;
  white-space: pre-wrap;
}

.fingerprint-tag {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: monospace;
  margin-top: 4px;
}

.notification {
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 0.85rem;
  margin-top: 12px;
  display: none;
}

.notification.success {
  background-color: rgba(16, 185, 129, 0.2);
  border: 1px solid var(--accent-green);
  color: #a7f3d0;
  display: block;
}

.notification.error {
  background-color: rgba(239, 68, 68, 0.2);
  border: 1px solid var(--accent-red);
  color: #fca5a5;
  display: block;
}

.identity-box {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #090d16;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--card-border);
}

.my-fp-text {
  font-family: monospace;
  font-size: 1.1rem;
  color: var(--accent-green);
  font-weight: bold;
  margin-top: 4px;
}

.contacts-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.helper-text {
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.4;
  margin-top: 4px;
}

.hidden {
  display: none !important;
}

.margin-top {
  margin-top: 14px;
}

.margin-top-large {
  margin-top: 24px;
}
"""

APP_JS_CONTENT = """// SifrLayer Web - Client Cryptographique Zero-Knowledge
const PROTOCOL_PREFIX = "🔐SL1:";
const INVITE_PREFIX = "🔑SIFR-INVITE:";
const STORAGE_KEY_IDENTITY = "sifrlayer_my_identity";
const STORAGE_KEY_CONTACTS = "sifrlayer_contacts";

let myIdentity = null;
let contacts = [];

function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
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
  const hex = Array.from(new Uint8Array(digest).slice(0, 8))
    .map(b => b.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");
  return hex;
}

async function initIdentity() {
  const stored = localStorage.getItem(STORAGE_KEY_IDENTITY);
  if (stored) {
    const parsed = JSON.parse(stored);
    const privateKey = await crypto.subtle.importKey(
      "jwk", parsed.privateKeyJwk,
      { name: "ECDH", namedCurve: "P-256" },
      false, ["deriveKey", "deriveBits"]
    );
    const publicKey = await crypto.subtle.importKey(
      "jwk", parsed.publicKeyJwk,
      { name: "ECDH", namedCurve: "P-256" },
      true, []
    );
    myIdentity = {
      privateKey,
      publicKey,
      publicKeyJwk: parsed.publicKeyJwk,
      rawPublicKeyBase64: parsed.rawPublicKeyBase64,
      fingerprint: parsed.fingerprint
    };
  } else {
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey", "deriveBits"]
    );
    const exportedPublic = await crypto.subtle.exportKey("raw", keyPair.publicKey);
    const rawPublicKeyBase64 = bufferToBase64Url(exportedPublic);
    const fingerprint = await sha256Fingerprint(exportedPublic);
    const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
    const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);

    myIdentity = {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      publicKeyJwk,
      rawPublicKeyBase64,
      fingerprint
    };

    localStorage.setItem(STORAGE_KEY_IDENTITY, JSON.stringify({
      privateKeyJwk,
      publicKeyJwk,
      rawPublicKeyBase64,
      fingerprint
    }));
  }

  document.getElementById("my-fingerprint").textContent = myIdentity.fingerprint;
  document.getElementById("my-invite-string").textContent = `${INVITE_PREFIX}${myIdentity.rawPublicKeyBase64}`;
}

function loadContacts() {
  const stored = localStorage.getItem(STORAGE_KEY_CONTACTS);
  contacts = stored ? JSON.parse(stored) : [];
  renderContacts();
}

function renderContacts() {
  const select = document.getElementById("select-contact");
  select.innerHTML = '<option value="">Sélectionnez un contact...</option>';
  const listDiv = document.getElementById("contacts-list");
  listDiv.innerHTML = "";

  contacts.forEach((c, index) => {
    const opt = document.createElement("option");
    opt.value = index;
    opt.textContent = `${c.name} (${c.fingerprint})`;
    select.appendChild(opt);

    const card = document.createElement("div");
    card.style.display = "flex";
    card.style.justifyContent = "space-between";
    card.style.alignItems = "center";
    card.style.background = "#090d16";
    card.style.padding = "10px 14px";
    card.style.borderRadius = "6px";
    card.style.border = "1px solid var(--card-border)";
    card.innerHTML = `
      <div>
        <div style="font-weight: 600;">${c.name}</div>
        <div class="fingerprint-tag">Empreinte : ${c.fingerprint}</div>
      </div>
      <button class="btn-danger btn-small" onclick="deleteContact(${index})">Supprimer</button>
    `;
    listDiv.appendChild(card);
  });
  updateSelectedContact();
}

function updateSelectedContact() {
  const select = document.getElementById("select-contact");
  const idx = select.value;
  const fpDiv = document.getElementById("contact-fp");
  if (idx !== "" && contacts[idx]) {
    fpDiv.textContent = `Empreinte de vérification : ${contacts[idx].fingerprint}`;
  } else {
    fpDiv.textContent = "";
  }
}

async function saveNewContact() {
  const name = document.getElementById("contact-name").value.trim();
  const invite = document.getElementById("contact-invite").value.trim();
  const notif = document.getElementById("contact-notification");

  if (!name || !invite) {
    showNotification(notif, "Veuillez saisir un nom et une invitation.", "error");
    return;
  }

  if (!invite.startsWith(INVITE_PREFIX)) {
    showNotification(notif, "Format d'invitation invalide (doit commencer par " + INVITE_PREFIX + ")", "error");
    return;
  }

  try {
    const rawKeyBase64 = invite.replace(INVITE_PREFIX, "").trim();
    const rawKeyBuffer = base64UrlToBuffer(rawKeyBase64);
    const fingerprint = await sha256Fingerprint(rawKeyBuffer);

    contacts.push({
      name,
      rawPublicKeyBase64: rawKeyBase64,
      fingerprint
    });

    localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(contacts));
    document.getElementById("contact-name").value = "";
    document.getElementById("contact-invite").value = "";
    renderContacts();
    showNotification(notif, `Contact ${name} ajouté avec succès !`, "success");
  } catch (e) {
    showNotification(notif, "Erreur lors de l'importation de la clé : " + e.message, "error");
  }
}

function deleteContact(idx) {
  if (confirm(`Supprimer le contact ${contacts[idx].name} ?`)) {
    contacts.splice(idx, 1);
    localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(contacts));
    renderContacts();
  }
}

async function encryptAndCopyMessage() {
  const select = document.getElementById("select-contact");
  const notif = document.getElementById("encrypt-notification");
  const plaintext = document.getElementById("plaintext-input").value;

  if (select.value === "") {
    showNotification(notif, "Veuillez sélectionner un destinataire.", "error");
    return;
  }
  if (!plaintext) {
    showNotification(notif, "Veuillez saisir un texte à chiffrer.", "error");
    return;
  }

  const contact = contacts[select.value];

  try {
    const contactPublicKeyBuffer = base64UrlToBuffer(contact.rawPublicKeyBase64);
    const peerPublicKey = await crypto.subtle.importKey(
      "raw", contactPublicKeyBuffer,
      { name: "ECDH", namedCurve: "P-256" },
      false, []
    );

    const ephemeralKeyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey"]
    );
    const ephemeralPublicRaw = await crypto.subtle.exportKey("raw", ephemeralKeyPair.publicKey);

    const sharedAesKey = await crypto.subtle.deriveKey(
      { name: "ECDH", public: peerPublicKey },
      ephemeralKeyPair.privateKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedPlaintext = new TextEncoder().encode(plaintext);

    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      sharedAesKey,
      encodedPlaintext
    );

    const combined = new Uint8Array(2 + ephemeralPublicRaw.byteLength + iv.length + ciphertextBuffer.byteLength);
    combined[0] = 1;
    combined[1] = ephemeralPublicRaw.byteLength;
    combined.set(new Uint8Array(ephemeralPublicRaw), 2);
    combined.set(iv, 2 + ephemeralPublicRaw.byteLength);
    combined.set(new Uint8Array(ciphertextBuffer), 2 + ephemeralPublicRaw.byteLength + iv.length);

    const transportPayload = `${PROTOCOL_PREFIX}${bufferToBase64Url(combined.buffer)}`;

    await navigator.clipboard.writeText(transportPayload);

    document.getElementById("ciphertext-output").textContent = transportPayload;
    document.getElementById("ciphertext-result").classList.remove("hidden");
    document.getElementById("plaintext-input").value = "";
    showNotification(notif, "🔐 Message chiffré et copié ! Prêt à coller dans WhatsApp.", "success");

  } catch (e) {
    showNotification(notif, "Erreur de chiffrement : " + e.message, "error");
  }
}

async function decryptReceivedMessage() {
  const rawInput = document.getElementById("ciphertext-input").value.trim();
  const notif = document.getElementById("decrypt-notification");
  const resultBox = document.getElementById("decrypted-result-box");

  if (!rawInput.startsWith(PROTOCOL_PREFIX)) {
    showNotification(notif, "Format invalide (doit commencer par " + PROTOCOL_PREFIX + ")", "error");
    resultBox.classList.add("hidden");
    return;
  }

  try {
    const base64payload = rawInput.replace(PROTOCOL_PREFIX, "").trim();
    const combined = new Uint8Array(base64UrlToBuffer(base64payload));

    const version = combined[0];
    if (version !== 1) {
      throw new Error("Version de protocole inconnue.");
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

    const sharedAesKey = await crypto.subtle.deriveKey(
      { name: "ECDH", public: senderEphemeralPublicKey },
      myIdentity.privateKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      sharedAesKey,
      ciphertext
    );

    const decodedText = new TextDecoder().decode(decryptedBuffer);

    document.getElementById("decrypted-text").textContent = decodedText;
    document.getElementById("sender-fp").textContent = "✓ Intégrité vérifiée (Tag AES-GCM 128-bit authentifié)";
    resultBox.classList.remove("hidden");
    showNotification(notif, "🔓 Message déchiffré avec succès !", "success");

  } catch (e) {
    resultBox.classList.add("hidden");
    showNotification(notif, "⚠️ Échec : message altéré, corrompu ou destiné à une autre clé.", "error");
  }
}

function wipeReaderMemory() {
  document.getElementById("ciphertext-input").value = "";
  document.getElementById("decrypted-text").textContent = "";
  document.getElementById("decrypted-result-box").classList.add("hidden");
  const notif = document.getElementById("decrypt-notification");
  showNotification(notif, "Mémoire du lecteur effacée.", "success");
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    document.getElementById("ciphertext-input").value = text;
    decryptReceivedMessage();
  } catch (e) {
    alert("Veuillez coller manuellement dans la zone de texte.");
  }
}

function copyCiphertextAgain() {
  const text = document.getElementById("ciphertext-output").textContent;
  navigator.clipboard.writeText(text);
  alert("Texte chiffré copié !");
}

function copyMyInvite() {
  const text = document.getElementById("my-invite-string").textContent;
  navigator.clipboard.writeText(text);
  alert("Invitation copiée ! Envoyez-la à votre contact.");
}

function showNotification(el, msg, type) {
  el.textContent = msg;
  el.className = "notification " + type;
  setTimeout(() => {
    el.className = "notification";
  }, 5000);
}

function switchTab(tabId) {
  document.getElementById("tab-btn-encrypt").classList.remove("active");
  document.getElementById("tab-btn-decrypt").classList.remove("active");
  document.getElementById("tab-btn-contacts").classList.remove("active");

  document.getElementById("tab-encrypt").classList.add("hidden");
  document.getElementById("tab-decrypt").classList.add("hidden");
  document.getElementById("tab-contacts").classList.add("hidden");

  if (tabId === "encrypt") {
    document.getElementById("tab-encrypt").classList.remove("hidden");
    document.getElementById("tab-btn-encrypt").classList.add("active");
  } else if (tabId === "decrypt") {
    document.getElementById("tab-decrypt").classList.remove("hidden");
    document.getElementById("tab-btn-decrypt").classList.add("active");
  } else {
    document.getElementById("tab-contacts").classList.remove("hidden");
    document.getElementById("tab-btn-contacts").classList.add("active");
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  await initIdentity();
  loadContacts();

  // Listeners d'onglets
  document.getElementById("tab-btn-encrypt").addEventListener("click", () => switchTab("encrypt"));
  document.getElementById("tab-btn-decrypt").addEventListener("click", () => switchTab("decrypt"));
  document.getElementById("tab-btn-contacts").addEventListener("click", () => switchTab("contacts"));

  // Actions
  document.getElementById("select-contact").addEventListener("change", updateSelectedContact);
  document.getElementById("btn-encrypt").addEventListener("click", encryptAndCopyMessage);
  document.getElementById("btn-copy-ciphertext").addEventListener("click", copyCiphertextAgain);

  document.getElementById("btn-decrypt").addEventListener("click", decryptReceivedMessage);
  document.getElementById("btn-paste").addEventListener("click", pasteFromClipboard);
  document.getElementById("btn-wipe-memory").addEventListener("click", wipeReaderMemory);

  document.getElementById("btn-copy-invite").addEventListener("click", copyMyInvite);
  document.getElementById("btn-add-contact").addEventListener("click", saveNewContact);
});
"""

os.makedirs('web-app', exist_ok=True)
with open('web-app/index.html', 'w', encoding='utf-8') as f:
    f.write(HTML_CONTENT)
with open('web-app/style.css', 'w', encoding='utf-8') as f:
    f.write(CSS_CONTENT)
with open('web-app/app.js', 'w', encoding='utf-8') as f:
    f.write(APP_JS_CONTENT)

print("Web App construite avec succès !")
