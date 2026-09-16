// SifrLayer Web - Client Cryptographique Zero-Knowledge
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
    card.className = "contact-card";
    card.innerHTML = `
      <div>
        <div style="font-weight: 700; font-family: var(--font-display); text-transform: uppercase; font-size: 0.95rem;">${c.name}</div>
        <div class="fingerprint-tag">FP: ${c.fingerprint}</div>
      </div>
      <button class="btn-danger btn-small" onclick="deleteContact(${index})">SUPPRIMER</button>
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
