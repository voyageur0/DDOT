const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const { User } = require('../models-node');

// Configuration de la stratégie locale
passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
  },
  async (email, password, done) => {
    try {
      // Rechercher l'utilisateur par email
      const user = await User.findOne({ where: { email } });
      
      if (!user) {
        return done(null, false, { message: 'Email ou mot de passe incorrect' });
      }
      
      // Vérifier le mot de passe
      const isValid = await user.checkPassword(password);
      
      if (!isValid) {
        return done(null, false, { message: 'Email ou mot de passe incorrect' });
      }
      
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

// Sérialisation de l'utilisateur pour la session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Désérialisation de l'utilisateur
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

module.exports = passport; 