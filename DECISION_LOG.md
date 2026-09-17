# DECISION LOG — PROJET PEEKABOO
**Éditeur & Maîtrise d'Œuvre** : NOVA SKILL TECH  
**Responsable d'Orchestration** : NOVA-LEAD  
**Date de consolidation** : 17 Septembre 2026  
**Statut Global** : Production Ready (PWA Air-Gap & Landing Commerciale)  
**Dépôt GitHub** : `https://github.com/novaskilltech/Peekaboo.git` (Branche `main`)  

---

## 1. Vue d'Ensemble & Spécifications Actuelles (Spec Snapshot)

- **Nom Officiel** : **Peekaboo** (ex-SifrLayer) — *WhatsApp Stealth Edition (Anonymous)*
- **Slogan / Promesse** : *"Now you see it, now you don't // Zero-Knowledge Air-Gap"*
- **Créateur / Propriété** : **© 2026 Nova Skill Tech. Tous droits réservés.**
- **Stack Technique** :
  - Client PWA autonome 100% exécuté dans le navigateur de l'utilisateur (zéro runtime serveur).
  - Web Crypto API native (`ECDH P-256`, `HKDF-SHA256`, `AES-GCM-256`).
  - Stockage des clés privées : `IndexedDB` sandbox avec attribut `extractable: false`.
  - Service Worker Cache-First (`peekaboo-cache-v1.4.2`) avec mode Air-Gap (fonctionne hors-ligne et en mode avion).
  - Déploiement : Vercel avec politique CSP stricte (`default-src 'self'`).
- **Modèle Économique** :
  - Édition Découverte : Gratuite (3 contacts).
  - Licence Complète PRO : 49€ (achat unique perpétuel).
  - Déploiement Entreprise : Sur mesure.

---

## 2. Historique Exhaustif des Décisions (Decision Log)

### DEC-001 : Pivot Architectural — Application Web (PWA) vs Android Natif
- **Date** : 16 Septembre 2026
- **Décision** : Remplacer l'architecture Android Studio / IME native par une Web App Progressive (PWA) universelle, tout en conservant le moteur de chiffrement local.
- **Justification** : Déploiement instantané sans validation des stores GAFAM (Google Play / Apple App Store), interopérabilité immédiate sur smartphone (iOS, Android) et desktop (macOS, Windows, Linux).
- **Impacts** : Utilisation de l'API standardisée W3C Web Crypto, hébergement statique sur Vercel, maintien du mode hors-ligne via Service Worker.

### DEC-002 : Stockage Zéro-Knowledge & Clés Non-Exportables
- **Date** : 16 Septembre 2026
- **Décision** : Bannir strictement `localStorage` et `sessionStorage` pour tout matériel cryptographique. Implémenter `SecureKeyStore` basé sur `IndexedDB` stockant directement des objets `CryptoKey` avec l'option `{ extractable: false }`.
- **Justification** : Prévenir le vol de clés par injection de script malveillant (XSS) ou inspection du stockage textuel du navigateur.
- **Impacts** : La clé privée ne peut jamais être sérialisée ou exportée par l'application ; le déchiffrement a lieu exclusivement au sein du runtime sécurisé du navigateur.

### DEC-003 : Élimination de la Persistance Plaintext & Sécurité RAM
- **Date** : 16 Septembre 2026
- **Décision** : Zéro enregistrement de message en clair sur le disque ou dans une base de données.
- **Justification** : Garantir le principe de non-rétention : dès que l'utilisateur quitte la session, masque l'écran (`visibilitychange`) ou atteint le délai d'inactivité (auto-lock configurable : 1 min, 5 min, 15 min), les messages en clair sont purgés de la mémoire vive.
- **Impacts** : Protection maximale contre l'inspection physique de l'appareil déverrouillé.

### DEC-004 : Rétrocompatibilité du Format de Transport
- **Date** : 16 Septembre 2026
- **Décision** : Préserver scrupuleusement le préfixe de transport `🔐SL1:` et l'enveloppe Base64URL ainsi que le format d'invitation `🔑SIFR-INVITE:`.
- **Justification** : Ne pas casser l'interopérabilité des messages déjà générés ou échangés lors des versions initiales.
- **Impacts** : Maintien du parsing binaire (IV 96-bit, clé publique éphémère 65 octets, ciphertext AES-GCM et tag d'authentification MAC 128-bit).

### DEC-005 : Rebranding Produit — SifrLayer ➔ Peekaboo
- **Date** : 16 Septembre 2026
- **Décision** : Renommer l'application "Peekaboo" avec le concept *"Now you see it, now you don't"*.
- **Justification** : Nom commercial fort, grand public, mémorable, illustrant la disparition et l'invisibilité du message aux yeux des intermédiaires.
- **Impacts** : Mise à jour du manifeste PWA (`manifest.webmanifest`), du cache du Service Worker (`peekaboo-cache-v1.4.2`), du nom de base de données `PeekabooSecurityVault` et de tous les textes d'interface.

### DEC-006 : Camouflage Visuel & Ergonomie Mobile-First (WhatsApp Dark × Anonymous)
- **Date** : 16 Septembre 2026
- **Décision** :
  1. Adopter l'esthétique et l'agencement familier de **WhatsApp Dark** (`#0b141a`, `#111b21`, `#00a884`).
  2. Implémenter une **Bottom Navigation Bar** native au bas de l'écran optimisée pour la manipulation à une main au pouce (Chiffrer, Déchiffrer, Contacts, Sécurité).
  3. Rendre les résultats sous forme de bulles de chat réelles avec horodatage et doubles coches bleues `✓✓`.
  4. Créer un **Logo Hybride Sur-Mesure** : La bulle verte WhatsApp (gauche) fusionnée avec le masque de Guy Fawkes (**Anonymous**) en ombre sombre furtive (droite).
- **Justification** : Camouflage parfait sur smartphone. L'utilisateur a l'icône WhatsApp officielle et son clone secret Peekaboo côte à côte sans éveiller le moindre soupçon.
- **Impacts** : Refonte complète de `style.css` et `index.html`.

### DEC-007 : Éradication des Emojis au profit d'une Iconographie Vectorielle SVG Exclusive
- **Date** : 16 Septembre 2026
- **Décision** : Remplacer l'ensemble des emojis génériques de la barre de navigation par 4 icônes vectorielles SVG uniques et originales conçues sur mesure :
  - *Chiffrer* : Bulle WhatsApp intégrant la moustache et les sourcils Anonymous.
  - *Déchiffrer* : Cadenas cryptographique déverrouillé avec fente oculaire cybernétique et lignes de scan.
  - *Contacts* : Double silhouette avec masque Anonymous en profil.
  - *Sécurité* : Bouclier militaire biseauté avec validation cryptographique.
- **Justification** : Éviter le rendu amateur/hétérogène des emojis selon les systèmes d'exploitation (iOS/Android/Windows) et asseoir l'identité de marque unique de Peekaboo.

### DEC-008 : Manifeste Éthique & Philosophie des Libertés Individuelles
- **Date** : 16 Septembre 2026
- **Décision** : Intégrer une section manifeste en tête de Landing Page explicitant la raison d'être du produit :
  - Affirmation que les soupçons légitimes sur une minorité ne justifient en aucun cas l'espionnage de masse de l'humanité entière.
  - Distinction nette entre la **surveillance ciblée légitime** (autorisée sur preuves et sous contrôle judiciaire) et la **surveillance de masse automatisée** (anticonstitutionnelle et attentatoire aux libertés).
- **Justification** : Renforcer l'argumentaire de vente, la crédibilité morale et le positionnement d'autodéfense numérique citoyenne.

### DEC-009 : Cadre Légal, RGPD, CGV/CGU & Copyright Nova Skill Tech 2026
- **Date** : 16 Septembre 2026
- **Décision** : Intégrer formellement les mentions légales complètes :
  - Section "Qui sommes-nous" présentant **Nova Skill Tech**.
  - Article de tribune éthique sur les libertés numériques.
  - Conformité RGPD stricte (Privacy-by-Design, Zéro collecte de données, droit d'effacement DSAR instantané).
  - Conditions Générales d'Utilisation et de Vente (licence PRO perpétuelle à 49€, clause de non-responsabilité pour compromission physique du terminal).
  - Signature de bas de page : `© 2026 Nova Skill Tech. Tous droits réservés.`
- **Justification** : Conformité juridique européenne pour la commercialisation SaaS B2C/B2B et protection de la propriété intellectuelle.

### DEC-010 : Résolution du Schéma Vercel & Transition vers l'Audit Public
- **Date** : 16 Septembre 2026
- **Décision** :
  - Suppression de la directive non supportée `"public": false` dans `vercel.json`.
  - Décision d'ouvrir le dépôt en **Public** sur GitHub pour débloquer le pipeline Vercel sans friction et asseoir la réputation cryptographique zéro-knowledge (code auditable publiquement, à l'instar de Signal et Bitwarden).
  - Validation préalable par scan **NOVA-GENIUS** attestant qu'aucun secret, mot de passe ni token n'est présent dans le code source.

---

## 3. Matrice de Validation de Sécurité (Banc d'Essai Automatisé)

Chaque évolution a été validée par la suite complète `test_suite_complete.js` :

| # | Test | Critère Validé | Statut |
| :---: | :--- | :--- | :---: |
| 1 | Plaintext Réseau | 0 fuite du canary string dans les requêtes réseau | **PASS** |
| 2 | Sécurité localStorage | 0 clé privée persistée en localStorage | **PASS** |
| 3 | Sécurité sessionStorage | sessionStorage totalement vierge | **PASS** |
| 4 | IndexedDB Plaintext | Aucun texte de message stocké sur disque | **PASS** |
| 5 | Clé Non-Exportable | `extractable: false` formellement imposé par Web Crypto | **PASS** |
| 6 | Anti-Altération MAC | Détection immédiate de falsification du ciphertext | **PASS** |
| 7 | Cloisonnement Tiers | Impossibilité de déchiffrer avec une clé non autorisée | **PASS** |
| 8 | Immunité XSS | Injection DOM strictement restreinte à `textContent` | **PASS** |
| 9 | Mode Air-Gap | Cache-First Service Worker et manifest PWA conformes | **PASS** |
| 10 | Mise à Jour Contrôlée | Préservation de session (zéro `skipWaiting` forcé) | **PASS** |
| 11 | CSP Stricte | Interdiction totale d'eval, object et scripts non fiables | **PASS** |
| 12 | Audit des Logs | Aucun affichage de secret ou PII dans la console | **PASS** |

**Score Global de Conformité** : **12 / 12 PASS (100%)**.

---

## 4. Répertoire des Livrables Clés

- **Application Principale** :
  - `web-app/index.html` : Landing page, manifeste, CGV/RGPD et console WhatsApp Stealth.
  - `web-app/style.css` : Thème WhatsApp Dark, bottom nav et composants tactiles.
  - `web-app/app.js` : Moteur cryptographique ECDH / AES-GCM et gestion du coffre.
  - `web-app/logo.svg` : Logo vectoriel hybride WhatsApp × Anonymous.
  - `web-app/sw.js` : Service Worker Air-Gap.
  - `web-app/security-manifest.json` : Empreintes SHA-256 d'intégrité des fichiers.
- **Configuration Déploiement** :
  - `vercel.json` : Routage et politique CSP.
- **Assurance Qualité & Documentation** :
  - `SECURITY-AUDIT.md` : Rapport d'audit de durcissement.
  - `test_suite_complete.js` : Banc de test unitaire et d'intégration.
