// web-app/analytics.js
// Système de mesure business anonyme et conforme au principe de minimisation RGPD
// Strictement AUCUN message, AUCUNE clé, AUCUN contact, AUCUNE PII n'est collecté.

const ALLOWED_ANALYTICS_EVENTS = [
  "pricing_view",
  "click_free",
  "click_monthly",
  "click_annual",
  "click_founder",
  "checkout_started",
  "checkout_completed",
  "subscription_cancelled"
];

class PeekabooAnalytics {
  static track(eventName, params = {}) {
    if (!ALLOWED_ANALYTICS_EVENTS.includes(eventName)) {
      console.warn(`[ANALYTICS_FILTERED] Événement '${eventName}' non autorisé.`);
      return;
    }

    // Filtrage strict : seuls les paramètres fonctionnels sûrs sont conservés
    const sanitizedParams = {
      event: eventName,
      plan: params.plan || null,
      timestamp: Date.now()
    };

    // Journalisation locale sécurisée pour audit
    try {
      const history = JSON.parse(sessionStorage.getItem("peekaboo_anon_events") || "[]");
      history.push(sanitizedParams);
      // Garder au plus 20 événements en mémoire de session
      if (history.length > 20) history.shift();
      sessionStorage.setItem("peekaboo_anon_events", JSON.stringify(history));
    } catch (e) {
      // Ignorer
    }

    // Émission sécurisée console pour le suivi fonctionnel
    // console.info(`[PEEKABOO_METRICS] ${eventName}`, sanitizedParams);
  }
}

window.PeekabooAnalytics = PeekabooAnalytics;
