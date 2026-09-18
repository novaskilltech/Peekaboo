// api/check-subscription.js
// Endpoint Serverless Vercel pour vérifier le statut réel d'un abonnement auprès de Stripe

const Stripe = require("stripe");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    // Si pas de clé Stripe, renvoie le statut free par défaut
    return res.status(200).json({
      plan: "free",
      status: "active",
      isPremium: false,
      maxContacts: 3,
      customerId: null
    });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

  try {
    const sessionId = req.query.session_id || (req.body && req.body.sessionId);
    const customerId = req.query.customer_id || (req.body && req.body.customerId);

    // 1. Vérification via Session ID (retour de paiement Checkout)
    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (!session) {
        return res.status(404).json({ error: "SESSION_NOT_FOUND" });
      }

      const planMeta = session.metadata ? session.metadata.plan : "unknown";

      // Cas Founder Lifetime (Paiement unique)
      if (session.mode === "payment" && session.payment_status === "paid") {
        return res.status(200).json({
          plan: "founder",
          status: "active",
          isPremium: true,
          maxContacts: null, // illimité
          customerId: session.customer || null
        });
      }

      // Cas Abonnement Récurrent (Personal Mensuel ou Annuel)
      if (session.mode === "subscription" && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        const isSubActive = sub.status === "active" || sub.status === "trialing";
        let subStatus = "active";
        if (sub.status === "canceled") subStatus = "cancelled";
        else if (sub.status === "past_due") subStatus = "past_due";
        else if (!isSubActive) subStatus = "expired";

        return res.status(200).json({
          plan: planMeta.includes("annual") ? "personal_annual" : "personal_monthly",
          status: subStatus,
          isPremium: isSubActive,
          maxContacts: isSubActive ? null : 3,
          customerId: session.customer || null,
          subscriptionId: sub.id
        });
      }
    }

    // 2. Vérification via Customer ID (session récurrente ultérieure)
    if (customerId) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 1
      });

      if (subscriptions.data && subscriptions.data.length > 0) {
        const sub = subscriptions.data[0];
        const isSubActive = sub.status === "active" || sub.status === "trialing";
        let subStatus = "active";
        if (sub.status === "canceled") subStatus = "cancelled";
        else if (sub.status === "past_due") subStatus = "past_due";
        else if (!isSubActive) subStatus = "expired";

        return res.status(200).json({
          plan: "personal_monthly", // ou déduit du price ID
          status: subStatus,
          isPremium: isSubActive,
          maxContacts: isSubActive ? null : 3,
          customerId: customerId,
          subscriptionId: sub.id
        });
      }
    }

    // Statut par défaut : FREE
    return res.status(200).json({
      plan: "free",
      status: "active",
      isPremium: false,
      maxContacts: 3,
      customerId: null
    });

  } catch (err) {
    console.error("[CHECK_SUBSCRIPTION_ERROR]", err);
    return res.status(500).json({
      error: "VERIFICATION_FAILED",
      message: err.message,
      plan: "free",
      status: "active",
      isPremium: false,
      maxContacts: 3
    });
  }
};
