// api/create-portal-session.js
// Endpoint Serverless Vercel pour l'ouverture du Stripe Customer Portal

const Stripe = require("stripe");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(500).json({
      error: "STRIPE_SECRET_KEY_MISSING",
      message: "Clé STRIPE_SECRET_KEY non configurée."
    });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

  try {
    const { customerId, returnOrigin } = req.body || {};
    const origin = returnOrigin || req.headers.origin || "https://peekaboo-two-ebon.vercel.app";

    if (!customerId) {
      return res.status(400).json({
        error: "CUSTOMER_ID_REQUIRED",
        message: "L'identifiant client Stripe (customerId) est requis pour ouvrir le portail de gestion."
      });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/`
    });

    return res.status(200).json({ url: portalSession.url });

  } catch (err) {
    console.error("[STRIPE_PORTAL_ERROR]", err);
    return res.status(500).json({
      error: "PORTAL_SESSION_FAILED",
      message: err.message
    });
  }
};
