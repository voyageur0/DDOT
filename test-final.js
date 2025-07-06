// Test final simulant exactement l'API /api/ia-constraints
require('dotenv').config();
require('ts-node').register({ transpileOnly: true });

async function testFinal() {
  console.log('🔍 Test final simulation API...');
  
  try {
    // 1. Analyse complète comme dans l'API
    const { performComprehensiveAnalysis } = require('./src/lib/parcelAnalysisOrchestrator');
    const analysis = await performComprehensiveAnalysis('12558 vetroz 6025 ch773017495270');
    
    console.log('\n📊 Résultat analyse:');
    console.log('- RDPPF:', analysis.rdppfConstraints?.length || 0);
    console.log('- Communales:', analysis.communalConstraints?.length || 0);
    console.log('- Complétude:', analysis.completeness + '%');
    
    // 2. Aperçu des contraintes
    if (analysis.rdppfConstraints?.length) {
      console.log('\n📋 Échantillon RDPPF:');
      analysis.rdppfConstraints.slice(0, 3).forEach((c, i) => {
        console.log(`${i+1}. ${c.theme}: ${c.rule.substring(0, 100)}...`);
      });
    }
    
    if (analysis.communalConstraints?.length) {
      console.log('\n🏛️ Échantillon communales:');
      analysis.communalConstraints.slice(0, 3).forEach((c, i) => {
        console.log(`${i+1}. ${c.theme}: ${c.rule.substring(0, 100)}...`);
      });
    }
    
    // 3. Prompt exacte comme dans l'API
    const enrichedPrompt = `${analysis.formattedForAI}

---

INSTRUCTION STRICTE : Utilise UNIQUEMENT les données ci-dessus pour remplir les 8 thèmes obligatoires.
Si une donnée manque, écris "Non spécifié dans les documents analysés" mais UTILISE TOUTES les contraintes extraites.

Exemples concrets trouvés dans les documents :
- STATIONNEMENT : Si tu vois "1 place par 65 m²", utilise cette règle exacte
- GABARITS : Si tu vois "hauteur max 12 m", utilise cette valeur exacte  
- ZONES : Si tu vois "zone d'habitation R2", utilise cette désignation exacte

STRUCTURE OBLIGATOIRE (8 thèmes numérotés) :
1. **Identification** : Parcelle, commune, coordonnées
2. **Destination de zone** : Type exact depuis RDPPF/règlement
3. **Indice d'utilisation (IBUS)** : Valeur exacte si mentionnée
4. **Gabarits & reculs** : Hauteurs et distances exactes
5. **Toiture** : Contraintes exactes (pente, matériaux)
6. **Stationnement** : Règles exactes (nombre places/m²)
7. **Espaces de jeux/détente** : Obligations exactes si mentionnées
8. **Prescriptions architecturales** : Contraintes exactes de style/matériaux`;
    
    console.log('\n📝 Début prompt (premiers 800 caractères):');
    console.log(enrichedPrompt.substring(0, 800) + '...');
    
    // 4. Appel OpenAI comme dans l'API
    const { callOpenAI } = require('./src/utils/openai');
    
    console.log('\n🤖 Appel OpenAI...');
    const response = await callOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        { role: 'system', content: 'Tu es un expert en urbanisme suisse. Réponds en français.' },
        { role: 'user', content: enrichedPrompt }
      ],
      max_tokens: 2000
    });
    
    const result = response.choices[0].message?.content || '';
    console.log('\n📄 Réponse OpenAI (premiers 800 caractères):');
    console.log(result.substring(0, 800) + '...');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testFinal(); 