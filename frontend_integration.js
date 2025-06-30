// Script d'intégration du frontend avec l'API Urban-AI Valais
// À ajouter dans le fichier index.html existant

// Configuration de l'API
const API_BASE_URL = 'http://localhost:8000';

// Fonction pour appeler l'API backend
async function callUrbanAIAPI(endpoint, params = {}) {
    try {
        const url = new URL(`${API_BASE_URL}${endpoint}`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Erreur lors de l\'appel API:', error);
        throw error;
    }
}

// Fonction pour analyser une parcelle avec l'API Urban-AI
async function analyzeParcelleWithUrbanAI(commune, parcelle) {
    try {
        console.log(`🔍 Analyse Urban-AI pour ${commune} parcelle ${parcelle}...`);
        
        // Appel à l'API de rapport complet
        const rapportData = await callUrbanAIAPI('/rapport', {
            commune: commune,
            parcelle: parcelle
        });
        
        console.log('✅ Rapport Urban-AI généré:', rapportData);
        
        // Mettre à jour l'interface avec les données Urban-AI
        updateInterfaceWithUrbanAIData(rapportData);
        
        return rapportData;
    } catch (error) {
        console.error('❌ Erreur lors de l\'analyse Urban-AI:', error);
        showError(`Erreur Urban-AI: ${error.message}`);
        return null;
    }
}

// Fonction pour générer un PDF avec l'API Urban-AI
async function generatePDFWithUrbanAI(commune, parcelle) {
    try {
        console.log(`📄 Génération PDF Urban-AI pour ${commune} parcelle ${parcelle}...`);
        
        // Appel à l'API de génération PDF
        const pdfData = await callUrbanAIAPI('/pdf', {
            commune: commune,
            parcelle: parcelle
        });
        
        console.log('✅ PDF Urban-AI généré:', pdfData);
        
        // Télécharger le PDF
        if (pdfData.success && pdfData.pdf_url) {
            const downloadUrl = `${API_BASE_URL}${pdfData.pdf_url}`;
            window.open(downloadUrl, '_blank');
        }
        
        return pdfData;
    } catch (error) {
        console.error('❌ Erreur lors de la génération PDF Urban-AI:', error);
        showError(`Erreur génération PDF: ${error.message}`);
        return null;
    }
}

// Fonction pour mettre à jour l'interface avec les données Urban-AI
function updateInterfaceWithUrbanAIData(rapportData) {
    if (!rapportData || !rapportData.success) {
        console.error('Données Urban-AI invalides');
        return;
    }
    
    // Mettre à jour les informations générales
    updateGeneralInfo(rapportData);
    
    // Mettre à jour les informations de zonage avec les données RDPPF
    updateZoningInfo(rapportData);
    
    // Ajouter une section pour le rapport Urban-AI
    addUrbanAISection(rapportData);
    
    // Mettre à jour les boutons d'action
    updateActionButtons(rapportData);
}

// Mise à jour des informations générales
function updateGeneralInfo(rapportData) {
    const generalInfo = document.getElementById('generalInfo');
    if (!generalInfo) return;
    
    // Ajouter les informations Urban-AI aux informations existantes
    const urbanAIInfo = `
        <div class="info-item" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
            <div class="info-label">🔬 Analyse Urban-AI</div>
            <div class="info-value">✅ Rapport généré avec IA</div>
        </div>
        <div class="info-item">
            <div class="info-label">📋 Zone d'affectation</div>
            <div class="info-value">${rapportData.rules?.zone || 'Non déterminée'}</div>
        </div>
    `;
    
    generalInfo.innerHTML += urbanAIInfo;
}

// Mise à jour des informations de zonage
function updateZoningInfo(rapportData) {
    const zoningInfo = document.getElementById('zoningInfo');
    if (!zoningInfo) return;
    
    // Remplacer les informations de zonage par les données RDPPF
    let rdppfContent = '<div class="info-item"><div class="info-label">🏛️ Données RDPPF</div><div class="info-value">Données officielles valaisannes</div></div>';
    
    if (rapportData.rdppf) {
        try {
            const themes = rapportData.rdppf.Extract?.ConcernedTheme || [];
            const themeTexts = themes.map(theme => 
                theme.Text?.find(t => t.Language === 'fr')?.Text
            ).filter(Boolean);
            
            if (themeTexts.length > 0) {
                rdppfContent += '<div class="info-item"><div class="info-label">📋 Thèmes concernés</div><div class="info-value">';
                themeTexts.slice(0, 3).forEach(theme => {
                    rdppfContent += `• ${theme}<br>`;
                });
                rdppfContent += '</div></div>';
            }
        } catch (error) {
            console.error('Erreur lors de l\'extraction des thèmes RDPPF:', error);
        }
    }
    
    zoningInfo.innerHTML = rdppfContent;
}

// Ajout d'une section Urban-AI
function addUrbanAISection(rapportData) {
    const resultsContainer = document.getElementById('analysisResults');
    if (!resultsContainer) return;
    
    // Créer la section Urban-AI
    const urbanAISection = document.createElement('div');
    urbanAISection.className = 'analysis-section';
    urbanAISection.innerHTML = `
        <div class="section-header">
            <div class="section-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">🤖</div>
            <h2 class="section-title">Analyse Urban-AI</h2>
        </div>
        <div id="urbanAIInfo">
            <div class="info-item" style="background: #e8f4fd; border-left: 4px solid #667eea;">
                <div class="info-label">📊 Synthèse IA</div>
                <div class="info-value" style="white-space: pre-line; font-size: 0.9em;">
                    ${formatReportForDisplay(rapportData.report)}
                </div>
            </div>
        </div>
    `;
    
    // Insérer après la section de zonage
    const zoningSection = resultsContainer.querySelector('#zoningInfo').closest('.analysis-section');
    if (zoningSection) {
        zoningSection.parentNode.insertBefore(urbanAISection, zoningSection.nextSibling);
    }
}

// Formatage du rapport pour l'affichage
function formatReportForDisplay(report) {
    if (!report) return 'Aucun rapport disponible';
    
    // Limiter la longueur et formater
    const maxLength = 500;
    let formattedReport = report.replace(/\n\n/g, '\n').trim();
    
    if (formattedReport.length > maxLength) {
        formattedReport = formattedReport.substring(0, maxLength) + '...';
    }
    
    return formattedReport;
}

// Mise à jour des boutons d'action
function updateActionButtons(rapportData) {
    const actionsContainer = document.querySelector('.actions-container');
    if (!actionsContainer) return;
    
    // Ajouter un bouton pour l'analyse Urban-AI
    const urbanAIButton = document.createElement('button');
    urbanAIButton.className = 'action-btn';
    urbanAIButton.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    urbanAIButton.innerHTML = '🤖 Analyse Urban-AI';
    urbanAIButton.onclick = () => {
        if (currentData && currentData.cadastral) {
            analyzeParcelleWithUrbanAI(currentData.cadastral.commune, currentData.cadastral.id_federal);
        }
    };
    
    // Ajouter un bouton pour générer PDF Urban-AI
    const pdfButton = document.createElement('button');
    pdfButton.className = 'action-btn';
    pdfButton.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
    pdfButton.innerHTML = '📄 PDF Urban-AI';
    pdfButton.onclick = () => {
        if (currentData && currentData.cadastral) {
            generatePDFWithUrbanAI(currentData.cadastral.commune, currentData.cadastral.id_federal);
        }
    };
    
    // Insérer les nouveaux boutons
    actionsContainer.appendChild(urbanAIButton);
    actionsContainer.appendChild(pdfButton);
}

// Fonction pour vérifier la santé de l'API
async function checkAPIHealth() {
    try {
        const health = await callUrbanAIAPI('/health');
        console.log('✅ API Urban-AI en ligne:', health);
        return true;
    } catch (error) {
        console.error('❌ API Urban-AI hors ligne:', error);
        return false;
    }
}

// Fonction pour obtenir les métriques de l'API
async function getAPIMetrics() {
    try {
        const metrics = await callUrbanAIAPI('/metrics');
        console.log('📊 Métriques API Urban-AI:', metrics);
        return metrics;
    } catch (error) {
        console.error('❌ Erreur lors de la récupération des métriques:', error);
        return null;
    }
}

// Initialisation de l'intégration
async function initUrbanAIIntegration() {
    console.log('🚀 Initialisation de l\'intégration Urban-AI...');
    
    // Vérifier la santé de l'API
    const isHealthy = await checkAPIHealth();
    
    if (isHealthy) {
        console.log('✅ Intégration Urban-AI prête');
        
        // Ajouter un indicateur de statut dans l'interface
        addAPIStatusIndicator(true);
        
        // Récupérer les métriques
        const metrics = await getAPIMetrics();
        if (metrics) {
            console.log('📈 Performance API:', metrics.performance);
        }
    } else {
        console.log('⚠️ API Urban-AI non disponible');
        addAPIStatusIndicator(false);
    }
}

// Ajout d'un indicateur de statut API
function addAPIStatusIndicator(isOnline) {
    const header = document.querySelector('.header');
    if (!header) return;
    
    const statusIndicator = document.createElement('div');
    statusIndicator.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 5px 10px;
        border-radius: 15px;
        font-size: 0.8em;
        font-weight: bold;
        color: white;
        background: ${isOnline ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' : 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)'};
    `;
    statusIndicator.innerHTML = isOnline ? '🤖 Urban-AI Online' : '🤖 Urban-AI Offline';
    
    header.style.position = 'relative';
    header.appendChild(statusIndicator);
}

// Fonction d'erreur améliorée
function showError(message) {
    const analysisResults = document.getElementById('analysisResults');
    if (analysisResults) {
        analysisResults.innerHTML = `
            <div class="error-message">
                <h3>❌ Erreur</h3>
                <p>${message}</p>
                <button class="action-btn" onclick="newSearch()" style="margin-top: 15px;">
                    🔄 Nouvelle Recherche
                </button>
            </div>
        `;
        analysisResults.style.display = 'block';
    }
}

// Export des fonctions pour utilisation globale
window.UrbanAI = {
    analyzeParcelle: analyzeParcelleWithUrbanAI,
    generatePDF: generatePDFWithUrbanAI,
    checkHealth: checkAPIHealth,
    getMetrics: getAPIMetrics,
    init: initUrbanAIIntegration
};

// Initialisation automatique
document.addEventListener('DOMContentLoaded', function() {
    // Initialiser l'intégration Urban-AI après le chargement de la page
    setTimeout(initUrbanAIIntegration, 1000);
}); 