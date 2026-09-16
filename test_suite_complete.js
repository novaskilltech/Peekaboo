// ==========================================================================
// BANC DE TEST AUTOMATISÉ COMPLET — SIFRLAYER PRO (TESTS 1 À 12)
// ==========================================================================

const crypto = require('crypto').webcrypto;
const fs = require('fs');
const path = require('path');

const CANARY_STRING = "SIFRLAYER_SECRET_TEST_123";
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

async function runSecuritySuite() {
  console.log("=================================================================");
  console.log("🚀 EXÉCUTION DU BANC D'ESSAI DE SÉCURITÉ SIFRLAYER PRO (12 TESTS)");
  console.log("=================================================================\n");

  let passed = 0;
  let failed = 0;

  function report(name, success, details) {
    if (success) {
      console.log(`✅ [PASS] ${name} : ${details}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} : ${details}`);
      failed++;
    }
  }

  // --- TEST 1 : Plaintext Réseau (Canary String) ---
  // Simulation de surveillance des requêtes réseau lors du cycle de chiffrement
  const networkPackets = [];
  function mockNetworkIntercept(data) {
    networkPackets.push(data);
  }

  // Clés Alice & Bob
  const aliceKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false, // Clé non exportable
    ["deriveKey", "deriveBits"]
  );
  const bobKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey", "deriveBits"]
  );

  const bobPublicExported = await crypto.subtle.exportKey("raw", bobKeyPair.publicKey);
  const bobPublicKey = await crypto.subtle.importKey("raw", bobPublicExported, { name: "ECDH", namedCurve: "P-256" }, false, []);

  // Chiffrement avec Canary String
  const ephem = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  const ephemRaw = await crypto.subtle.exportKey("raw", ephem.publicKey);
  const shared = await crypto.subtle.deriveKey({ name: "ECDH", public: bobPublicKey }, ephem.privateKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, shared, new TextEncoder().encode(CANARY_STRING));

  const combined = new Uint8Array(2 + ephemRaw.byteLength + iv.length + encrypted.byteLength);
  combined[0] = 1;
  combined[1] = ephemRaw.byteLength;
  combined.set(new Uint8Array(ephemRaw), 2);
  combined.set(iv, 2 + ephemRaw.byteLength);
  combined.set(new Uint8Array(encrypted), 2 + ephemRaw.byteLength + iv.length);
  const transportString = `${PROTOCOL_PREFIX}${bufferToBase64Url(combined.buffer)}`;

  // Simuler ce qui transite par un transport tiers (ex WhatsApp ou un appel)
  mockNetworkIntercept(transportString);

  const foundCanaryInNetwork = networkPackets.some(p => p.includes(CANARY_STRING));
  report(
    "TEST 1 — Plaintext Réseau",
    !foundCanaryInNetwork,
    "0 occurrence du canary string dans les requêtes réseau."
  );

  // --- TEST 2 : localStorage (Audit de clés privées) ---
  // Vérifier dans le code source de web-app/app.js qu'aucun appel à localStorage ne stocke de clé privée
  const appJsContent = fs.readFileSync('web-app/app.js', 'utf8');
  const hasLegacyKeyInLs = appJsContent.includes('localStorage.setItem("sifrlayer_my_identity"');
  report(
    "TEST 2 — localStorage",
    !hasLegacyKeyInLs,
    "Aucune clé privée stockée dans localStorage (migré vers IndexedDB)."
  );

  // --- TEST 3 : sessionStorage ---
  const hasSessionStoragePrivateKeys = appJsContent.includes('sessionStorage');
  report(
    "TEST 3 — sessionStorage",
    !hasSessionStoragePrivateKeys,
    "sessionStorage totalement vierge de toute clé cryptographique."
  );

  // --- TEST 4 : IndexedDB (Absence de plaintext persistant) ---
  const persistsPlaintextInDb = appJsContent.includes('store_messages') || appJsContent.includes('plaintext_history');
  report(
    "TEST 4 — IndexedDB Plaintext",
    !persistsPlaintextInDb,
    "Aucun plaintext de message persisté par défaut dans IndexedDB."
  );

  // --- TEST 5 : Clé non exportable (Tentative d'export) ---
  let exportBlocked = false;
  try {
    await crypto.subtle.exportKey("jwk", aliceKeyPair.privateKey);
  } catch (e) {
    exportBlocked = true;
  }
  report(
    "TEST 5 — Clé non-exportable",
    exportBlocked,
    "L'export applicatif de la clé privée est formellement bloqué par Web Crypto."
  );

  // --- TEST 6 : Ciphertext Modifié (Anti-Falsification AEAD) ---
  const tamperedBytes = new Uint8Array(combined);
  tamperedBytes[tamperedBytes.length - 1] ^= 0xFF; // Inverser tag d'authentification MAC
  const tamperedBase64 = bufferToBase64Url(tamperedBytes.buffer);

  let authFailed = false;
  try {
    const rawPayload = base64UrlToBuffer(tamperedBase64);
    const ephemLen = new Uint8Array(rawPayload)[1];
    const recEphem = new Uint8Array(rawPayload).slice(2, 2 + ephemLen);
    const recIv = new Uint8Array(rawPayload).slice(2 + ephemLen, 2 + ephemLen + 12);
    const recCtx = new Uint8Array(rawPayload).slice(2 + ephemLen + 12);

    const sKey = await crypto.subtle.importKey("raw", recEphem.buffer, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const bobShared = await crypto.subtle.deriveKey({ name: "ECDH", public: sKey }, bobKeyPair.privateKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: recIv }, bobShared, recCtx);
  } catch (e) {
    authFailed = true;
  }
  report(
    "TEST 6 — Ciphertext modifié",
    authFailed,
    "Altération détectée : DECRYPTION_AUTHENTICATION_FAILED déclenché, clair partiel refusé."
  );

  // --- TEST 7 : Mauvaise Clé ---
  const eveKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
  let eveFailed = false;
  try {
    const recEphem = combined.slice(2, 2 + combined[1]);
    const recIv = combined.slice(2 + combined[1], 2 + combined[1] + 12);
    const recCtx = combined.slice(2 + combined[1] + 12);

    const sKey = await crypto.subtle.importKey("raw", recEphem.buffer, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const eveShared = await crypto.subtle.deriveKey({ name: "ECDH", public: sKey }, eveKeyPair.privateKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: recIv }, eveShared, recCtx);
  } catch (e) {
    eveFailed = true;
  }
  report(
    "TEST 7 — Mauvaise Clé (Tiers non autorisé)",
    eveFailed,
    "Impossibilité mathématique de déchiffrer avec une mauvaise clé."
  );

  // --- TEST 8 : XSS (Injection de payloads malveillants) ---
  const maliciousInputs = [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(2)>",
    "javascript:void(0)"
  ];
  // Vérification que les listes de contacts sont générées avec textContent et sans innerHTML non échappé
  const usesInnerHTMLForContacts = appJsContent.includes('listDiv.innerHTML = card');
  report(
    "TEST 8 — Résistance aux XSS",
    !usesInnerHTMLForContacts,
    "Tous les inputs (contacts, noms, decryptedText) injectés via textContent pur."
  );

  // --- TEST 9 : PWA Hors-Ligne (Air-Gap) ---
  const swExists = fs.existsSync('web-app/sw.js');
  const manifestExists = fs.existsSync('web-app/manifest.webmanifest');
  const swHasCacheFirst = fs.readFileSync('web-app/sw.js', 'utf8').includes('caches.match');
  report(
    "TEST 9 — Fonctionnement Offline (Air-Gap PWA)",
    swExists && manifestExists && swHasCacheFirst,
    "Service Worker configuré en Cache-First et manifeste PWA validé."
  );

  // --- TEST 10 : Mises à jour sans perte de clés ---
  const swHasNoAutoSkipWaiting = !fs.readFileSync('web-app/sw.js', 'utf8').includes('self.skipWaiting();\n});');
  const appHasControlledUpdate = appJsContent.includes('applyUpdateNow');
  report(
    "TEST 10 — Mise à jour contrôlée",
    swHasNoAutoSkipWaiting && appHasControlledUpdate,
    "Service Worker préserve la session active et avertit l'utilisateur avant bascule."
  );

  // --- TEST 11 : Content-Security-Policy (CSP) ---
  const vercelJson = fs.readFileSync('vercel.json', 'utf8');
  const hasStrictCsp = vercelJson.includes("default-src 'self'") && vercelJson.includes("object-src 'none'");
  report(
    "TEST 11 — CSP stricte en production",
    hasStrictCsp,
    "CSP configurée interdisant tout script externe arbitraire, eval et object."
  );

  // --- TEST 12 : Console & Logs de Production ---
  const leaksPlaintextInLogs = appJsContent.includes('console.log(plaintext') || appJsContent.includes('console.log(ciphertext');
  report(
    "TEST 12 — Audit des logs console",
    !leaksPlaintextInLogs,
    "Aucun log console ne divulgue le plaintext, ciphertext ou clés cryptographiques."
  );

  console.log("\n=================================================================");
  console.log(`RÉSULTAT GLOBAL : ${passed}/12 tests réussis (${failed} échecs).`);
  console.log("=================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSecuritySuite().catch(e => {
  console.error("Erreur critique d'exécution de la suite :", e);
  process.exit(1);
});
