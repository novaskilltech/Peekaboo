const crypto = require('crypto').webcrypto;

async function testNonExtractableCryptoKey() {
  console.log("=== TEST DE DURCISSEMENT CRYPTOKEY NON EXPORTABLE (P-256) ===");

  // 1. Génération avec extractable: false pour la clé privée
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false, // extractable: false
    ["deriveKey", "deriveBits"]
  );

  console.log("Clé privée générée avec extractable =", keyPair.privateKey.extractable);
  console.log("Clé publique générée avec extractable =", keyPair.publicKey.extractable);

  // 2. Vérification que l'export de la clé privée est FORMELLEMENT INTERDIT
  try {
    await crypto.subtle.exportKey("jwk", keyPair.privateKey);
    throw new Error("FAIL: L'export de la clé privée non-exportable a réussi !");
  } catch (e) {
    console.log("✓ Sécurité vérifiée : tentative d'export de clé privée bloquée ->", e.message);
  }

  // 3. Vérification que la dérivation ECDH fonctionne normalement avec la clé non-exportable
  const peerKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );

  const sharedKey = await crypto.subtle.deriveKey(
    { name: "ECDH", public: peerKeyPair.publicKey },
    keyPair.privateKey, // Clé privée non exportable utilisée directement
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  console.log("✓ Dérivation de clé symétrique partagée réussie avec clé privée non exportable !");

  // 4. Chiffrement et déchiffrement test
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode("SIFRLAYER_PLAINTEXT_CANARY_987654");
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    plaintext
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    ciphertext
  );

  const decryptedStr = new TextDecoder().decode(decrypted);
  if (decryptedStr === "SIFRLAYER_PLAINTEXT_CANARY_987654") {
    console.log("✓ Chiffrement/Déchiffrement validé avec CryptoKey non-exportable !");
  } else {
    throw new Error("FAIL: Message déchiffré incorrect.");
  }
}

testNonExtractableCryptoKey().catch(e => {
  console.error(e);
  process.exit(1);
});
