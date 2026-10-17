// api/create-checkout-session.js
// Endpoint Serverless Vercel pour la création sécurisée de sessions Stripe Checkout

const Stripe = require("stripe");

const ALLOWED_ORIGINS = [
  "https://peekaboo.novaskill.tech",
  "https://peekaboo-two-ebon.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];

function resolveSafeOrigin(candidate, headerOrigin) {
  if (candidate && ALLOWED_ORIGINS.includes(candidate)) return candidate;
  if (headerOrigin && ALLOWED_ORIGINS.includes(headerOrigin)) return headerOrigin;
  return "https://peekaboo-two-ebon.vercel.app";
}

module.exports = async function handler(req, res) {
  const safeCorsOrigin = resolveSafeOrigin(null, req.headers.origin);
  res.setHeader("Access-Control-Allow-Origin", safeCorsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée. Seul POST est accepté." });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(500).json({
      error: "STRIPE_SECRET_KEY_MISSING",
      message: "La variable d'environnement STRIPE_SECRET_KEY n'est pas encore configurée sur le serveur."
    });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

  try {
    const { plan, customerEmail, returnOrigin } = req.body || {};
    const validPlans = ["personal_monthly", "personal_annual", "founder"];

    if (!validPlans.includes(plan)) {
      return res.status(400).json({
        error: "INVALID_PLAN",
        message: "Plan inconnu. Valeurs autorisées : personal_monthly, personal_annual, founder."
      });
    }

    const origin = resolveSafeOrigin(returnOrigin, req.headers.origin);

    let lineItems = [];
    let mode = "subscription";

    if (plan === "personal_monthly") {
      mode = "subscription";
      if (process.env.STRIPE_PRICE_PERSONAL_MONTHLY) {
        lineItems = [{ price: process.env.STRIPE_PRICE_PERSONAL_MONTHLY, quantity: 1 }];
      } else {
        // Fallback dynamique si le Price ID n'est pas encore créé dans le Dashboard
        lineItems = [{
          price_data: {
            currency: "eur",
            product_data: {
              name: "Peekaboo Personal (Mensuel)",
              description: "Contacts illimités, mode urgence, fonctionnalités premium et support prioritaire."
            },
            unit_amount: 299, // 2,99 €
            recurring: { interval: "month" }
          },
          quantity: 1
        }];
      }
    } else if (plan === "personal_annual") {
      mode = "subscription";
      if (process.env.STRIPE_PRICE_PERSONAL_ANNUAL) {
        lineItems = [{ price: process.env.STRIPE_PRICE_PERSONAL_ANNUAL, quantity: 1 }];
      } else {
        lineItems = [{
          price_data: {
            currency: "eur",
            product_data: {
              name: "Peekaboo Personal (Annuel — Offre Principale)",
              description: "Contacts illimités, mode urgence, fonctionnalités premium (soit 2,49 €/mois)."
            },
            unit_amount: 2990, // 29,90 €
            recurring: { interval: "year" }
          },
          quantity: 1
        }];
      }
    } else if (plan === "founder") {
      mode = "payment";
      if (process.env.STRIPE_PRICE_FOUNDER) {
        lineItems = [{ price: process.env.STRIPE_PRICE_FOUNDER, quantity: 1 }];
      } else {
        lineItems = [{
          price_data: {
            currency: "eur",
            product_data: {
              name: "Peekaboo Pass Founder Lifetime (Lancement)",
              description: "Licence perpétuelle sans abonnement, contacts illimités et mode urgence à vie."
            },
            unit_amount: 4900 // 49,00 €
          },
          quantity: 1
        }];
      }
    }

    const sessionParams = {
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: mode,
      success_url: `${origin}/?checkout_session_id={CHECKOUT_SESSION_ID}&plan=${plan}&status=success`,
      cancel_url: `${origin}/#pricing?status=cancelled`,
      metadata: {
        plan: plan,
        app: "peekaboo"
      },
      allow_promotion_codes: true
    };

    if (customerEmail) {
      sessionParams.customer_email = customerEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({
      url: session.url,
      sessionId: session.id,
      plan: plan
    });

  } catch (err) {
    console.error("[STRIPE_CHECKOUT_ERROR]", err);
    return res.status(500).json({
      error: "CHECKOUT_CREATION_FAILED",
      message: err.message
    });
  }
};
