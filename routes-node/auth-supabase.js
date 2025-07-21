const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { createContextLogger } = require('../utils/logger');

const logger = createContextLogger('AUTH_SUPABASE');

// Route pour initier la connexion Google
router.get('/google', async (req, res) => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `http://localhost:3001/api/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });

    if (error) {
      logger.error('Erreur OAuth Google', { error: error.message });
      return res.status(400).json({ error: error.message });
    }

    // Rediriger vers l'URL d'authentification Google
    res.redirect(data.url);
  } catch (error) {
    logger.error('Erreur lors de l\'initialisation OAuth', { error: error.message });
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Route de callback après authentification Google
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.redirect('/?error=authentication_failed');
    }

    // Échanger le code contre une session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      logger.error('Erreur lors de l\'échange de code', { error: error.message });
      return res.redirect('/?error=authentication_failed');
    }

    const { user, session } = data;

    // Stocker la session dans le cookie
    res.cookie('supabase-session', JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 heures
      sameSite: 'lax'
    });

    logger.info('Utilisateur connecté avec succès', { 
      userId: user.id, 
      email: user.email 
    });

    // Rediriger vers le dashboard ou la page d'accueil
    res.redirect('/dashboard');
  } catch (error) {
    logger.error('Erreur lors du callback', { error: error.message });
    res.redirect('/?error=authentication_failed');
  }
});

// Route pour la déconnexion
router.post('/logout', async (req, res) => {
  try {
    // Supprimer le cookie de session
    res.clearCookie('supabase-session');

    // Optionnel : invalider la session côté Supabase
    const sessionCookie = req.cookies['supabase-session'];
    if (sessionCookie) {
      try {
        const session = JSON.parse(sessionCookie);
        await supabase.auth.admin.signOut(session.access_token);
      } catch (e) {
        // Ignorer les erreurs de déconnexion côté serveur
      }
    }

    logger.info('Utilisateur déconnecté');
    res.json({ success: true, message: 'Déconnexion réussie' });
  } catch (error) {
    logger.error('Erreur lors de la déconnexion', { error: error.message });
    res.status(500).json({ error: 'Erreur lors de la déconnexion' });
  }
});

// Route pour obtenir les informations de l'utilisateur connecté
router.get('/user', async (req, res) => {
  try {
    const sessionCookie = req.cookies['supabase-session'];
    
    if (!sessionCookie) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const session = JSON.parse(sessionCookie);
    
    // Vérifier que la session est toujours valide
    const { data: { user }, error } = await supabase.auth.getUser(session.access_token);

    if (error || !user) {
      res.clearCookie('supabase-session');
      return res.status(401).json({ error: 'Session expirée' });
    }

    // Retourner les informations de l'utilisateur (sans données sensibles)
    res.json({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.user_metadata?.full_name,
      avatar: user.user_metadata?.avatar_url,
      role: user.user_metadata?.role || 'user',
      created_at: user.created_at
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération utilisateur', { error: error.message });
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Route pour créer un compte administrateur (développement uniquement)
router.post('/create-admin', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Route disponible uniquement en développement' });
  }

  try {
    const { email, password = 'Admin123!', name = 'Administrateur DDOT' } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }

    // Créer l'utilisateur via l'API Admin
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: 'admin',
        created_by: 'system'
      }
    });

    if (error) {
      logger.error('Erreur création admin', { error: error.message });
      return res.status(400).json({ error: error.message });
    }

    logger.info('Compte administrateur créé', { 
      userId: data.user.id, 
      email: data.user.email 
    });

    res.json({
      success: true,
      message: 'Compte administrateur créé avec succès',
      user: {
        id: data.user.id,
        email: data.user.email,
        role: 'admin'
      },
      credentials: {
        email,
        password
      }
    });
  } catch (error) {
    logger.error('Erreur lors de la création admin', { error: error.message });
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Middleware pour vérifier l'authentification
function requireAuth(req, res, next) {
  const sessionCookie = req.cookies['supabase-session'];
  
  if (!sessionCookie) {
    return res.status(401).json({ error: 'Authentification requise' });
  }

  try {
    const session = JSON.parse(sessionCookie);
    req.user = session.user;
    req.session = session;
    next();
  } catch (error) {
    res.clearCookie('supabase-session');
    return res.status(401).json({ error: 'Session invalide' });
  }
}

// Middleware pour vérifier les droits administrateur
function requireAdmin(req, res, next) {
  if (!req.user || req.user.user_metadata?.role !== 'admin') {
    return res.status(403).json({ error: 'Droits administrateur requis' });
  }
  next();
}

module.exports = {
  router,
  requireAuth,
  requireAdmin
};