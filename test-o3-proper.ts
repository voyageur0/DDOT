#!/usr/bin/env npx ts-node
require('dotenv').config();

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-dummy',
});

async function testO3Models() {
  console.log('🧪 Test des modèles o3 avec différentes configurations\n');
  
  const testPrompt = `Analyse cette situation urbanistique:
Une parcelle de 1000m² en zone résidentielle 0.5 avec IBUS 0.5.
Quelles sont les contraintes de construction?
Réponds en 100 mots maximum avec les valeurs exactes.`;

  // Test o3
  console.log('Testing o3...\n');
  try {
    const response1 = await openai.chat.completions.create({
      model: 'o3',
      messages: [
        { role: 'user', content: testPrompt }
      ]
    });
    console.log('✅ o3 sans paramètres:');
    console.log(response1.choices[0].message.content || '(vide)');
    console.log('---');
  } catch (error: any) {
    console.error('❌ o3 erreur:', error.message);
  }

  // Test o3 avec max_completion_tokens
  try {
    const response2 = await openai.chat.completions.create({
      model: 'o3',
      messages: [
        { role: 'user', content: testPrompt }
      ],
      max_completion_tokens: 500
    });
    console.log('✅ o3 avec max_completion_tokens:');
    console.log(response2.choices[0].message.content || '(vide)');
    console.log('---');
  } catch (error: any) {
    console.error('❌ o3 avec max_completion_tokens erreur:', error.message);
  }

  // Test o3-mini
  console.log('\nTesting o3-mini...\n');
  try {
    const response3 = await openai.chat.completions.create({
      model: 'o3-mini',
      messages: [
        { role: 'user', content: testPrompt }
      ]
    });
    console.log('✅ o3-mini sans paramètres:');
    console.log(response3.choices[0].message.content || '(vide)');
    console.log('---');
  } catch (error: any) {
    console.error('❌ o3-mini erreur:', error.message);
  }

  // Test o3-mini avec max_completion_tokens
  try {
    const response4 = await openai.chat.completions.create({
      model: 'o3-mini',
      messages: [
        { role: 'user', content: testPrompt }
      ],
      max_completion_tokens: 500
    });
    console.log('✅ o3-mini avec max_completion_tokens:');
    console.log(response4.choices[0].message.content || '(vide)');
    console.log('---');
  } catch (error: any) {
    console.error('❌ o3-mini avec max_completion_tokens erreur:', error.message);
  }

  // Test o1-mini (pour comparaison)
  console.log('\nTesting o1-mini pour comparaison...\n');
  try {
    const response5 = await openai.chat.completions.create({
      model: 'o1-mini',
      messages: [
        { role: 'user', content: testPrompt }
      ],
      max_completion_tokens: 500
    });
    console.log('✅ o1-mini:');
    console.log(response5.choices[0].message.content || '(vide)');
  } catch (error: any) {
    console.error('❌ o1-mini erreur:', error.message);
  }

  // Test gpt-4o (pour comparaison)
  console.log('\nTesting gpt-4o pour comparaison...\n');
  try {
    const response6 = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Tu es un expert urbaniste suisse.' },
        { role: 'user', content: testPrompt }
      ],
      max_tokens: 200,
      temperature: 0
    });
    console.log('✅ gpt-4o:');
    console.log(response6.choices[0].message.content || '(vide)');
  } catch (error: any) {
    console.error('❌ gpt-4o erreur:', error.message);
  }
}

testO3Models().catch(console.error);