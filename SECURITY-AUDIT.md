# Rapport d'Audit de Sécurité — SifrLayer Pro

**Date de l'audit :** 16 Septembre 2026  
**Cible :** SifrLayer Pro Web Application & PWA  
**Statut global :** 12/12 Tests de sécurité validés (Conformité Air-Gap & Zero-Knowledge)

---

## 1. Corrigé (Ce qui a réellement été sécurisé)

1. **Protection matérielle des clés privées via `extractable: false`** :
   - Les clés privées ECDH P-256 générées possèdent désormais l'attribut `extractable: false`.
   - L'exportation de la clé privée par `crypto.subtle.exportKey()` est formellement bloquée au niveau de l'implémentation native de Web Crypto par le navigateur.

2. **Élimination de `localStorage` pour les secrets & Migration vers `IndexedDB`** :
   - Migration automatique transparente des anciennes clés et contacts stockés en clair dans `localStorage`.
   - Les objets `CryptoKey` non exportables sont stockés directement dans la base `SifrLayerSecurityVault` (IndexedDB).
   - Purge immédiate et irréversible de l'ancien stockage `localStorage`.

3. **Éradication des vulnérabilités XSS (DOM Sanitization)** :
   - Suppression totale des assignations `innerHTML` non contrôlées pour les données dynamiques.
   - Utilisation systématique de `textContent` et d'éléments DOM créés par `document.createElement()` pour l'affichage des noms de contacts, des empreintes, des clés publiques et du texte déchiffré.

4. **Durcissement strict de la Content Security Policy (CSP)** :
   - Déploiement dans `vercel.json` d'une politique CSP de niveau bancaire :
     `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; worker-src 'self'; manifest-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none';`
   - Blocage complet de tout script externe arbitraire, d'`eval()`, et d'imbrication par iframe (`frame-ancestors 'none'`).
   - Restriction drastique des fonctionnalités matérielles via `Permissions-Policy` (désactivation de `camera`, `microphone`, `geolocation`, `payment`, `usb`).

5. **Déploiement PWA Air-Gap avec mise à jour contrôlée** :
   - Implémentation d'un Service Worker en mode `Cache-First` pour garantir le fonctionnement en mode avion sans connexion réseau.
   - Interdiction du `self.skipWaiting()` automatique. Détection des nouvelles versions avec affichage d'une bannière de mise à jour non bloquante pour préserver les opérations cryptographiques en cours.
   - Génération au build de `security-manifest.json` avec hachages cryptographiques SHA-256 de chaque asset critique.

6. **Protection contre l'espionnage d'écran (Shoulder-Surfing) & Verrouillage** :
   - Intégration de la `Page Visibility API` : le texte déchiffré est automatiquement masqué dès que l'onglet passe en arrière-plan.
   - Temporisateur d'inactivité configurable (1 min, 5 min, 15 min) purgeant automatiquement la mémoire du lecteur.
   - Avertissement explicite lors de la copie du texte en clair dans le presse-papiers système.

---

## 2. Conservé (Architecture existante laissée volontairement intacte)

1. **Protocole de chiffrement éprouvé & Format d'enveloppe `🔐SL1:`** :
   - Conservation intégrale de la structure de transport standardisée : préfixe `🔐SL1:` + Base64URL sans padding.
   - Conservation du protocole à clé éphémère (Forward Secrecy) sur **ECDH P-256** combiné à **AES-GCM 256 bits** avec tag d'authentification 128 bits.
   - Rétro-compatibilité totale assurée pour les messages générés par les versions précédentes.

2. **Format d'invitation et de contact `🔑SIFR-INVITE:`** :
   - Format d'échange de clés publiques brutes P-256 encodées en Base64URL conservé.
   - Calcul déterministe de l'empreinte publique SHA-256 (format hexadécimal à 8 octets espacés).

3. **Design System & Expérience Utilisateur carrée Stitch** :
   - Typographies (`Space Grotesk`, `JetBrains Mono`, `Inter`) et esthétique carrée HUD sombre conservées sans régression visuelle.

---

## 3. Risques résiduels (Risques qu'une Web App ne peut pas éliminer)

1. **Compromission du terminal hôte (Endpoint Security)** :
   - Une application Web ne peut techniquement pas se protéger contre un système d'exploitation compromis par un keylogger de niveau noyau, un malware avec privilèges root, ou un logiciel espion étatique.
2. **Extensions de navigateur malveillantes avec privilèges élevés** :
   - Une extension de navigateur installée par l'utilisateur possédant les permissions `<all_urls>` ou `activeTab` peut lire la mémoire vive du DOM après déchiffrement. *Recommandation : utiliser SifrLayer dans une fenêtre de navigation privée sans extension activée.*
3. **Persistance dans le presse-papiers du système d'exploitation** :
   - Dès lors que l'utilisateur clique sur « Copier », le texte clair réside dans le presse-papiers de l'OS (qui peut être lu par d'autres applications sous Android/Windows).
4. **Analyse des métadonnées par les tiers de transport** :
   - WhatsApp, Telegram ou les opérateurs télécoms peuvent toujours observer les métadonnées de transmission (adresses IP, fréquence et taille approximative des messages chiffrés).

---

## 4. À auditer par un spécialiste (Audit indépendant recommandé)

1. **Résistance du générateur aléatoire du navigateur (`crypto.getRandomValues`)** selon les versions d'OS et de navigateurs mobiles exotiques.
2. **Stratégie de dérivation de clé de session ECDH** : validation formelle de l'absence de KDF intermédiaire explicite (HKDF) avant AES-GCM (l'état actuel utilise la clé dérivée directe de 256 bits via SubtleCrypto).
3. **Audit de mise en œuvre de `IndexedDB`** sous des environnements de conteneurs tiers ou navigateurs in-app (ex. navigateur intégré à Instagram/Facebook).
