// api/stripe-webhook.js
// Endpoint Serverless Vercel pour la réception et validation sécurisée des événements Stripe

const Stripe = require("stripe");

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey) {
    return res.status(500).json({ error: "STRIPE_SECRET_KEY_MISSING" });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

  let event;

  try {
    const rawBody = await buffer(req);

    if (webhookSecret) {
      const signature = req.headers["stripe-signature"];
      if (!signature) {
        return res.status(400).json({ error: "En-tête stripe-signature manquant." });
      }
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } else {
      // Mode développement / test sans secret de webhook configuré
      console.warn("[WEBHOOK_WARNING] STRIPE_WEBHOOK_SECRET manquant : parsing direct sans vérification de signature.");
      event = JSON.parse(rawBody.toString("utf8"));
    }
  } catch (err) {
    console.error("[WEBHOOK_SIGNATURE_VERIFICATION_FAILED]", err.message);
    return res.status(400).json({ error: `Signature webhook invalide : ${err.message}` });
  }

  // Traitement des événements demandés
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const plan = session.metadata ? session.metadata.plan : "unknown";
        const customerId = session.customer;
        const customerEmail = session.customer_details ? session.customer_details.email : null;
        console.log(`[STRIPE] checkout.session.completed pour plan=${plan}, customer=${customerId}, email=${customerEmail}`);
        // Ici : émission d'état d'abonnement actif
        break;
      }

      case "customer.subscription.created": {
        const sub = event.data.object;
        console.log(`[STRIPE] subscription.created id=${sub.id}, status=${sub.status}, customer=${sub.customer}`);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        console.log(`[STRIPE] subscription.updated id=${sub.id}, status=${sub.status}, cancel_at_period_end=${sub.cancel_at_period_end}`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        console.log(`[STRIPE] subscription.deleted id=${sub.id}, customer=${sub.customer}`);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;
        console.log(`[STRIPE] invoice.paid id=${invoice.id}, amount_paid=${invoice.amount_paid}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        console.warn(`[STRIPE] invoice.payment_failed id=${invoice.id}, customer=${invoice.customer}`);
        break;
      }

      default:
        console.log(`[STRIPE] Événement ignoré : ${event.type}`);
    }

    return res.status(200).json({ received: true, eventType: event.type });

  } catch (err) {
    console.error("[STRIPE_WEBHOOK_PROCESSING_ERROR]", err);
    return res.status(500).json({ error: "Erreur lors du traitement de l'événement." });
  }
};
