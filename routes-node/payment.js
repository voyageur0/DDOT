const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_your_stripe_secret_key');
const { User } = require('../models-node');
const router = express.Router();

// Middleware pour vérifier l'authentification
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Non authentifié' });
}

// Créer une session de checkout
router.post('/create-checkout-session', ensureAuthenticated, async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Abonnement Premium - Analyse Urbanisme IA',
            description: 'Accès illimité aux fonctionnalités IA'
          },
          unit_amount: 1999, // 19.99€
          recurring: {
            interval: 'month'
          }
        },
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/dashboard`,
      client_reference_id: req.user.id.toString()
    });
    
    res.json({ checkoutUrl: session.url });
  } catch (error) {
    console.error('Erreur création session Stripe:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la session de paiement' });
  }
});

// Webhook Stripe
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_your_stripe_webhook_secret';
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Erreur signature webhook:', err);
    return res.status(400).json({ error: 'Signature invalide' });
  }
  
  // Gérer les événements
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      
      // Mettre à jour l'utilisateur
      try {
        const userId = parseInt(session.client_reference_id);
        const user = await User.findByPk(userId);
        
        if (user) {
          await user.update({
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            isPremium: true
          });
          console.log(`Utilisateur ${userId} passé en premium`);
        }
      } catch (error) {
        console.error('Erreur mise à jour utilisateur:', error);
      }
      break;
      
    case 'customer.subscription.deleted':
      const subscription = event.data.object;
      
      // Retirer le statut premium
      try {
        const user = await User.findOne({
          where: { stripeSubscriptionId: subscription.id }
        });
        
        if (user) {
          await user.update({
            isPremium: false,
            stripeSubscriptionId: null
          });
          console.log(`Utilisateur ${user.id} n'est plus premium`);
        }
      } catch (error) {
        console.error('Erreur mise à jour utilisateur:', error);
      }
      break;
      
    case 'customer.subscription.updated':
      // Gérer les mises à jour d'abonnement si nécessaire
      console.log('Abonnement mis à jour:', event.data.object.id);
      break;
      
    default:
      console.log(`Événement Stripe non géré: ${event.type}`);
  }
  
  res.json({ received: true });
});

// Récupérer le statut de l'abonnement
router.get('/subscription-status', ensureAuthenticated, async (req, res) => {
  try {
    if (!req.user.stripeSubscriptionId) {
      return res.json({
        hasSubscription: false,
        isPremium: false
      });
    }
    
    const subscription = await stripe.subscriptions.retrieve(req.user.stripeSubscriptionId);
    
    res.json({
      hasSubscription: true,
      isPremium: req.user.isPremium,
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });
  } catch (error) {
    console.error('Erreur récupération abonnement:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du statut' });
  }
});

// Annuler l'abonnement
router.post('/cancel-subscription', ensureAuthenticated, async (req, res) => {
  try {
    if (!req.user.stripeSubscriptionId) {
      return res.status(400).json({ error: 'Aucun abonnement actif' });
    }
    
    const subscription = await stripe.subscriptions.update(
      req.user.stripeSubscriptionId,
      { cancel_at_period_end: true }
    );
    
    res.json({
      message: 'Abonnement annulé, restera actif jusqu\'à la fin de la période',
      cancelAt: subscription.cancel_at
    });
  } catch (error) {
    console.error('Erreur annulation abonnement:', error);
    res.status(500).json({ error: 'Erreur lors de l\'annulation' });
  }
});

// Réactiver l'abonnement
router.post('/reactivate-subscription', ensureAuthenticated, async (req, res) => {
  try {
    if (!req.user.stripeSubscriptionId) {
      return res.status(400).json({ error: 'Aucun abonnement à réactiver' });
    }
    
    const subscription = await stripe.subscriptions.update(
      req.user.stripeSubscriptionId,
      { cancel_at_period_end: false }
    );
    
    res.json({
      message: 'Abonnement réactivé',
      status: subscription.status
    });
  } catch (error) {
    console.error('Erreur réactivation abonnement:', error);
    res.status(500).json({ error: 'Erreur lors de la réactivation' });
  }
});

module.exports = router; 