// Nouveau système de recherche et autocomplétion - Version propre
// Utilise directement l'API GeoAdmin sans complexité

class SearchSystem {
  constructor() {
    this.searchInput = null;
    this.suggestionsContainer = null;
    this.isVisible = false;
    this.currentSuggestions = [];
    this.selectedIndex = -1;
    this.debounceTimer = null;
    
    this.init();
  }
  
  init() {
    // Attendre que le DOM soit prêt
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }
  
  setup() {
    this.searchInput = document.getElementById('heroSearchInput');
    if (!this.searchInput) {
      console.error('Input de recherche non trouvé');
      return;
    }
    
    this.createSuggestionsContainer();
    this.bindEvents();
    
    console.log('SearchSystem initialisé avec succès');
  }
  
  createSuggestionsContainer() {
    // Supprimer tout ancien conteneur
    const oldContainer = document.querySelector('.search-suggestions');
    if (oldContainer) {
      oldContainer.remove();
    }
    
    // Créer le nouveau conteneur
    this.suggestionsContainer = document.createElement('div');
    this.suggestionsContainer.className = 'search-suggestions';
    this.suggestionsContainer.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #e1e4e8;
      border-radius: 12px;
      margin-top: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      max-height: 300px;
      overflow-y: auto;
      z-index: 1000;
      display: none;
    `;
    
    // Ajouter au conteneur parent de l'input
    const searchContainer = this.searchInput.closest('.search-container-modern');
    if (searchContainer) {
      searchContainer.appendChild(this.suggestionsContainer);
      // S'assurer que le conteneur parent a position relative
      searchContainer.style.position = 'relative';
    }
  }
  
  bindEvents() {
    // Événement de saisie avec debounce
    this.searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      this.handleInput(query);
    });
    
    // Navigation au clavier
    this.searchInput.addEventListener('keydown', (e) => {
      this.handleKeydown(e);
    });
    
    // Fermer en cliquant à l'extérieur
    document.addEventListener('click', (e) => {
      if (!this.searchInput.contains(e.target) && 
          !this.suggestionsContainer.contains(e.target)) {
        this.hideSuggestions();
      }
    });
    
    // Focus management
    this.searchInput.addEventListener('focus', () => {
      if (this.currentSuggestions.length > 0) {
        this.showSuggestions();
      }
    });
  }
  
  handleInput(query) {
    // Clear le timer précédent
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    if (query.length < 2) {
      this.hideSuggestions();
      return;
    }
    
    // Debounce de 300ms
    this.debounceTimer = setTimeout(() => {
      this.searchGeoAdmin(query);
    }, 300);
  }
  
  async searchGeoAdmin(query) {
    try {
      this.showLoading();
      
      // URL API GeoAdmin correcte pour parcelles, adresses et lieux
      const url = `https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=${encodeURIComponent(query)}&origins=parcel,address,gg25&type=locations&limit=15&sr=4326`;
      
      console.log('Recherche URL:', url);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Données reçues:', data);
      
      // Filtrer pour le Valais seulement
      const suggestions = this.filterValaisSuggestions(data.results || []);
      
      this.currentSuggestions = suggestions;
      this.selectedIndex = -1;
      
      if (suggestions.length > 0) {
        this.renderSuggestions(suggestions);
        this.showSuggestions();
      } else {
        this.showNoResults();
      }
      
    } catch (error) {
      console.error('Erreur de recherche:', error);
      this.showError();
    }
  }
  
  filterValaisSuggestions(results) {
    const valaisKeywords = [
      'vs', 'valais', 'wallis', 'sion', 'sierre', 'martigny', 'monthey', 
      'brig', 'visp', 'savièse', 'vétroz', 'ardon', 'chamoson', 'conthey'
    ];
    
    return results.filter(result => {
      const attrs = result.attrs || {};
      const label = (attrs.label || '').toLowerCase();
      const detail = (attrs.detail || '').toLowerCase();
      
      return valaisKeywords.some(keyword => 
        label.includes(keyword) || detail.includes(keyword)
      );
    }).slice(0, 8); // Limiter à 8 résultats
  }
  
  renderSuggestions(suggestions) {
    const html = suggestions.map((suggestion, index) => {
      const attrs = suggestion.attrs || {};
      const label = this.cleanHtml(attrs.label || 'Résultat');
      const detail = this.cleanHtml(attrs.detail || '');
      
      // Essayer d'extraire l'EGRID pour l'affichage
      const egrid = this.extractEGRIDFromAttrs(attrs);
      
      return `
        <div class="suggestion-item" data-index="${index}">
          <div class="suggestion-content">
            <div class="suggestion-title">${this.escapeHtml(label)}</div>
            ${detail ? `<div class="suggestion-detail">${this.escapeHtml(detail)}</div>` : ''}
            ${egrid ? `<div class="suggestion-egrid">EGRID: ${this.escapeHtml(egrid)}</div>` : ''}
          </div>
          <div class="suggestion-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        </div>
      `;
    }).join('');
    
    this.suggestionsContainer.innerHTML = html;
    
    // Ajouter les événements de clic
    this.suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index);
        this.selectSuggestion(index);
      });
    });
  }
  
  extractEGRIDFromAttrs(attrs) {
    // Essayer d'extraire l'EGRID depuis les attributs
    const possibleEgrids = [
      attrs.featureId,
      attrs.id,
      attrs.EGRID,
      attrs.egrid,
      attrs.feature_id
    ];
    
    for (const egrid of possibleEgrids) {
      if (egrid && egrid !== '' && egrid !== 'undefined') {
        return egrid;
      }
    }
    
    // Essayer d'extraire depuis le label - avec ou sans espaces
    const label = attrs.label || '';
    
    // Essayer d'abord le format avec espaces: CH 1234 5678 9012
    const egridWithSpacesMatch = label.match(/CH\s+(\d{4})\s+(\d{4})\s+(\d{4})/);
    if (egridWithSpacesMatch) {
      return `CH${egridWithSpacesMatch[1]}${egridWithSpacesMatch[2]}${egridWithSpacesMatch[3]}`;
    }
    
    // Essayer ensuite le format sans espaces: CH123456789012 (12 chiffres)
    const egridMatch = label.match(/CH\d{12}/);
    if (egridMatch) {
      return egridMatch[0];
    }
    
    // Essayer aussi le format avec 9 chiffres (au cas où)
    const egridMatch9 = label.match(/CH\d{9}/);
    if (egridMatch9) {
      return egridMatch9[0];
    }
    
    return null;
  }
  
  showLoading() {
    this.suggestionsContainer.innerHTML = `
      <div class="suggestion-loading">
        <div class="loading-spinner"></div>
        <span>Recherche en cours...</span>
      </div>
    `;
    this.showSuggestions();
  }
  
  showNoResults() {
    this.suggestionsContainer.innerHTML = `
      <div class="suggestion-empty">
        <span>Aucun résultat trouvé en Valais</span>
      </div>
    `;
    this.showSuggestions();
  }
  
  showError() {
    this.suggestionsContainer.innerHTML = `
      <div class="suggestion-error">
        <span>Erreur de recherche. Réessayez.</span>
      </div>
    `;
    this.showSuggestions();
  }
  
  showSuggestions() {
    this.suggestionsContainer.style.display = 'block';
    this.isVisible = true;
  }
  
  hideSuggestions() {
    this.suggestionsContainer.style.display = 'none';
    this.isVisible = false;
    this.selectedIndex = -1;
  }
  
  handleKeydown(e) {
    if (!this.isVisible) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.currentSuggestions.length - 1);
        this.updateSelection();
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
        this.updateSelection();
        break;
        
      case 'Enter':
        e.preventDefault();
        if (this.selectedIndex >= 0) {
          this.selectSuggestion(this.selectedIndex);
        }
        break;
        
      case 'Escape':
        this.hideSuggestions();
        break;
    }
  }
  
  updateSelection() {
    const items = this.suggestionsContainer.querySelectorAll('.suggestion-item');
    items.forEach((item, index) => {
      item.classList.toggle('selected', index === this.selectedIndex);
    });
    
    // Scroll vers l'élément sélectionné
    if (this.selectedIndex >= 0) {
      const selectedItem = items[this.selectedIndex];
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }
  
  selectSuggestion(index) {
    const suggestion = this.currentSuggestions[index];
    if (!suggestion) return;
    
    const attrs = suggestion.attrs || {};
    const label = this.cleanHtml(attrs.label || '');
    
    // Mettre à jour l'input
    this.searchInput.value = label;
    
    // Cacher les suggestions
    this.hideSuggestions();
    
    // Déclencher la recherche
    this.triggerSearch(suggestion);
  }
  
  triggerSearch(suggestion) {
    // S'assurer que l'EGRID est inclus dans les données
    const attrs = suggestion.attrs || {};
    const egrid = this.extractEGRIDFromAttrs(attrs);
    
    // Ajouter l'EGRID aux données si trouvé
    if (egrid) {
      attrs.egrid = egrid;
      attrs.EGRID = egrid;
      attrs.featureId = egrid;
    }
    
    // Créer un événement personnalisé avec les données enrichies
    const event = new CustomEvent('search-selected', {
      detail: {
        suggestion: suggestion,
        data: attrs
      }
    });
    
    this.searchInput.dispatchEvent(event);
  }
  
  cleanHtml(text) {
    if (!text) return '';
    // Supprimer toutes les balises HTML (y compris <b>, <i>, etc.)
    return text.replace(/<[^>]*>/g, '').trim();
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Méthodes publiques
  destroy() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this.suggestionsContainer) {
      this.suggestionsContainer.remove();
    }
  }
}

// CSS pour les suggestions
const searchCSS = `
  .search-suggestions {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  }
  
  .suggestion-item {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    cursor: pointer;
    border-bottom: 1px solid #f0f0f0;
    transition: background-color 0.2s ease;
  }
  
  .suggestion-item:last-child {
    border-bottom: none;
  }
  
  .suggestion-item:hover,
  .suggestion-item.selected {
    background-color: #f8f9fa;
  }
  
  .suggestion-content {
    flex: 1;
  }
  
  .suggestion-title {
    font-size: 14px;
    font-weight: 500;
    color: #1a1a1a;
    margin-bottom: 2px;
  }
  
  .suggestion-detail {
    font-size: 12px;
    color: #666;
  }
  
  .suggestion-egrid {
    font-size: 11px;
    color: #0070f3;
    font-weight: 600;
    font-family: monospace;
    margin-top: 2px;
    background: rgba(0, 112, 243, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    display: inline-block;
  }
  
  .suggestion-icon {
    margin-left: 12px;
    color: #0070f3;
    opacity: 0.7;
  }
  
  .suggestion-loading,
  .suggestion-empty,
  .suggestion-error {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    font-size: 14px;
    color: #666;
    gap: 8px;
  }
  
  .suggestion-error {
    color: #e74c3c;
  }
  
  .loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #0070f3;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// Injecter le CSS
if (!document.getElementById('search-system-styles')) {
  const style = document.createElement('style');
  style.id = 'search-system-styles';
  style.textContent = searchCSS;
  document.head.appendChild(style);
}

// Export
window.SearchSystem = SearchSystem;