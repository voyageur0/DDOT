// Gestionnaire d'authentification côté client
class AuthManager {
  constructor() {
    this.user = null;
    this.isAuthenticated = false;
    this.listeners = [];
    
    // Initialiser l'état d'authentification
    this.checkAuthStatus();
  }

  // Vérifier l'état d'authentification actuel
  async checkAuthStatus() {
    try {
      const response = await fetch('/api/auth/user', {
        credentials: 'include'
      });

      if (response.ok) {
        this.user = await response.json();
        this.isAuthenticated = true;
      } else {
        this.user = null;
        this.isAuthenticated = false;
      }
      
      this.notifyListeners();
      this.updateUI();
    } catch (error) {
      console.error('Erreur lors de la vérification auth:', error);
      this.user = null;
      this.isAuthenticated = false;
      this.notifyListeners();
      this.updateUI();
    }
  }

  // Connexion via Google
  signInWithGoogle() {
    window.location.href = '/api/auth/google';
  }

  // Déconnexion
  async signOut() {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        this.user = null;
        this.isAuthenticated = false;
        this.notifyListeners();
        this.updateUI();
        
        // Rediriger vers la page d'accueil
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  }

  // Créer un compte administrateur (développement uniquement)
  async createAdminAccount(email, password, name) {
    try {
      const response = await fetch('/api/auth/create-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, name })
      });

      const data = await response.json();
      
      if (response.ok) {
        return { success: true, data };
      } else {
        throw new Error(data.error || 'Erreur lors de la création');
      }
    } catch (error) {
      console.error('Erreur création admin:', error);
      return { success: false, error: error.message };
    }
  }

  // Ajouter un listener pour les changements d'état
  addAuthListener(callback) {
    this.listeners.push(callback);
  }

  // Notifier tous les listeners
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.user, this.isAuthenticated);
      } catch (error) {
        console.error('Erreur dans le listener auth:', error);
      }
    });
  }

  // Mettre à jour l'interface utilisateur
  updateUI() {
    // Mettre à jour les boutons de connexion/déconnexion
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const userMenu = document.getElementById('userMenu');

    if (this.isAuthenticated && this.user) {
      // Utilisateur connecté
      if (loginBtn) loginBtn.style.display = 'none';
      if (signupBtn) signupBtn.style.display = 'none';
      
      // Créer ou mettre à jour le menu utilisateur
      this.createUserMenu();
    } else {
      // Utilisateur non connecté
      if (loginBtn) {
        loginBtn.style.display = 'inline-flex';
        loginBtn.onclick = () => this.signInWithGoogle();
      }
      if (signupBtn) {
        signupBtn.style.display = 'inline-flex';
        signupBtn.onclick = () => this.signInWithGoogle();
      }
      if (userMenu) userMenu.remove();
    }
  }

  // Créer le menu utilisateur
  createUserMenu() {
    const navbarActions = document.querySelector('.navbar-actions');
    if (!navbarActions) return;

    // Supprimer l'ancien menu s'il existe
    const existingMenu = document.getElementById('userMenu');
    if (existingMenu) existingMenu.remove();

    // Créer le nouveau menu
    const userMenu = document.createElement('div');
    userMenu.id = 'userMenu';
    userMenu.className = 'user-menu';
    
    userMenu.innerHTML = `
      <div class="user-avatar" onclick="toggleUserDropdown()">
        <img src="${this.user.avatar || '/images/default-avatar.svg'}" 
             alt="${this.user.name || this.user.email}"
             onerror="this.src='/images/default-avatar.svg'">
        <span class="user-name">${this.user.name || this.user.email.split('@')[0]}</span>
        <svg class="dropdown-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      <div class="user-dropdown" id="userDropdown" style="display: none;">
        <div class="user-info">
          <div class="user-email">${this.user.email}</div>
          <div class="user-role">${this.getRoleLabel(this.user.role)}</div>
        </div>
        <div class="dropdown-divider"></div>
        <a href="/dashboard" class="dropdown-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="9"/>
            <rect x="14" y="3" width="7" height="5"/>
            <rect x="14" y="12" width="7" height="9"/>
            <rect x="3" y="16" width="7" height="5"/>
          </svg>
          Dashboard
        </a>
        ${this.user.role === 'admin' ? `
          <a href="/admin" class="dropdown-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
            Administration
          </a>
        ` : ''}
        <div class="dropdown-divider"></div>
        <button class="dropdown-item" onclick="auth.signOut()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Se déconnecter
        </button>
      </div>
    `;

    navbarActions.appendChild(userMenu);
  }

  // Obtenir le label du rôle
  getRoleLabel(role) {
    const roles = {
      'admin': 'Administrateur',
      'premium': 'Premium',
      'user': 'Utilisateur'
    };
    return roles[role] || 'Utilisateur';
  }

  // Vérifier si l'utilisateur a un rôle spécifique
  hasRole(role) {
    return this.user && this.user.role === role;
  }

  // Vérifier si l'utilisateur est administrateur
  isAdmin() {
    return this.hasRole('admin');
  }

  // Vérifier si l'utilisateur est premium
  isPremium() {
    return this.hasRole('premium') || this.hasRole('admin');
  }
}

// Fonction pour toggle le dropdown utilisateur
function toggleUserDropdown() {
  const dropdown = document.getElementById('userDropdown');
  if (dropdown) {
    const isVisible = dropdown.style.display !== 'none';
    dropdown.style.display = isVisible ? 'none' : 'block';
  }
}

// Fermer le dropdown si on clique ailleurs
document.addEventListener('click', function(event) {
  const userMenu = document.getElementById('userMenu');
  const dropdown = document.getElementById('userDropdown');
  
  if (dropdown && userMenu && !userMenu.contains(event.target)) {
    dropdown.style.display = 'none';
  }
});

// Instance globale du gestionnaire d'authentification
const auth = new AuthManager();

// Fonction utilitaire pour créer un compte admin en développement
async function createDevAdminAccount() {
  if (window.location.hostname !== 'localhost') {
    alert('Cette fonction n\'est disponible qu\'en développement local');
    return;
  }

  const email = prompt('Email administrateur:');
  if (!email) return;

  const name = prompt('Nom complet:', 'Administrateur DDOT');
  if (!name) return;

  try {
    const result = await auth.createAdminAccount(email, 'Admin123!', name);
    
    if (result.success) {
      alert(`Compte administrateur créé avec succès!\n\nEmail: ${result.data.credentials.email}\nMot de passe: ${result.data.credentials.password}\n\nVous pouvez maintenant vous connecter avec Google.`);
    } else {
      alert(`Erreur: ${result.error}`);
    }
  } catch (error) {
    alert(`Erreur: ${error.message}`);
  }
}

// Exposer les fonctions globalement pour le debugging en développement
if (window.location.hostname === 'localhost') {
  window.createDevAdminAccount = createDevAdminAccount;
  window.auth = auth;
}