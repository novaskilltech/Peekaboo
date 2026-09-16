const crypto = require('crypto').webcrypto;

const PROTOCOL_PREFIX = "🔐SL1:";

function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return Buffer.from(binary, 'binary').toString('base64url');
}

function base64UrlToBuffer(base64url) {
  const buf = Buffer.from(base64url, 'base64url');
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

async function runTests() {
  console.log("=== BANC DE TEST DU PROTOCOLE SIFRLAYER WEB ===");

  // 1. Génération des clés d'identité d'Alice et Bob
  const aliceKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
  const bobKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );

  const bobPublicRaw = await crypto.subtle.exportKey("raw", bobKeyPair.publicKey);
  const bobImportedPublic = await crypto.subtle.importKey(
    "raw", bobPublicRaw,
    { name: "ECDH", namedCurve: "P-256" },
    false, []
  );

  // 2. Chiffrement d'Alice vers Bob (Test A - Nominal)
  const plaintext = "Rendez-vous demain à 15h au bureau.";
  console.log("Texte clair initial :", plaintext);

  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );
  const ephemeralPublicRaw = await crypto.subtle.exportKey("raw", ephemeralKeyPair.publicKey);

  const sharedAesKeyAlice = await crypto.subtle.deriveKey(
    { name: "ECDH", public: bobImportedPublic },
    ephemeralKeyPair.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedPlaintext = new TextEncoder().encode(plaintext);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedAesKeyAlice,
    encodedPlaintext
  );

  const combined = new Uint8Array(2 + ephemeralPublicRaw.byteLength + iv.length + ciphertextBuffer.byteLength);
  combined[0] = 1; // Version
  combined[1] = ephemeralPublicRaw.byteLength;
  combined.set(new Uint8Array(ephemeralPublicRaw), 2);
  combined.set(iv, 2 + ephemeralPublicRaw.byteLength);
  combined.set(new Uint8Array(ciphertextBuffer), 2 + ephemeralPublicRaw.byteLength + iv.length);

  const transportPayload = `${PROTOCOL_PREFIX}${bufferToBase64Url(combined.buffer)}`;
  console.log("Payload chiffré généré :", transportPayload.substring(0, 45) + "...");

  // 3. Déchiffrement par Bob
  const base64payload = transportPayload.replace(PROTOCOL_PREFIX, "");
  const receivedCombined = new Uint8Array(base64UrlToBuffer(base64payload));

  const ephemKeyLen = receivedCombined[1];
  const receivedEphemRaw = receivedCombined.slice(2, 2 + ephemKeyLen);
  const receivedIv = receivedCombined.slice(2 + ephemKeyLen, 2 + ephemKeyLen + 12);
  const receivedCiphertext = receivedCombined.slice(2 + ephemKeyLen + 12);

  const senderEphemKey = await crypto.subtle.importKey(
    "raw", receivedEphemRaw.buffer,
    { name: "ECDH", namedCurve: "P-256" },
    false, []
  );

  const sharedAesKeyBob = await crypto.subtle.deriveKey(
    { name: "ECDH", public: senderEphemKey },
    bobKeyPair.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: receivedIv },
    sharedAesKeyBob,
    receivedCiphertext
  );

  const decryptedText = new TextDecoder().decode(decryptedBuffer);
  console.log("Texte déchiffré par Bob :", decryptedText);

  if (decryptedText === plaintext) {
    console.log("✓ TEST A (Confidentialité et déchiffrement nominal) : SUCCÈS !");
  } else {
    throw new Error("Échec du déchiffrement nominal");
  }

  // 4. Test C : Falsification d'un octet (Altération du ciphertext)
  console.log("\n--- TEST C : Falsification d'un octet ---");
  const tamperedCombined = new Uint8Array(receivedCombined);
  tamperedCombined[tamperedCombined.length - 1] ^= 0xFF; // Inversion du tag MAC

  try {
    const tamperedCiphertext = tamperedCombined.slice(2 + ephemKeyLen + 12);
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: receivedIv },
      sharedAesKeyBob,
      tamperedCiphertext
    );
    throw new Error("ERREUR : L'authentification aurait dû rejeter le message altéré !");
  } catch (e) {
    if (e.message.includes("ERREUR")) throw e;
    console.log("✓ TEST C (Rejet immédiat d'un message altéré) : SUCCÈS (Authentication tag invalid) !");
  }

  // 5. Test D : Déchiffrement par un tiers (Charlie)
  console.log("\n--- TEST D : Tentative d'interception par un tiers ---");
  const charlieKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );

  const sharedAesKeyCharlie = await crypto.subtle.deriveKey(
    { name: "ECDH", public: senderEphemKey },
    charlieKeyPair.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  try {
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: receivedIv },
      sharedAesKeyCharlie,
      receivedCiphertext
    );
    throw new Error("ERREUR : Charlie n'aurait jamais dû pouvoir déchiffrer !");
  } catch (e) {
    if (e.message.includes("ERREUR")) throw e;
    console.log("✓ TEST D (Impossibilité de déchiffrement pour un tiers non autorisé) : SUCCÈS !");
  }

  console.log("\nTOUS LES TESTS CRYPTOGRAPHIQUES VALIDENT LES EXIGENCES DU CDC !");
}

runTests().catch(err => {
  console.error("Échec des tests :", err);
  process.exit(1);
});
