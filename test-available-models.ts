#!/usr/bin/env npx ts-node
require('dotenv').config();

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-dummy',
});

async function testAvailableModels() {
  console.log('🔍 Test des modèles OpenAI disponibles\n');
  
  // Liste des modèles à tester
  const modelsToTest = [
    'o3',           // Probablement pas encore disponible
    'o3-mini',      // Probablement pas encore disponible  
    'o1-preview',   // Devrait être disponible
    'o1-mini',      // Devrait être disponible
    'o1',           // Alias possible
    'gpt-4o',       // GPT-4 optimisé
    'gpt-4o-mini',  // GPT-4 mini
    'gpt-4-turbo',  // GPT-4 Turbo
    'gpt-4',        // GPT-4 standard
    'gpt-3.5-turbo' // GPT-3.5 Turbo
  ];
  
  console.log('Test avec message simple pour chaque modèle:\n');
  
  for (const model of modelsToTest) {
    try {
      console.log(`Testing ${model}...`);
      
      // Configuration différente pour les modèles o1
      const isO1Model = model.startsWith('o1') || model.startsWith('o3');
      
      if (isO1Model) {
        // Les modèles o1 n'acceptent pas de system message
        const response = await openai.chat.completions.create({
          model,
          messages: [
            { role: 'user', content: '2+2=' }
          ],
          max_completion_tokens: 10
        });
        console.log(`✅ ${model}: DISPONIBLE - Réponse: "${response.choices[0].message.content}"`);
      } else {
        // Modèles standards
        const response = await openai.chat.completions.create({
          model,
          messages: [
            { role: 'user', content: '2+2=' }
          ],
          max_tokens: 10,
          temperature: 0
        });
        console.log(`✅ ${model}: DISPONIBLE - Réponse: "${response.choices[0].message.content}"`);
      }
      
    } catch (error: any) {
      if (error.status === 404) {
        console.log(`❌ ${model}: NON DISPONIBLE (404)`);
      } else if (error.status === 401) {
        console.log(`❌ ${model}: ERREUR AUTH (401) - Vérifier la clé API`);
      } else if (error.status === 429) {
        console.log(`⚠️ ${model}: RATE LIMIT (429)`);
      } else {
        console.log(`❌ ${model}: ERREUR - ${error.message}`);
      }
    }
  }
  
  // Lister tous les modèles disponibles
  console.log('\n📋 Liste complète des modèles disponibles:\n');
  try {
    const models = await openai.models.list();
    const modelNames = models.data
      .map(m => m.id)
      .sort()
      .filter(id => 
        id.includes('gpt') || 
        id.includes('o1') || 
        id.includes('o3') ||
        id.includes('davinci') ||
        id.includes('turbo')
      );
    
    console.log('Modèles de chat disponibles:');
    modelNames.forEach(name => console.log(`  - ${name}`));
    
  } catch (error: any) {
    console.error('Erreur lors de la récupération de la liste:', error.message);
  }
}

testAvailableModels().catch(console.error);