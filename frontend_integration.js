// Script d'intégration du frontend avec l'API Urban-AI Valais IA
// Version mise à jour pour utiliser l'API /ia-constraints

// Configuration de l'API
const API_BASE_URL = 'http://localhost:8001';

// Variables globales pour stocker les données IA
let currentIAData = null;
let iaAnalysisInProgress = false;

// ===============================================
// FONCTIONS PRINCIPALES DE L'API IA
// ===============================================

// Fonction pour appeler la nouvelle API IA /ia-constraints
async function callIAConstraintsAPI(commune, parcelle) {
    try {
        console.log(`🤖 Analyse IA pour ${commune} parcelle ${parcelle}...`);
        
        const response = await fetch(`${API_BASE_URL}/ia-constraints`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                commune: commune,
                parcelle: parcelle
            })
        });
        
        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Erreur API IA: ${response.status} - ${errorData}`);
        }
        
        const data = await response.json();
        console.log('✅ Analyse IA complétée:', data);
        return data;
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'analyse IA:', error);
        throw error;
    }
}

// Fonction pour tester le système RAG
async function testRAGSystem(commune, query) {
    try {
        const response = await fetch(`${API_BASE_URL}/test-rag`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                commune: commune,
                query: query
            })
        });
        
        if (!response.ok) {
            throw new Error(`Erreur test RAG: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Erreur test RAG:', error);
        return null;
    }
}

// Fonction pour vérifier la santé de l'API
async function checkAPIHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        return response.ok;
    } catch (error) {
        return false;
    }
}

// ===============================================
// INTÉGRATION AVEC L'INTERFACE EXISTANTE
// ===============================================

// Fonction principale pour analyser une parcelle avec l'IA
async function analyzeParcelleWithIA(commune, parcelle) {
    if (iaAnalysisInProgress) {
        console.log('⏳ Analyse IA déjà en cours...');
        return;
    }
    
    iaAnalysisInProgress = true;
    
    try {
        // Afficher l'indicateur de chargement IA
        showIALoadingIndicator();
        
        // Appeler la nouvelle API IA
        const iaData = await callIAConstraintsAPI(commune, parcelle);
        
        if (iaData && iaData.success) {
            currentIAData = iaData;
            // Mettre à jour l'interface avec les données IA
            updateInterfaceWithIAData(iaData);
            showIASuccess();
        } else {
            throw new Error('Données IA invalides');
        }
        
    } catch (error) {
        console.error('❌ Erreur analyse IA:', error);
        showIAError(error.message);
    } finally {
        iaAnalysisInProgress = false;
        hideIALoadingIndicator();
    }
}

// Mettre à jour l'interface avec les données IA
function updateInterfaceWithIAData(iaData) {
    console.log('🎨 Mise à jour interface avec données IA...');
    
    // 1. Ajouter la section IA
    addIAAnalysisSection(iaData);
    
    // 2. Mettre à jour les boutons d'action
    updateActionButtonsWithIA(iaData);
    
    // 3. Ajouter l'indicateur de statut IA
    addIAStatusIndicator(true);
    
    // 4. Mettre à jour les informations de zone
    updateZoneInfoWithIA(iaData);
}

// Mettre à jour les boutons d'action avec les données IA
function updateActionButtonsWithIA(iaData) {
    console.log('🔧 Mise à jour des boutons d\'action avec données IA...');
    
    // Trouver ou créer le conteneur de boutons d'action IA
    let iaActionsContainer = document.getElementById('iaActionsContainer');
    if (!iaActionsContainer) {
        iaActionsContainer = document.createElement('div');
        iaActionsContainer.id = 'iaActionsContainer';
        iaActionsContainer.className = 'ia-actions-container';
        iaActionsContainer.style.cssText = `
            margin: 15px 0;
            padding: 15px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 10px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            justify-content: center;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        `;
        
        // Insérer après la section IA
        const iaSection = document.getElementById('iaAnalysisSection');
        if (iaSection && iaSection.parentNode) {
            iaSection.parentNode.insertBefore(iaActionsContainer, iaSection.nextSibling);
        }
    }
    
    // Créer les boutons d'action
    iaActionsContainer.innerHTML = `
        <button onclick="generateIAPDFReport()" 
                style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: 600; transition: all 0.3s;">
            📄 Générer Rapport PDF
        </button>
        <button onclick="testRAGForCurrentParcel()" 
                style="background: #17a2b8; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: 600; transition: all 0.3s;">
            🔍 Test RAG
        </button>
        <button onclick="window.open('${API_BASE_URL}/docs', '_blank')" 
                style="background: #6f42c1; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: 600; transition: all 0.3s;">
            📚 API Docs
        </button>
    `;
    
    // Ajouter les effets hover
    const buttons = iaActionsContainer.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
        });
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = 'none';
        });
    });
}

// Ajouter la section d'analyse IA
function addIAAnalysisSection(iaData) {
    const resultsContainer = document.getElementById('analysisResults');
    if (!resultsContainer) return;
    
    // Supprimer l'ancienne section IA si elle existe
    const existingIASection = document.getElementById('iaAnalysisSection');
    if (existingIASection) {
        existingIASection.remove();
    }
    
    // Créer la nouvelle section IA
    const iaSection = document.createElement('div');
    iaSection.id = 'iaAnalysisSection';
    iaSection.className = 'analysis-section';
    iaSection.innerHTML = createIASectionHTML(iaData);
    
    // Insérer au début des résultats
    resultsContainer.insertBefore(iaSection, resultsContainer.firstChild);
}

// Créer le HTML de la section IA
function createIASectionHTML(iaData) {
    const constraints = iaData.constraints || [];
    const metadata = iaData.metadata || {};
    const zoneInfo = iaData.zone_info || {};
    
    let constraintsHTML = '';
    if (constraints.length > 0) {
        constraintsHTML = constraints.map(constraint => `
            <div class="constraint-item" style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #28a745;">
                <div style="font-weight: 600; color: #28a745; margin-bottom: 5px;">
                    📋 ${constraint.type}
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 10px 0;">
                    ${constraint.indice_utilisation_sol ? `<div><strong>Indice:</strong> ${constraint.indice_utilisation_sol}</div>` : ''}
                    ${constraint.hauteur_max_batiment ? `<div><strong>Hauteur max:</strong> ${constraint.hauteur_max_batiment}</div>` : ''}
                    ${constraint.distance_limite ? `<div><strong>Distance limite:</strong> ${constraint.distance_limite}</div>` : ''}
                    ${constraint.surface_min ? `<div><strong>Surface min:</strong> ${constraint.surface_min}</div>` : ''}
                    ${constraint.places_stationnement ? `<div><strong>Stationnement:</strong> ${constraint.places_stationnement}</div>` : ''}
                </div>
                <div style="margin-top: 10px;">
                    <small style="color: #6c757d;">
                        <strong>Source:</strong> ${constraint.source_info} 
                        <span style="color: #28a745;">(Confiance: ${Math.round(constraint.confidence * 100)}%)</span>
                    </small>
                </div>
                <div style="margin-top: 5px;">
                    <small style="color: #6c757d; font-style: italic;">
                        ${constraint.remarques}
                    </small>
                </div>
            </div>
        `).join('');
    } else {
        constraintsHTML = `
            <div class="constraint-item" style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107;">
                <div style="color: #856404;">
                    ⚠️ Aucune contrainte spécifique trouvée dans les règlements disponibles.
                    <br><small>Consultez les autorités communales pour des informations détaillées.</small>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="section-header">
            <div class="section-icon" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%);">🤖</div>
            <h2 class="section-title">Analyse IA - Contraintes Urbaines</h2>
            <div id="iaStatusBadge" style="margin-left: auto; background: #28a745; color: white; padding: 5px 10px; border-radius: 15px; font-size: 0.8em;">
                ✅ Analysé par IA
            </div>
        </div>
        
        <div class="ia-zone-info" style="background: #e8f4fd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #0066cc;">
            <div style="font-weight: 600; color: #0066cc; margin-bottom: 10px;">
                🏛️ Zone d'affectation identifiée
            </div>
            <div style="font-size: 1.1em; color: #2c3e50;">
                ${zoneInfo.zone_name || 'Zone non identifiée'}
            </div>
            <small style="color: #6c757d;">Source: ${zoneInfo.source || 'RDPPF'}</small>
        </div>
        
        <div class="ia-constraints">
            <div style="font-weight: 600; margin-bottom: 15px; color: #2c3e50;">
                📊 Contraintes extraites (${constraints.length})
            </div>
            ${constraintsHTML}
        </div>
        
        <div class="ia-metadata" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <div style="font-weight: 600; margin-bottom: 10px; color: #495057;">
                📈 Métadonnées de l'analyse
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; font-size: 0.9em;">
                <div><strong>Documents RAG:</strong> ${metadata.rag_documents_found || 0}</div>
                <div><strong>Stratégies utilisées:</strong> ${metadata.search_strategies_used || 0}</div>
                <div><strong>Extraction hybride:</strong> ${metadata.hybrid_extraction_used ? '✅' : '❌'}</div>
                <div><strong>RDPPF:</strong> ${metadata.rdppf_extraction_success ? '✅' : '❌'}</div>
                <div><strong>Règlement:</strong> ${metadata.regulation_search_success ? '✅' : '❌'}</div>
            </div>
        </div>
        
        <div class="ia-actions" style="margin-top: 20px; text-align: center;">
            <button class="action-btn" onclick="generateIAPDFReport()" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); margin-right: 10px;">
                📄 Rapport PDF IA
            </button>
            <button class="action-btn" onclick="testRAGForCurrentParcel()" style="background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%);">
                🔍 Tester RAG
            </button>
        </div>
    `;
}

// Mettre à jour les informations de zone
function updateZoneInfoWithIA(iaData) {
    const zoneInfo = iaData.zone_info || {};
    
    // Mettre à jour les infos de zonage existantes
    const zoningInfo = document.getElementById('zoningInfo');
    if (zoningInfo && zoneInfo.zone_name) {
        const iaZoneHTML = `
            <div class="info-item" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white;">
                <div class="info-label">🤖 Zone IA</div>
                <div class="info-value">${zoneInfo.zone_name}</div>
            </div>
        `;
        zoningInfo.innerHTML = iaZoneHTML + zoningInfo.innerHTML;
    }
}

// ===============================================
// FONCTIONS D'INTERFACE UTILISATEUR
// ===============================================

// Indicateurs de chargement et statut
function showIALoadingIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'iaLoadingIndicator';
    indicator.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 1000;
        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
        color: white; padding: 15px 20px; border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        display: flex; align-items: center; gap: 10px;
    `;
    indicator.innerHTML = `
        <div class="loading-spinner" style="width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <span>🤖 Analyse IA en cours...</span>
        <style>
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
    `;
    document.body.appendChild(indicator);
}

function hideIALoadingIndicator() {
    const indicator = document.getElementById('iaLoadingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

function showIASuccess() {
    showNotification('✅ Analyse IA terminée avec succès!', 'success');
}

function showIAError(message) {
    showNotification(`❌ Erreur IA: ${message}`, 'error');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 1001;
        padding: 15px 20px; border-radius: 10px; color: white;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease-out;
    `;
    notification.innerHTML = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Ajouter l'indicateur de statut API
function addIAStatusIndicator(isOnline) {
    const existing = document.getElementById('iaApiStatus');
    if (existing) existing.remove();
    
    const indicator = document.createElement('div');
    indicator.id = 'iaApiStatus';
    indicator.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; z-index: 1000;
        background: ${isOnline ? '#28a745' : '#dc3545'};
        color: white; padding: 10px 15px; border-radius: 20px;
        font-size: 0.9em; box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    indicator.innerHTML = `🤖 API IA: ${isOnline ? 'En ligne' : 'Hors ligne'}`;
    document.body.appendChild(indicator);
}

// ===============================================
// FONCTIONS D'ACTION
// ===============================================

// Générer un rapport PDF avec les données IA
async function generateIAPDFReport() {
    if (!currentIAData) {
        alert('Aucune analyse IA disponible');
        return;
    }
    
    try {
        // Pour l'instant, utiliser jsPDF local avec les données IA
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // En-tête
        doc.setFontSize(20);
        doc.text('Rapport IA - Contraintes Urbaines', 20, 30);
        doc.setFontSize(12);
        doc.text(`${currentIAData.commune} - Parcelle ${currentIAData.parcelle}`, 20, 40);
        doc.text(`Généré le ${new Date().toLocaleDateString('fr-CH')}`, 20, 50);
        
        // Zone d'affectation
        const zoneInfo = currentIAData.zone_info || {};
        doc.setFontSize(16);
        doc.text('Zone d\'affectation', 20, 70);
        doc.setFontSize(11);
        doc.text(`Zone: ${zoneInfo.zone_name || 'Non identifiée'}`, 25, 85);
        doc.text(`Source: ${zoneInfo.source || 'RDPPF'}`, 25, 95);
        
        // Contraintes
        doc.setFontSize(16);
        doc.text('Contraintes identifiées', 20, 115);
        
        let yPos = 130;
        const constraints = currentIAData.constraints || [];
        
        if (constraints.length > 0) {
            constraints.forEach((constraint, index) => {
                doc.setFontSize(12);
                doc.text(`${index + 1}. ${constraint.type}`, 25, yPos);
                doc.setFontSize(10);
                
                if (constraint.indice_utilisation_sol) {
                    yPos += 10;
                    doc.text(`   Indice d'utilisation: ${constraint.indice_utilisation_sol}`, 30, yPos);
                }
                if (constraint.hauteur_max_batiment) {
                    yPos += 10;
                    doc.text(`   Hauteur maximale: ${constraint.hauteur_max_batiment}`, 30, yPos);
                }
                
                yPos += 10;
                doc.text(`   Source: ${constraint.source_info}`, 30, yPos);
                yPos += 10;
                doc.text(`   Confiance: ${Math.round(constraint.confidence * 100)}%`, 30, yPos);
                yPos += 15;
            });
        } else {
            doc.setFontSize(11);
            doc.text('Aucune contrainte spécifique trouvée', 25, yPos);
        }
        
        // Métadonnées
        const metadata = currentIAData.metadata || {};
        doc.setFontSize(16);
        doc.text('Métadonnées de l\'analyse', 20, yPos + 20);
        doc.setFontSize(10);
        doc.text(`Documents RAG trouvés: ${metadata.rag_documents_found || 0}`, 25, yPos + 35);
        doc.text(`Stratégies utilisées: ${metadata.search_strategies_used || 0}`, 25, yPos + 45);
        doc.text(`Extraction hybride: ${metadata.hybrid_extraction_used ? 'Oui' : 'Non'}`, 25, yPos + 55);
        
        // Sauvegarder
        doc.save(`rapport-ia-${currentIAData.commune}-${currentIAData.parcelle}-${new Date().toISOString().slice(0,10)}.pdf`);
        
    } catch (error) {
        console.error('Erreur génération PDF:', error);
        alert('Erreur lors de la génération du PDF');
    }
}

// Tester le système RAG pour la parcelle actuelle
async function testRAGForCurrentParcel() {
    if (!currentIAData) {
        alert('Aucune analyse IA disponible');
        return;
    }
    
    const query = prompt('Entrez votre requête de test RAG:', 'indice utilisation zone villa');
    if (!query) return;
    
    try {
        const ragResult = await testRAGSystem(currentIAData.commune, query);
        if (ragResult && ragResult.success) {
            const documents = ragResult.documents || [];
            let message = `✅ Test RAG réussi!\n\n`;
            message += `Documents trouvés: ${documents.length}\n\n`;
            
            if (documents.length > 0) {
                message += 'Extraits:\n';
                documents.slice(0, 2).forEach((doc, i) => {
                    const content = doc.content || '';
                    message += `${i + 1}. ${content.substring(0, 100)}...\n\n`;
                });
            }
            
            alert(message);
        } else {
            alert('❌ Échec du test RAG');
        }
    } catch (error) {
        alert(`❌ Erreur test RAG: ${error.message}`);
    }
}

// ===============================================
// INITIALISATION
// ===============================================

// Fonction d'initialisation
async function initIAIntegration() {
    console.log('🚀 Initialisation de l\'intégration IA...');
    
    // Vérifier la santé de l'API
    const isAPIOnline = await checkAPIHealth();
    addIAStatusIndicator(isAPIOnline);
    
    if (isAPIOnline) {
        console.log('✅ API IA disponible');
        
        // Ajouter le bouton d'analyse IA à l'interface existante
        addIAAnalysisButton();
        
    } else {
        console.warn('⚠️ API IA non disponible');
        showNotification('⚠️ API IA non disponible - Vérifiez que le serveur backend est démarré', 'error');
    }
}

// Ajouter le bouton d'analyse IA
function addIAAnalysisButton() {
    // Chercher le conteneur d'actions existant
    let actionsContainer = document.querySelector('.actions-container');
    
    // Si pas trouvé, créer un conteneur temporaire
    if (!actionsContainer) {
        actionsContainer = document.createElement('div');
        actionsContainer.className = 'actions-container';
        actionsContainer.style.cssText = 'text-align: center; margin: 20px 0;';
        
        // L'ajouter après les résultats si possible
        const results = document.getElementById('analysisResults');
        if (results && results.parentNode) {
            results.parentNode.insertBefore(actionsContainer, results.nextSibling);
        }
    }
    
    // Ajouter le bouton IA
    const iaButton = document.createElement('button');
    iaButton.id = 'iaAnalysisBtn';
    iaButton.className = 'action-btn';
    iaButton.style.cssText = `
        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
        color: white; border: none; padding: 12px 20px;
        border-radius: 25px; font-size: 1em; cursor: pointer;
        margin: 10px; transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
    `;
    iaButton.innerHTML = '🤖 Analyse IA des Contraintes';
    iaButton.onclick = () => {
        console.log('🤖 Bouton IA cliqué - Debug des données disponibles...');
        
        // Debug : afficher toutes les données disponibles
        console.log('🔍 Données currentData:', window.currentData);
        console.log('🔍 Valeur input recherche:', document.getElementById('searchInput')?.value);
        console.log('🔍 Contenu ownersInfo:', document.getElementById('ownersInfo')?.innerHTML);
        
        // Récupérer la commune et parcelle depuis les données actuelles ou l'interface
        const commune = getCurrentCommune();
        const parcelle = getCurrentParcelle();
        
        console.log('📊 Résultats extraction:');
        console.log('   Commune:', commune);
        console.log('   Parcelle:', parcelle);
        
        if (commune && parcelle) {
            console.log('✅ Données trouvées, lancement analyse IA...');
            analyzeParcelleWithIA(commune, parcelle);
        } else {
            console.log('❌ Données manquantes pour l\'analyse IA');
            
            // Message d'erreur plus détaillé
            let errorMessage = 'Données manquantes pour l\'analyse IA:\n';
            if (!commune) errorMessage += '- Commune non détectée\n';
            if (!parcelle) errorMessage += '- Parcelle non détectée\n';
            errorMessage += '\nConsultez la console (F12) pour plus de détails.';
            
            alert(errorMessage);
        }
    };
    
    actionsContainer.appendChild(iaButton);
}

// Fonctions utilitaires pour récupérer les données actuelles
function getCurrentCommune() {
    console.log('🔍 Recherche de la commune...');
    
    // PRIORITÉ 1: Extraction depuis l'input de recherche (plus fiable)
    const searchInput = document.getElementById('searchInput');
    if (searchInput && searchInput.value) {
        const communes = ['Lens', 'Sion', 'Martigny', 'Chamoson', 'Monthey', 'Sierre', 'Collonges', 'Savièse', 'Fully', 'Vétroz', 'Conthey', 'Ayent', 'Nendaz', 'Bagnes', 'Val de Bagnes', 'Vollèges', 'Riddes', 'Saxon', 'Orsières', 'Bovernier', 'Leytron'];
        
        const searchValue = searchInput.value.toLowerCase();
        console.log('🔍 Recherche dans:', searchValue);
        
        for (const commune of communes) {
            if (searchValue.includes(commune.toLowerCase())) {
                console.log('✅ Commune extraite de la recherche:', commune);
                return commune;
            }
        }
    }
    
    // PRIORITÉ 2: Vérifier si currentData contient un nom valide (pas un ID)
    if (window.currentData && window.currentData.cadastral && window.currentData.cadastral.commune) {
        const communeData = window.currentData.cadastral.commune;
        
        // Vérifier si c'est un nom valide (lettres) et non un ID (nombres)
        if (communeData && isNaN(communeData) && communeData.length > 2) {
            console.log('✅ Commune trouvée dans currentData:', communeData);
            return communeData;
        } else {
            console.log('⚠️ currentData contient un ID numérique:', communeData, '- ignoré');
        }
    }
    
    // PRIORITÉ 3: Depuis l'affichage si c'est un nom valide
    const communeElements = document.querySelectorAll('#ownersInfo .info-value');
    for (const element of communeElements) {
        const text = element.textContent?.trim();
        if (text && isNaN(text) && text.length > 2) {
            console.log('✅ Commune trouvée dans l\'interface:', text);
            return text;
        }
    }
    
    console.log('❌ Commune non trouvée');
    return null;
}

function getCurrentParcelle() {
    console.log('🔍 Recherche de la parcelle...');
    
    // PRIORITÉ 1: Depuis l'input de recherche (plus fiable)
    const searchInput = document.getElementById('searchInput');
    if (searchInput && searchInput.value) {
        console.log('🔍 Recherche de parcelle dans:', searchInput.value);
        
        // Méthode intelligente : chercher un nombre après le nom de commune
        const communes = ['lens', 'sion', 'martigny', 'chamoson', 'monthey', 'sierre', 'collonges', 'savièse', 'fully', 'vétroz', 'conthey', 'ayent', 'nendaz', 'bagnes', 'val de bagnes', 'vollèges', 'riddes', 'saxon', 'orsières', 'bovernier', 'leytron'];
        const searchLower = searchInput.value.toLowerCase();
        
        for (const commune of communes) {
            if (searchLower.includes(commune)) {
                // Chercher le nombre qui suit le nom de la commune
                const communeIndex = searchLower.indexOf(commune);
                const afterCommune = searchInput.value.substring(communeIndex + commune.length);
                const parcelleMatch = afterCommune.match(/\d+/);
                
                if (parcelleMatch) {
                    console.log('✅ Parcelle extraite après commune:', parcelleMatch[0]);
                    return parcelleMatch[0];
                }
            }
        }
        
        // Fallback: prendre le dernier nombre trouvé
        const matches = searchInput.value.match(/\d+/g);
        if (matches && matches.length > 0) {
            const parcelle = matches[matches.length - 1];
            console.log('✅ Parcelle extraite (dernier nombre):', parcelle);
            return parcelle;
        }
    }
    
    // PRIORITÉ 2: Depuis les données globales si c'est un nombre valide
    if (window.currentData && window.currentData.parcel_number) {
        const parcelData = window.currentData.parcel_number;
        if (parcelData && !isNaN(parcelData)) {
            console.log('✅ Parcelle trouvée dans currentData:', parcelData);
            return parcelData.toString();
        }
    }
    
    console.log('❌ Parcelle non trouvée');
    return null;
}

// Initialiser quand le DOM est prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIAIntegration);
} else {
    initIAIntegration();
}

// Exporter les fonctions principales pour utilisation globale
window.urbanAI = {
    analyzeParcelleWithIA,
    testRAGForCurrentParcel,
    generateIAPDFReport,
    checkAPIHealth,
    initIAIntegration
};

console.log('🤖 Module d\'intégration IA chargé'); 