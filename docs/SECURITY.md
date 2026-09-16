# Politique de Sécurité — SifrLayer Pro

## 1. Vision et Modèle de Menace

SifrLayer Pro est une application de surchiffrement local (*Over-The-Top Messaging Encryption*) conçue selon le paradigme du **Zero-Knowledge** et du fonctionnement déconnecté (**Air-Gap**).

Elle permet à deux utilisateurs de chiffrer des messages directement sur leur terminal avant de transmettre les données sous forme de texte opaque (`🔐SL1:...`) via n'importe quel canal de transport tiers (WhatsApp, Telegram, Signal, SMS, email).

---

## 2. Ce que SifrLayer Pro protège

L'application protège le contenu des messages contre :
- **Le fournisseur de messagerie** (ex. serveurs de WhatsApp / Meta, Telegram, etc.) qui n'accède qu'au ciphertext chiffré.
- **Le serveur d'hébergement Web** (ex. Vercel) : aucun message, aucun plaintext, aucune clé privée n'est transmis au serveur web. L'application s'exécute à 100 % localement dans le navigateur.
- **Les intermédiaires réseau et opérateurs** (FAI, proxies, Wi-Fi public non sécurisé, écoutes gouvernementales sur le transit).
- **L'interception des ciphertexts** : les paquets sont chiffrés en AES-GCM 256 bits avec authentification de message (AEAD).
- **Une fuite ou piratage de base de données tierce** contenant uniquement l'historique des textes chiffrés.
- **La falsification ou altération en transit** : toute modification d'un seul bit du message chiffré provoque un rejet d'authentification immédiat sans jamais produire de clair partiel.

---

## 3. Ce que SifrLayer Pro NE protège PAS (Limites explicites)

SifrLayer Pro ne prétend pas offrir une sécurité absolue ni magique. Elle ne protège **PAS** contre :
- **Un appareil déjà compromis** (malware, rootkit, spyware d'état type Pegasus).
- **Un keylogger système** ou enregistreur de frappe actif au niveau de l'OS.
- **Une extension de navigateur malveillante** disposant des permissions d'accès au DOM ou aux onglets.
- **Une capture d'écran** effectuée après que le message a été déchiffré et affiché.
- **Le destinataire lui-même** (qui peut copier, photographier ou divulguer le message déchiffré).
- **Une caméra physique** filmant l'écran de l'utilisateur.
- **Un navigateur web corrompu** ou non maintenu.
- **L'analyse des métadonnées de transport** : heure d'envoi, adresses IP de connexion à WhatsApp, fréquence et taille approximative des paquets échangés sur le réseau tiers.

> **Règle d'or :** L'application n'est jamais présentée comme « inviolable », « 100% sécurisée » ou « incassable ». La sécurité cryptographique locale garantit la confidentialité mathématique du contenu, sous réserve de l'intégrité du terminal.

---

## 4. Architecture Cryptographique & Clés

- **Primitives utilisées** : Web Crypto API native (`window.crypto.subtle`), standardisée par le W3C.
  - Échange de clés : **ECDH** sur courbe standard **P-256** (`secp256r1`).
  - Chiffrement symétrique : **AES-GCM 256 bits** avec tag d'authentification 128 bits.
  - Aléatoire cryptographique : `crypto.getRandomValues()` exclusif (interdiction absolue de `Math.random()`).
  - Dérivation éphémère (**Forward Secrecy**) : chaque message génère une nouvelle paire de clés ECDH éphémère.
- **Protection des clés privées** :
  - Les clés privées sont générées avec l'attribut **`extractable: false`**. Elles ne peuvent pas être exportées en clair en octets par le code JavaScript applicatif.
  - Stockage persistant : stockées sous forme d'objets `CryptoKey` non exportables directement dans **IndexedDB** (`SifrLayerKeyStore`).
  - Aucune clé privée n'est stockée dans `localStorage`, `sessionStorage`, cookies ou logs.
- **Format d'enveloppe** :
  - Préfixe versionné : `🔐SL1:` suivi d'une charge utile Base64URL sans padding comprenant la version, la clé publique éphémère (65 octets), le vecteur d'initialisation (12 octets IV) et le ciphertext authentifié (AES-GCM).

---

## 5. Dépendances Externes & Réseau

- **Dépendances tierces en production** : **0**. Aucun script externe, aucun tracker, aucun CDN applicatif obligatoire.
- **Télémétrie & Analytics** : **0**. Aucune télémétrie (ni Google Analytics, ni Sentry, ni Mixpanel, etc.).
- **Politique réseau** : Fonctionnement 100% hors-ligne (mode avion) grâce au Service Worker et à la mise en cache PWA.
