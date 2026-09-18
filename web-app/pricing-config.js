// web-app/pricing-config.js
// Configuration centralisée des offres tarifaires Peekaboo

window.PEEKABOO_PRICING_CONFIG = {
  // 1. Offre Gratuite
  free: {
    id: "free",
    name: "Peekaboo Free",
    priceDisplay: "0 €",
    subtext: "Gratuit à vie",
    maxContacts: 3,
    features: [
      "Jusqu'à 3 contacts sécurisés",
      "Chiffrement et déchiffrement local",
      "Sans publicité",
      "Sans inscription obligatoire",
      "Données de chiffrement traitées sur l'appareil",
      "Accès aux fonctions essentielles"
    ],
    ctaText: "UTILISER GRATUITEMENT",
    ctaAction: "launch_app"
  },

  // 2. Offre Personal Mensuelle
  personalMonthly: {
    id: "personal_monthly",
    name: "Peekaboo Personal",
    priceDisplay: "2,99 €",
    period: "/ mois",
    subtext: "Paiement mensuel récurrent • Sans engagement",
    maxContacts: null, // illimité
    features: [
      "Contacts illimités",
      "Toutes les fonctionnalités Free",
      "Mode urgence (Panic Lock instantané)",
      "Fonctionnalités premium",
      "Futures fonctionnalités Personal incluses",
      "Support prioritaire"
    ],
    ctaText: "CHOISIR PERSONAL",
    ctaAction: "checkout"
  },

  // 3. Offre Personal Annuelle (Offre Principale / Vedette)
  personalAnnual: {
    id: "personal_annual",
    name: "Peekaboo Personal Annuel",
    priceDisplay: "29,90 €",
    period: "/ an",
    equivalentMonthly: "soit 2,49 €/mois",
    badge: "LE PLUS POPULAIRE",
    subtext: "Facturation annuelle récurrente (2 mois offerts)",
    maxContacts: null,
    isFeatured: true,
    features: [
      "Contacts illimités",
      "Toutes les fonctionnalités Free & Personal",
      "Mode urgence (Panic Lock instantané)",
      "Fonctionnalités premium prioritaires",
      "Support prioritaire dédié",
      "Économisez 17% par rapport au mensuel"
    ],
    ctaText: "PASSER À PERSONAL",
    ctaAction: "checkout"
  },

  // 4. Offre Founder Lifetime (Offre de lancement temporaire & configurable)
  founder: {
    id: "founder",
    name: "Founder Lifetime",
    priceDisplay: "49 €",
    period: "paiement unique",
    badges: ["OFFRE DE LANCEMENT", "QUANTITÉ LIMITÉE"],
    active: true,                  // Basculer à false pour masquer l'offre
    endDate: null,                 // Ex : "2026-12-31" ou null si indéterminé
    remainingLicenses: null,       // Ex : 42 ou null si pas de compteur affiché
    maxContacts: null,
    features: [
      "Contacts illimités à vie",
      "Fonctionnalités Personal complètes",
      "Mode urgence (Panic Lock)",
      "Pas d'abonnement (zéro prélèvement futur)",
      "Licence personnelle permanente",
      "Statut Membre Fondateur à vie"
    ],
    ctaText: "OBTENIR LE PASS FOUNDER",
    ctaAction: "checkout",
    disclaimer: "Offre temporaire réservée aux premiers utilisateurs."
  }
};
