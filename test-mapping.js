// Test mappage contraintes RDPPF
require('dotenv').config();
require('ts-node').register({ transpileOnly: true });

async function testMapping() {
  console.log('🔍 Test mappage contraintes...');
  
  try {
    const { analyzeRdppf } = require('./src/lib/rdppfExtractor');
    
    console.log('\n1. Extraction RDPPF...');
    const rdppfUrl = 'https://rdppfvs.geopol.ch/extract/pdf?EGRID=CH773017495270&LANG=fr';
    const rdppfConstraints = await analyzeRdppf(rdppfUrl);
    
    console.log('\n2. Mappage vers RegulationConstraint...');
    const mapped = rdppfConstraints.map(c => ({ zone: '*', theme: c.theme, rule: c.rule }));
    
    console.log('\n3. Résultat mappage:');
    mapped.forEach((c, i) => {
      console.log(`${i+1}. Zone: "${c.zone}", Thème: "${c.theme}"`);
      console.log(`   Règle: "${c.rule}"`);
      console.log(`   JSON: ${JSON.stringify(c)}`);
      console.log('---');
    });
    
    console.log('\n4. Test buildConstraintTable...');
    const { buildConstraintTable } = require('./src/lib/buildConstraintTable');
    
    const tableMarkdown = buildConstraintTable(mapped, null, {});
    console.log('\n📄 Tableau généré:');
    console.log(tableMarkdown);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testMapping(); 