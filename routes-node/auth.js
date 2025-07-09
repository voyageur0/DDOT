const express = require('express');
const passport = require('passport');
const { body, validationResult } = require('express-validator');
const { User } = require('../models-node');
const router = express.Router();

// Validation pour l'inscription
const validateRegister = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email invalide'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Le mot de passe doit contenir au moins 8 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial')
];

// Validation pour la connexion
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email invalide'),
  body('password')
    .notEmpty()
    .withMessage('Mot de passe requis')
];

// Route d'inscription
router.post('/register', validateRegister, async (req, res) => {
  try {
    // Vérifier les erreurs de validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Données invalides',
        details: errors.array()
      });
    }

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
router.post('/login', validateLogin, (req, res, next) => {
  // Vérifier les erreurs de validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Données invalides',
      details: errors.array()
    });
  }
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