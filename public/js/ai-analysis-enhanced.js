// Variable globale pour gérer l'analyse en cours
let currentAnalysisController = null;
let analysisInProgress = false;

// Fonction améliorée pour l'analyse IA
window.performAIAnalysis = async function() {
    // Message de débogage immédiat
    console.log('🚀 performAIAnalysis appelée - DEBUT');
    
    try {
        console.log('📊 currentData:', window.currentData);
    
    if (!window.currentData) {
        console.error('❌ currentData non défini');
        if (window.showToast) {
            window.showToast('error', 'Erreur', 'Aucune parcelle sélectionnée. Veuillez d\'abord rechercher une parcelle.');
        } else {
            alert('Aucune parcelle sélectionnée. Veuillez d\'abord rechercher une parcelle.');
        }
        return;
    }
    
    // Vérifier si une analyse est déjà en cours
    if (analysisInProgress && currentAnalysisController) {
        // Créer une modal d'avertissement moderne
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease-out;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 20px;
                padding: 2rem;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                animation: slideUp 0.3s ease-out;
                position: relative;
            ">
                <div style="
                    width: 60px;
                    height: 60px;
                    background: linear-gradient(135deg, #ff6b35, #ff8855);
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 1.5rem;
                    box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
                ">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                </div>
                
                <h3 style="
                    font-size: 20px;
                    font-weight: 700;
                    margin: 0 0 0.5rem 0;
                    text-align: center;
                    color: var(--text-primary);
                ">Analyse en cours</h3>
                
                <p style="
                    color: var(--text-secondary);
                    text-align: center;
                    margin: 0 0 2rem 0;
                    line-height: 1.6;
                ">Une analyse est déjà en cours. Voulez-vous l'annuler et en démarrer une nouvelle ?</p>
                
                <div style="
                    display: flex;
                    gap: 1rem;
                    justify-content: center;
                ">
                    <button onclick="
                        this.closest('div[style*=\\'fixed\\']').remove();
                    " style="
                        padding: 0.75rem 1.5rem;
                        background: var(--surface);
                        color: var(--text-primary);
                        border: 1px solid var(--border);
                        border-radius: 10px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    " onmouseover="this.style.background='var(--border-light)'" onmouseout="this.style.background='var(--surface)'">
                        Continuer l'analyse
                    </button>
                    
                    <button onclick="
                        window.currentAnalysisController.abort();
                        window.currentAnalysisController = null;
                        window.analysisInProgress = false;
                        this.closest('div[style*=\\'fixed\\']').remove();
                        window.performAIAnalysis();
                    " style="
                        padding: 0.75rem 1.5rem;
                        background: linear-gradient(135deg, #ff6b35, #ff8855);
                        color: white;
                        border: none;
                        border-radius: 10px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3);
                    " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(255, 107, 53, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(255, 107, 53, 0.3)'">
                        Nouvelle analyse
                    </button>
                </div>
            </div>
            
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { 
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to { 
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            </style>
        `;
        
        document.body.appendChild(modal);
        return;
    }
    
    analysisInProgress = true;
    currentAnalysisController = new AbortController();
    
    // Utiliser le nouveau div dans parcelInfoSection
    let resultsDiv = document.getElementById('aiAnalysisResultsNew');
    if (!resultsDiv) {
        // Fallback sur l'ancien div si le nouveau n'existe pas
        resultsDiv = document.getElementById('aiAnalysisResults');
    }
    console.log('📍 resultsDiv trouvé:', resultsDiv);
    
    if (!resultsDiv) {
        console.error('❌ Élément d\'analyse IA non trouvé dans le DOM');
        alert('Erreur: Zone de résultats non trouvée');
        return;
    }
    
    // S'assurer que la section parcel info est visible (où se trouve le nouveau div)
    const parcelInfoSection = document.getElementById('parcelInfoSection');
    if (parcelInfoSection) {
        parcelInfoSection.style.display = 'block';
        console.log('✅ Section parcel info rendue visible');
    }
    
    // Fallback sur resultsSection si nécessaire
    const resultsSection = document.getElementById('resultsSection');
    if (resultsSection && resultsDiv.id === 'aiAnalysisResults') {
        resultsSection.style.display = 'block';
        console.log('✅ Section des résultats rendue visible (fallback)');
    }
    
    console.log('✅ Démarrage de l\'animation d\'analyse');
    resultsDiv.style.display = 'block';
    
    // Forcer le rechargement visuel
    resultsDiv.innerHTML = '';
    
    // Ajouter le CSS du loader amélioré
    if (!document.querySelector('link[href*="ai-loader-enhanced.css"]')) {
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = '/css/ai-loader-enhanced.css';
        document.head.appendChild(cssLink);
    }
    
    // Charger le script du loader amélioré si pas déjà chargé
    if (!window.AILoaderEnhanced && !document.querySelector('script[src*="ai-loader-enhanced.js"]')) {
        const loaderScript = document.createElement('script');
        loaderScript.src = '/js/ai-loader-enhanced.js';
        document.head.appendChild(loaderScript);
    }
    
    // Créer directement le loader amélioré
    const initLoader = () => {
        if (window.AILoaderEnhanced) {
            const loader = new window.AILoaderEnhanced();
            window.currentLoader = loader; // Garder une référence
            loader.init();
        } else {
            // Si le script n'est pas encore chargé, réessayer
            setTimeout(initLoader, 50);
        }
    };
    
    // Initialiser le loader
    initLoader();
    
    // Continuer avec l'analyse après un délai pour s'assurer que le loader est visible
    setTimeout(async () => {
        <div class="ai-loader-container">
            <div class="ai-loader-card">
                <!-- Particules flottantes -->
                <div class="ai-particles">
                    ${Array(10).fill(0).map((_, i) => `
                        <div class="ai-particle" style="
                            left: ${Math.random() * 100}%;
                            animation-delay: ${Math.random() * 20}s;
                            animation-duration: ${20 + Math.random() * 10}s;
                        "></div>
                    `).join('')}
                </div>
                <div class="ai-loader-header">
                    <div class="ai-progress-circle">
                        <svg class="ai-progress-ring" width="100" height="100">
                            <circle
                                class="ai-progress-ring-bg"
                                r="47"
                                cx="50"
                                cy="50"
                            />
                            <circle
                                class="ai-progress-ring-fill"
                                r="47"
                                cx="50"
                                cy="50"
                                stroke-dasharray="314"
                                stroke-dashoffset="314"
                            />
                            <defs>
                                <linearGradient id="aiProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" style="stop-color: #2563eb; stop-opacity: 1" />
                                    <stop offset="100%" style="stop-color: #7c3aed; stop-opacity: 1" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div class="ai-progress-percentage">0%</div>
                    </div>
                    <div class="ai-loader-content">
                        <h3 class="ai-loader-title">Analyse IA o3 en cours</h3>
                        <p class="ai-loader-subtitle current-step-text">Initialisation de l'analyse avec le modèle o3...</p>
                    </div>
                </div>
                
                <div class="ai-steps-container">
                    <div class="ai-step-item" data-step="1">
                        <div class="ai-step-indicator">
                            <span class="ai-step-number">1</span>
                            <svg class="ai-step-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                                <path d="M20 6L9 17L4 12"/>
                            </svg>
                        </div>
                        <div class="ai-step-content">
                            <div class="ai-step-title">Extraction PDF RDPPF</div>
                            <div class="ai-step-description">Analyse du cadastre des restrictions de droit public</div>
                        </div>
                    </div>
                    
                    <div class="ai-step-item" data-step="2">
                        <div class="ai-step-indicator">
                            <span class="ai-step-number">2</span>
                            <svg class="ai-step-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                                <path d="M20 6L9 17L4 12"/>
                            </svg>
                        </div>
                        <div class="ai-step-content">
                            <div class="ai-step-title">Extraction PDF Règlement</div>
                            <div class="ai-step-description">Analyse du règlement communal de construction</div>
                        </div>
                    </div>
                    
                    <div class="ai-step-item" data-step="3">
                        <div class="ai-step-indicator">
                            <span class="ai-step-number">3</span>
                            <svg class="ai-step-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                                <path d="M20 6L9 17L4 12"/>
                            </svg>
                        </div>
                        <div class="ai-step-content">
                            <div class="ai-step-title">Analyse combinée o3</div>
                            <div class="ai-step-description">Fusion et enrichissement des données extraites</div>
                        </div>
                    </div>
                    
                    <div class="ai-step-item" data-step="4">
                        <div class="ai-step-indicator">
                            <span class="ai-step-number">4</span>
                            <svg class="ai-step-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                                <path d="M20 6L9 17L4 12"/>
                            </svg>
                        </div>
                        <div class="ai-step-content">
                            <div class="ai-step-title">Synthèse intelligente</div>
                            <div class="ai-step-description">Génération des recommandations et du rapport final</div>
                        </div>
                    </div>
                </div>
                
                <div class="ai-progress-bar-wrapper">
                    <div class="ai-progress-bar">
                        <div class="ai-progress-bar-fill"></div>
                    </div>
                </div>
                
                <div class="ai-loader-footer">
                    Temps estimé: <span class="ai-time-remaining">30 secondes</span>
                </div>
            </div>
        </div>
    `;
    
    // Insérer l'animation dans le DOM
    resultsDiv.innerHTML = animationHTML;
    
    // Faire défiler jusqu'aux résultats
    resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    console.log('📜 Défilement vers les résultats');
    
    // Ajouter le CSS si pas déjà présent
    if (!document.querySelector('link[href*="ai-loader.css"]')) {
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = '/css/ai-loader.css';
        document.head.appendChild(cssLink);
    }
    
    // Fonction pour mettre à jour la progression
    function updateProgress(percentage, stepNumber, stepText) {
        const progressCircle = resultsDiv.querySelector('.ai-progress-ring-fill');
        const progressPercentage = resultsDiv.querySelector('.ai-progress-percentage');
        const progressBarFill = resultsDiv.querySelector('.ai-progress-bar-fill');
        const currentStepText = resultsDiv.querySelector('.current-step-text');
        
        // Mise à jour du cercle de progression
        const circumference = 314; // 2 * Math.PI * 50
        const offset = circumference - (percentage / 100) * circumference;
        if (progressCircle) {
            progressCircle.style.strokeDashoffset = offset;
        }
        if (progressPercentage) {
            progressPercentage.textContent = `${percentage}%`;
        }
        
        // Mise à jour de la barre de progression
        if (progressBarFill) {
            progressBarFill.style.width = `${percentage}%`;
        }
        
        // Mise à jour du texte de l'étape
        if (stepText && currentStepText) {
            currentStepText.textContent = stepText;
        }
        
        // Mise à jour des étapes
        if (stepNumber) {
            // Marquer les étapes précédentes comme complétées
            for (let i = 1; i < stepNumber; i++) {
                const stepEl = resultsDiv.querySelector(`[data-step="${i}"]`);
                if (stepEl) {
                    stepEl.classList.remove('active');
                    stepEl.classList.add('completed');
                }
            }
            
            // Marquer l'étape actuelle comme active
            const currentStepEl = resultsDiv.querySelector(`[data-step="${stepNumber}"]`);
            if (currentStepEl) {
                currentStepEl.classList.add('active');
            }
        }
    }
    
    // Simulation de progression réaliste
    let progress = 0;
    const progressSteps = [
        { progress: 10, step: 1, text: "Connexion à l'API GeoAdmin..." },
        { progress: 20, step: 1, text: "Extraction du PDF RDPPF en cours..." },
        { progress: 35, step: 2, text: "Téléchargement du règlement communal..." },
        { progress: 50, step: 2, text: "Analyse du règlement PDF..." },
        { progress: 65, step: 3, text: "Fusion des données extraites..." },
        { progress: 80, step: 3, text: "Enrichissement avec le modèle o3..." },
        { progress: 90, step: 4, text: "Génération de la synthèse..." },
        { progress: 95, step: 4, text: "Finalisation de l'analyse..." }
    ];
    
    let stepIndex = 0;
    const progressInterval = setInterval(() => {
        if (stepIndex < progressSteps.length && !currentAnalysisController.signal.aborted) {
            const step = progressSteps[stepIndex];
            updateProgress(step.progress, step.step, step.text);
            stepIndex++;
        }
    }, 2000);
    
    try {
        const searchQuery = window.currentData.general?.adresse || window.currentData.cadastral?.id_federal || window.currentData.cadastral?.commune || 'Parcelle inconnue';
        console.log('📤 Envoi de la requête d\'analyse avec:', { searchQuery, analysisType: 'comprehensive' });
        
        const response = await fetch('/api/ia-constraints', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                searchQuery: searchQuery,
                analysisType: 'comprehensive'
            }),
            signal: currentAnalysisController.signal
        });
        
        console.log('📥 Réponse reçue:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Erreur de l\'API:', errorData);
            throw new Error(errorData.error || `Erreur HTTP ${response.status} - ${response.statusText}`);
        }
        
        const analysisResult = await response.json();
        
        // Animation de fin
        clearInterval(progressInterval);
        updateProgress(100, 4, "Analyse terminée avec succès !");
        
        setTimeout(() => {
            displayAIAnalysisResults(analysisResult);
            
            const constraintsCount = analysisResult.data?.constraints?.length || 0;
            if (window.showToast) {
                window.showToast('success', 'Analyse terminée', `${constraintsCount} contrainte${constraintsCount > 1 ? 's' : ''} identifiée${constraintsCount > 1 ? 's' : ''}`);
            }
        }, 1000);
        
    } catch (error) {
        clearInterval(progressInterval);
        
        if (error.name === 'AbortError') {
            if (window.showToast) {
                window.showToast('info', 'Analyse annulée', 'L\'analyse a été interrompue');
            }
            resultsDiv.style.display = 'none';
        } else {
            console.error('Erreur analyse IA:', error);
            if (window.showToast) {
                window.showToast('error', 'Erreur d\'analyse', error.message || 'Impossible de réaliser l\'analyse IA');
            }
            
            resultsDiv.innerHTML = `
                <div class="ai-error-container">
                    <div class="ai-error-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="15" y1="9" x2="9" y2="15"/>
                            <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                    </div>
                    <h3 style="font-size: 24px; font-weight: 700; color: #ef4444; margin: 0 0 0.75rem 0;">
                        Erreur d'analyse
                    </h3>
                    <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin-bottom: 2rem;">
                        ${error.message || 'Une erreur est survenue lors de l\'analyse. Veuillez vérifier votre connexion et réessayer.'}
                    </p>
                    <button class="btn" onclick="window.performAIAnalysis()" style="
                        background: linear-gradient(135deg, #ef4444, #f87171);
                        color: white;
                        padding: 0.875rem 1.75rem;
                        border: none;
                        border-radius: 12px;
                        font-weight: 600;
                        font-size: 15px;
                        cursor: pointer;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
                        display: inline-flex;
                        align-items: center;
                        gap: 0.5rem;
                    " 
                    onmouseover="this.style.transform='translateY(-2px) scale(1.02)'; this.style.boxShadow='0 6px 20px rgba(239, 68, 68, 0.4)'" 
                    onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 4px 12px rgba(239, 68, 68, 0.3)'">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M23 4v6h-6"/>
                            <path d="M1 20v-6h6"/>
                            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                        </svg>
                        Réessayer l'analyse
                    </button>
                </div>
            `;
        }
    } finally {
        analysisInProgress = false;
        currentAnalysisController = null;
    }
    } catch (globalError) {
        console.error('❌ Erreur globale dans performAIAnalysis:', globalError);
        console.error('Stack trace:', globalError.stack);
        alert('Erreur lors du lancement de l\'analyse: ' + globalError.message);
    }
};

// Avertissement avant de quitter la page pendant l'analyse
window.addEventListener('beforeunload', (e) => {
    if (analysisInProgress) {
        e.preventDefault();
        e.returnValue = 'Une analyse est en cours. Êtes-vous sûr de vouloir quitter ?';
    }
});

// Intercepter le bouton "Nouvelle recherche"
let originalNewSearch = null;

function interceptNewSearch() {
    originalNewSearch = window.newSearch;
    
    window.newSearch = function() {
        if (analysisInProgress) {
            // Créer une modal d'avertissement moderne
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(8px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                animation: fadeIn 0.3s ease-out;
            `;
            
            modal.innerHTML = `
                <div style="
                    background: white;
                    border-radius: 20px;
                    padding: 2rem;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    animation: slideUp 0.3s ease-out;
                    position: relative;
                ">
                    <div style="
                        width: 60px;
                        height: 60px;
                        background: linear-gradient(135deg, #0070f3, #0090ff);
                        border-radius: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 1.5rem;
                        box-shadow: 0 4px 12px rgba(0, 112, 243, 0.3);
                    ">
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                            <path d="M21 21l-6-6m6 6v-6m0 6h-6"/>
                            <path d="M3 12a9 9 0 0 0 9 9"/>
                            <path d="M3 3l6 6m-6-6v6m0-6h6"/>
                            <path d="M21 12a9 9 0 0 0-9-9"/>
                        </svg>
                    </div>
                    
                    <h3 style="
                        font-size: 20px;
                        font-weight: 700;
                        margin: 0 0 0.5rem 0;
                        text-align: center;
                        color: var(--text-primary);
                    ">Nouvelle recherche</h3>
                    
                    <p style="
                        color: var(--text-secondary);
                        text-align: center;
                        margin: 0 0 2rem 0;
                        line-height: 1.6;
                    ">Une analyse IA est en cours. Si vous continuez, l'analyse sera annulée. Voulez-vous continuer ?</p>
                    
                    <div style="
                        display: flex;
                        gap: 1rem;
                        justify-content: center;
                    ">
                        <button onclick="
                            this.closest('div[style*=\\'fixed\\']').remove();
                        " style="
                            padding: 0.75rem 1.5rem;
                            background: var(--surface);
                            color: var(--text-primary);
                            border: 1px solid var(--border);
                            border-radius: 10px;
                            font-size: 14px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.2s ease;
                        " onmouseover="this.style.background='var(--border-light)'" onmouseout="this.style.background='var(--surface)'">
                            Annuler
                        </button>
                        
                        <button onclick="
                            if (window.currentAnalysisController) {
                                window.currentAnalysisController.abort();
                                window.currentAnalysisController = null;
                                window.analysisInProgress = false;
                            }
                            this.closest('div[style*=\\'fixed\\']').remove();
                            if (originalNewSearch) {
                                originalNewSearch();
                            }
                        " style="
                            padding: 0.75rem 1.5rem;
                            background: linear-gradient(135deg, #0070f3, #0090ff);
                            color: white;
                            border: none;
                            border-radius: 10px;
                            font-size: 14px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.2s ease;
                            box-shadow: 0 2px 8px rgba(0, 112, 243, 0.3);
                        " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(0, 112, 243, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0, 112, 243, 0.3)'">
                            Nouvelle recherche
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            return;
        }
        
        // Appeler la fonction originale
        if (originalNewSearch) {
            originalNewSearch();
        }
    };
}

// Initialiser l'interception au chargement de la page
document.addEventListener('DOMContentLoaded', interceptNewSearch);

// Fonction améliorée pour afficher les résultats
window.displayAIAnalysisResults = function(result) {
    // Utiliser le nouveau div dans parcelInfoSection
    let resultsDiv = document.getElementById('aiAnalysisResultsNew');
    if (!resultsDiv) {
        // Fallback sur l'ancien div si le nouveau n'existe pas
        resultsDiv = document.getElementById('aiAnalysisResults');
    }
    
    // S'assurer que la section appropriée est visible
    const parcelInfoSection = document.getElementById('parcelInfoSection');
    if (parcelInfoSection && resultsDiv.id === 'aiAnalysisResultsNew') {
        parcelInfoSection.style.display = 'block';
    }
    
    const resultsSection = document.getElementById('resultsSection');
    if (resultsSection && resultsDiv.id === 'aiAnalysisResults') {
        resultsSection.style.display = 'block';
    }
    
    if (!result.data || !result.data.constraints) {
        resultsDiv.innerHTML = `
            <div class="result-card">
                <p style="color: var(--text-secondary);">Aucune donnée d'analyse disponible</p>
            </div>
        `;
        return;
    }
    
    const constraints = result.data.constraints;
    const analysis = result.data.analysis;
    const parcel = result.data.parcel;
    const metadata = result.metadata;
    
    let html = `
        <div class="ai-results-container" style="
            display: grid;
            gap: 2rem;
            animation: fadeIn 0.5s ease-out;
        ">
            <!-- En-tête avec informations clés -->
            <div class="results-header" style="
                background: linear-gradient(135deg, var(--surface) 0%, var(--background) 100%);
                border-radius: 16px;
                padding: 2rem;
                position: relative;
                overflow: hidden;
            ">
                <div style="
                    position: absolute;
                    top: -50%;
                    right: -10%;
                    width: 300px;
                    height: 300px;
                    background: radial-gradient(circle, rgba(0, 112, 243, 0.1) 0%, transparent 70%);
                    border-radius: 50%;
                "></div>
                
                <div style="position: relative; z-index: 1;">
                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
                        <div style="
                            width: 48px;
                            height: 48px;
                            background: var(--primary);
                            border-radius: 12px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        ">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                                <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                                <path d="M2 17L12 22L22 17"/>
                                <path d="M2 12L12 17L22 12"/>
                            </svg>
                        </div>
                        <h3 style="
                            font-size: 28px;
                            font-weight: 800;
                            margin: 0;
                            background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
                            -webkit-background-clip: text;
                            -webkit-text-fill-color: transparent;
                            background-clip: text;
                        ">Analyse IA Complète</h3>
                        ${metadata?.confidence ? `
                            <div style="
                                margin-left: auto;
                                padding: 0.5rem 1rem;
                                background: ${metadata.confidence >= 80 ? 'rgba(0, 212, 170, 0.1)' : metadata.confidence >= 60 ? 'rgba(255, 107, 53, 0.1)' : 'rgba(255, 51, 51, 0.1)'};
                                color: ${metadata.confidence >= 80 ? 'var(--success)' : metadata.confidence >= 60 ? 'var(--warning)' : 'var(--error)'};
                                border-radius: 8px;
                                font-weight: 600;
                                display: flex;
                                align-items: center;
                                gap: 0.5rem;
                            ">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z"/>
                                    <path d="M12 6v6l4 2"/>
                                </svg>
                                Confiance: ${metadata.confidence}%
                            </div>
                        ` : ''}
                    </div>
                    
                    ${parcel ? `
                        <div style="
                            display: grid;
                            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                            gap: 1rem;
                        ">
                            <div style="
                                padding: 1rem;
                                background: rgba(255, 255, 255, 0.5);
                                backdrop-filter: blur(10px);
                                border-radius: 12px;
                                border: 1px solid var(--border-light);
                            ">
                                <div style="color: var(--text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Adresse</div>
                                <div style="font-weight: 600; margin-top: 0.25rem;">${parcel.address || 'Non spécifiée'}</div>
                            </div>
                            <div style="
                                padding: 1rem;
                                background: rgba(255, 255, 255, 0.5);
                                backdrop-filter: blur(10px);
                                border-radius: 12px;
                                border: 1px solid var(--border-light);
                            ">
                                <div style="color: var(--text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Zone</div>
                                <div style="font-weight: 600; margin-top: 0.25rem;">
                                    ${parcel.zone || 'À déterminer'}
                                    ${parcel.zone_surface ? `<div style="font-size: 12px; color: #6b7280; margin-top: 0.25rem;">Surface: ${parcel.zone_surface}</div>` : ''}
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            ${result.data.summary ? `
                <!-- Résumé exécutif -->
                <div class="executive-summary" style="
                    background: var(--surface);
                    border-radius: 16px;
                    padding: 2rem;
                    position: relative;
                    border: 1px solid var(--border-light);
                ">
                    <div style="
                        position: absolute;
                        top: -8px;
                        left: 2rem;
                        background: var(--surface);
                        padding: 0 0.75rem;
                        color: var(--primary);
                        font-weight: 600;
                        font-size: 14px;
                    ">RÉSUMÉ EXÉCUTIF</div>
                    
                    <p style="
                        font-size: 18px;
                        line-height: 1.7;
                        color: var(--text-primary);
                        margin: 0.5rem 0 0 0;
                    ">${result.data.summary}</p>
                </div>
            ` : ''}
            
            ${analysis?.calculations && Object.keys(analysis.calculations).length > 0 ? `
                <!-- Métriques clés -->
                <div class="key-metrics" style="
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 1.5rem;
                ">
                    ${analysis.calculations.maxBuildableArea ? `
                        <div class="metric-card" style="
                            background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
                            color: white;
                            padding: 1.5rem;
                            border-radius: 16px;
                            position: relative;
                            overflow: hidden;
                        ">
                            <div style="
                                position: absolute;
                                top: -20px;
                                right: -20px;
                                width: 80px;
                                height: 80px;
                                background: rgba(255, 255, 255, 0.1);
                                border-radius: 50%;
                            "></div>
                            <div style="position: relative;">
                                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 0.5rem;">Surface constructible maximale</div>
                                <div style="font-size: 32px; font-weight: 800;">
                                    ${analysis.calculations.maxBuildableArea.toLocaleString('fr-CH')} m²
                                </div>
                                ${analysis.calculations.constructionDensity ? `
                                    <div style="font-size: 12px; opacity: 0.8; margin-top: 0.5rem;">
                                        IBUS: ${analysis.calculations.constructionDensity}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${analysis.calculations.maxHeight ? `
                        <div class="metric-card" style="
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            padding: 1.5rem;
                            border-radius: 16px;
                            position: relative;
                            overflow: hidden;
                        ">
                            <div style="
                                position: absolute;
                                top: -20px;
                                right: -20px;
                                width: 80px;
                                height: 80px;
                                background: rgba(255, 255, 255, 0.1);
                                border-radius: 50%;
                            "></div>
                            <div style="position: relative;">
                                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 0.5rem;">Hauteur maximale autorisée</div>
                                <div style="font-size: 32px; font-weight: 800;">
                                    ${analysis.calculations.maxHeight} m
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${analysis.calculations.requiredGreenSpace ? `
                        <div class="metric-card" style="
                            background: linear-gradient(135deg, #00d4aa 0%, #00a383 100%);
                            color: white;
                            padding: 1.5rem;
                            border-radius: 16px;
                            position: relative;
                            overflow: hidden;
                        ">
                            <div style="
                                position: absolute;
                                top: -20px;
                                right: -20px;
                                width: 80px;
                                height: 80px;
                                background: rgba(255, 255, 255, 0.1);
                                border-radius: 50%;
                            "></div>
                            <div style="position: relative;">
                                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 0.5rem;">Espaces verts obligatoires</div>
                                <div style="font-size: 32px; font-weight: 800;">
                                    ${analysis.calculations.requiredGreenSpace.toLocaleString('fr-CH')} m²
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
            
            <!-- Contraintes détaillées avec design innovant -->
            <div class="constraints-section" style="
                position: relative;
                padding: 2rem;
                background: #ffffff;
                border-radius: 16px;
                border: 1px solid #e5e7eb;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            ">
                <div style="
                    position: absolute;
                    top: -100px;
                    right: -100px;
                    width: 400px;
                    height: 400px;
                    background: radial-gradient(circle, rgba(37, 99, 235, 0.03) 0%, transparent 70%);
                    border-radius: 50%;
                    pointer-events: none;
                "></div>
                
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 2rem;
                ">
                    <h4 style="
                        font-size: 24px;
                        font-weight: 800;
                        margin: 0;
                        display: flex;
                        align-items: center;
                        gap: 0.75rem;
                        color: #111827;
                    ">
                        <div style="
                            width: 40px;
                            height: 40px;
                            background: #2563eb;
                            border-radius: 12px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
                        ">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                                <path d="M9 11H3v10h6V11zM21 3h-6v18h6V3zM15 7h-6v14h6V7z"/>
                            </svg>
                        </div>
                        ${constraints.length} Contraintes Identifiées
                    </h4>
                </div>
                
                <div class="constraints-grid" style="
                    display: grid;
                    gap: 1.25rem;
                    position: relative;
                ">
                    ${constraints.map((constraint, index) => {
                        // Catégories thématiques avec couleurs cohérentes
                        const themeConfig = {
                            'Destination de zone': { 
                                gradient: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                                icon: '🏙️',
                                color: '#2563eb'
                            },
                            'Indice d\'utilisation (IBUS)': { 
                                gradient: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
                                icon: '📊',
                                color: '#8b5cf6'
                            },
                            'Gabarits & reculs': { 
                                gradient: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
                                icon: '📐',
                                color: '#ec4899'
                            },
                            'Toiture': { 
                                gradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                                icon: '🏠',
                                color: '#f59e0b'
                            },
                            'Stationnement': { 
                                gradient: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                                icon: '🚗',
                                color: '#10b981'
                            },
                            'Espaces de jeux / détente': { 
                                gradient: 'linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)',
                                icon: '🌳',
                                color: '#14b8a6'
                            },
                            'Prescriptions architecturales': { 
                                gradient: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
                                icon: '🎨',
                                color: '#f97316'
                            },
                            'Identification': { 
                                gradient: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                                icon: '📍',
                                color: '#6366f1'
                            }
                        };
                        
                        // Trouver la configuration par thème ou utiliser une configuration par défaut
                        let theme = themeConfig[constraint.theme] || themeConfig[constraint.title] || {
                            gradient: 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)',
                            icon: '📄',
                            color: '#6b7280'
                        };
                        
                        // Si le titre contient certains mots-clés, adapter le thème
                        if (constraint.title?.toLowerCase().includes('hauteur') || constraint.title?.toLowerCase().includes('gabarit')) {
                            theme = themeConfig['Gabarits & reculs'];
                        } else if (constraint.title?.toLowerCase().includes('parking') || constraint.title?.toLowerCase().includes('stationnement')) {
                            theme = themeConfig['Stationnement'];
                        } else if (constraint.title?.toLowerCase().includes('vert') || constraint.title?.toLowerCase().includes('plantation')) {
                            theme = themeConfig['Espaces de jeux / détente'];
                        }
                        
                        return `
                            <div class="constraint-card" style="
                                background: #ffffff;
                                border: 1px solid #e5e7eb;
                                border-radius: 20px;
                                padding: 1.75rem;
                                position: relative;
                                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                                cursor: pointer;
                                animation: slideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.05}s both;
                                overflow: hidden;
                            " 
                            onmouseover="
                                this.style.transform='translateY(-6px)'; 
                                this.style.boxShadow='0 20px 40px rgba(0,0,0,0.08)';
                                this.querySelector('.card-accent').style.height='6px';
                                this.querySelector('.icon-container').style.transform='scale(1.1) rotate(5deg)';
                            " 
                            onmouseout="
                                this.style.transform='translateY(0)'; 
                                this.style.boxShadow='0 1px 3px rgba(0,0,0,0.1)';
                                this.querySelector('.card-accent').style.height='4px';
                                this.querySelector('.icon-container').style.transform='scale(1) rotate(0deg)';
                            ">
                                <!-- Accent coloré en haut de la carte -->
                                <div class="card-accent" style="
                                    position: absolute;
                                    top: 0;
                                    left: 0;
                                    right: 0;
                                    height: 4px;
                                    background: ${theme.gradient};
                                    transition: height 0.3s ease;
                                "></div>
                                
                                <div style="display: flex; align-items: flex-start; gap: 1.25rem;">
                                    <div class="icon-container" style="
                                        width: 56px;
                                        height: 56px;
                                        background: ${theme.gradient};
                                        border-radius: 16px;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        font-size: 28px;
                                        flex-shrink: 0;
                                        box-shadow: 0 8px 24px ${theme.color}30;
                                        position: relative;
                                        overflow: hidden;
                                        transition: all 0.3s ease;
                                    ">
                                        <div style="
                                            position: absolute;
                                            top: 0;
                                            left: 0;
                                            right: 0;
                                            bottom: 0;
                                            background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%);
                                            transform: translateX(-100%);
                                            animation: shine 3s infinite;
                                        "></div>
                                        <span style="position: relative; z-index: 1;">${constraint.icon || theme.icon}</span>
                                    </div>
                                    
                                    <div style="flex: 1;">
                                        <h5 style="
                                            font-size: 17px;
                                            font-weight: 700;
                                            margin: 0 0 0.5rem 0;
                                            color: var(--text-primary);
                                            letter-spacing: -0.02em;
                                        ">${constraint.title}</h5>
                                        
                                        <p style="
                                            color: var(--text-secondary);
                                            font-size: 14px;
                                            line-height: 1.7;
                                            margin: 0;
                                        ">${constraint.description}</p>
                                        
                                        ${constraint.details ? `
                                            <div style="
                                                margin-top: 1rem; 
                                                padding: 1rem; 
                                                background: #f9fafb;
                                                border-radius: 12px;
                                                border: 1px solid #e5e7eb;
                                            ">
                                                ${constraint.details.values ? `
                                                    <div style="
                                                        display: flex;
                                                        gap: 0.75rem;
                                                        flex-wrap: wrap;
                                                        margin-bottom: ${constraint.details.requirements?.length > 0 ? '0.75rem' : '0'};
                                                    ">
                                                        ${constraint.details.values.numeric ? `
                                                            <div style="
                                                                padding: 0.625rem 1.25rem;
                                                                background: ${theme.gradient};
                                                                color: white;
                                                                border-radius: 12px;
                                                                font-size: 16px;
                                                                font-weight: 700;
                                                                display: flex;
                                                                align-items: center;
                                                                gap: 0.5rem;
                                                                box-shadow: 0 4px 12px ${theme.color}20;
                                                                letter-spacing: -0.02em;
                                                            ">
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                                                    <polyline points="22 4 12 14.01 9 11.01"/>
                                                                </svg>
                                                                ${constraint.details.values.numeric} ${constraint.details.values.unit || ''}
                                                            </div>
                                                        ` : ''}
                                                        ${constraint.details.values.range ? `
                                                            <div style="
                                                                padding: 0.625rem 1.25rem;
                                                                background: white;
                                                                color: ${theme.color};
                                                                border: 2px solid ${theme.color}20;
                                                                border-radius: 12px;
                                                                font-size: 16px;
                                                                font-weight: 700;
                                                                display: flex;
                                                                align-items: center;
                                                                gap: 0.5rem;
                                                            ">
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                                                    <path d="M3 12h18m-9-9v18"/>
                                                                </svg>
                                                                ${constraint.details.values.range.min} - ${constraint.details.values.range.max} ${constraint.details.values.range.unit || ''}
                                                            </div>
                                                        ` : ''}
                                                    </div>
                                                ` : ''}
                                                
                                                ${constraint.details.requirements && constraint.details.requirements.length > 0 ? `
                                                    <div style="font-size: 14px;">
                                                        <strong style="color: #374151; font-weight: 600;">Exigences spécifiques :</strong>
                                                        <ul style="margin: 0.5rem 0 0 1.25rem; padding: 0; list-style: none;">
                                                            ${constraint.details.requirements.map(req => `
                                                                <li style="
                                                                    color: #6b7280; 
                                                                    position: relative; 
                                                                    padding-left: 1.25rem;
                                                                    margin-bottom: 0.375rem;
                                                                ">
                                                                    <span style="
                                                                        position: absolute;
                                                                        left: 0;
                                                                        top: 0.5rem;
                                                                        width: 6px;
                                                                        height: 6px;
                                                                        background: ${theme.color};
                                                                        border-radius: 50%;
                                                                    "></span>
                                                                    ${req}
                                                                </li>
                                                            `).join('')}
                                                        </ul>
                                                    </div>
                                                ` : ''}
                                            </div>
                                        ` : ''}
                                        
                                        ${constraint.source || constraint.article ? `
                                            <div style="
                                                display: flex;
                                                align-items: center;
                                                gap: 0.5rem;
                                                margin-top: 1rem;
                                                padding-top: 1rem;
                                                border-top: 1px solid #f3f4f6;
                                                font-size: 12px;
                                                color: #9ca3af;
                                            ">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.6;">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                                    <polyline points="14 2 14 8 20 8"/>
                                                    <line x1="16" y1="13" x2="8" y2="13"/>
                                                    <line x1="16" y1="17" x2="8" y2="17"/>
                                                </svg>
                                                <span style="font-weight: 500;">${constraint.source || 'Règlement communal'} ${constraint.article ? `- ${constraint.article}` : ''}</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            ${analysis?.recommendations && analysis.recommendations.length > 0 ? `
                <!-- Recommandations -->
                <div class="recommendations-section" style="
                    background: #f9fafb;
                    border-radius: 16px;
                    padding: 2rem;
                    border: 1px solid #e5e7eb;
                ">
                    <h4 style="
                        font-size: 20px;
                        font-weight: 700;
                        margin: 0 0 1.5rem 0;
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                    ">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2L2 19h20L12 2z"/>
                            <path d="M12 9v4m0 4h.01"/>
                        </svg>
                        Recommandations Prioritaires
                    </h4>
                    
                    <div style="display: grid; gap: 1rem;">
                        ${analysis.recommendations.map((rec, index) => `
                            <div style="
                                display: flex;
                                align-items: flex-start;
                                gap: 1rem;
                                padding: 1rem;
                                background: var(--background);
                                border-radius: 8px;
                                border-left: 4px solid ${
                                    rec.priority === 'high' ? 'var(--error)' :
                                    rec.priority === 'medium' ? 'var(--warning)' :
                                    'var(--info)'
                                };
                            ">
                                <div style="
                                    width: 24px;
                                    height: 24px;
                                    background: ${
                                        rec.priority === 'high' ? 'var(--error)' :
                                        rec.priority === 'medium' ? 'var(--warning)' :
                                        'var(--info)'
                                    };
                                    color: white;
                                    border-radius: 50%;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    font-size: 12px;
                                    font-weight: 700;
                                    flex-shrink: 0;
                                ">${index + 1}</div>
                                
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; margin-bottom: 0.25rem;">${rec.action}</div>
                                    <div style="color: var(--text-secondary); font-size: 14px;">${rec.reason}</div>
                                    ${rec.timeline ? `
                                        <div style="
                                            display: inline-block;
                                            margin-top: 0.5rem;
                                            padding: 0.25rem 0.75rem;
                                            background: var(--surface);
                                            border-radius: 4px;
                                            font-size: 12px;
                                            color: var(--text-muted);
                                        ">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; vertical-align: -2px; margin-right: 4px;">
                                                <circle cx="12" cy="12" r="10"/>
                                                <path d="M12 6v6l4 2"/>
                                            </svg>
                                            ${rec.timeline}
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(30px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                
                @keyframes pulse {
                    0%, 100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                    50% {
                        transform: scale(1.2);
                        opacity: 0.8;
                    }
                }
                
                @keyframes shine {
                    to {
                        transform: translateX(200%);
                    }
                }
                
                .constraint-card:hover .hover-glow {
                    opacity: 0.5 !important;
                }
                
                /* Effet de parallaxe au scroll */
                .constraints-section {
                    transform-style: preserve-3d;
                    perspective: 1000px;
                }
                
                /* Animations pour les badges de sévérité */
                @keyframes badgeFloat {
                    0%, 100% {
                        transform: translateY(0);
                    }
                    50% {
                        transform: translateY(-3px);
                    }
                }
                
                /* Effet de vague pour le fond */
                @keyframes wave {
                    0% {
                        transform: translateX(-100%);
                    }
                    100% {
                        transform: translateX(100%);
                    }
                }
                
                /* Animation d'entrée échelonnée */
                @keyframes staggerIn {
                    from {
                        opacity: 0;
                        transform: translateY(40px) rotateX(-20deg);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) rotateX(0);
                    }
                }
            </style>
        </div>
    `;
    
    resultsDiv.innerHTML = html;
    
    // Remplacer la fonction globale si elle existe
    // Fonction déjà définie sur window
};

// Les fonctions sont déjà définies directement sur window

// Vérifier que tout est bien chargé
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ ai-analysis-enhanced.js chargé et prêt');
    console.log('📌 performAIAnalysis disponible:', typeof window.performAIAnalysis);
    console.log('📌 displayAIAnalysisResults disponible:', typeof window.displayAIAnalysisResults);
});