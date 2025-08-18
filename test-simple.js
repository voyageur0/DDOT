#!/usr/bin/env node
require('dotenv').config();

const { analyzeSimple } = require('./src/lib/simpleDocumentAnalysis');

async function test() {
  console.log('TEST ANALYSE SIMPLE\n');
  
  // Parcelle 12558 Vétroz
  const result = await analyzeSimple('CH773017495270', 'Vétroz');
  
  console.log('\n=== RESULTAT ===\n');
  console.log(result);
}

test().catch(console.error);