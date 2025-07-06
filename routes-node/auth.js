const express = require('express');
const passport = require('passport');
const { User } = require('../models-node');
const router = express.Router();

// Route d'inscription
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email déjà enregistré' });
    }
    
    // Créer le nouvel utilisateur
    const user = await User.create({
      email,
      passwordHash: password // sera hashé automatiquement par le hook
    });
    
    // Connecter automatiquement l'utilisateur
    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Erreur lors de la connexion' });
      }
      
      res.json({
        message: 'Inscription réussie',
        user: {
          id: user.id,
          email: user.email,
          isPremium: user.isPremium
        }
      });
    });
    
  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({ error: 'Erreur lors de l\'inscription' });
  }
});

// Route de connexion
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la connexion' });
    }
    
    if (!user) {
      return res.status(401).json({ error: info.message || 'Identifiants incorrects' });
    }
    
    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Erreur lors de la connexion' });
      }
      
      res.json({
        message: 'Connexion réussie',
        user: {
          id: user.id,
          email: user.email,
          isPremium: user.isPremium
        }
      });
    });
  })(req, res, next);
});

// Route de déconnexion
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la déconnexion' });
    }
    res.json({ message: 'Déconnexion réussie' });
  });
});

// Route pour vérifier le statut de connexion
router.get('/status', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        isPremium: req.user.isPremium
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Pages de rendu pour l'authentification
router.get('/login-page', (req, res) => {
  res.render('login', { user: req.user });
});

router.get('/register-page', (req, res) => {
  res.render('register', { user: req.user });
});

module.exports = router; 