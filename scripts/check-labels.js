const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLabels() {
  console.log('\n=== VÉRIFICATION DES LABELS ===\n');
  
  // 1. Vérifier les labels de zones
  const { data: zoneLabels } = await supabase
    .from('label_dictionary')
    .select('*')
    .eq('type', 'zone')
    .order('code');
    
  console.log('📍 LABELS DE ZONES:');
  zoneLabels?.forEach(label => {
    console.log(`  ${label.code}: "${label.label_fr_short}" (${label.label_fr_long || 'pas de version longue'})`);
  });
  
  // 2. Vérifier les labels de contraintes
  const { data: constraintLabels } = await supabase
    .from('label_dictionary')
    .select('*')
    .eq('type', 'constraint')
    .order('severity', { ascending: false })
    .limit(10);
    
  console.log('\n⚠️  LABELS DE CONTRAINTES (top 10 par sévérité):');
  constraintLabels?.forEach(label => {
    console.log(`  [Sév.${label.severity}] ${label.code}: "${label.label_fr_short}"`);
  });
  
  // 3. Vérifier les labels de champs
  const { data: fieldLabels } = await supabase
    .from('label_dictionary')
    .select('*')
    .eq('type', 'field')
    .limit(10);
    
  console.log('\n📋 LABELS DE CHAMPS:');
  fieldLabels?.forEach(label => {
    console.log(`  ${label.code}: "${label.label_fr_short}"`);
  });
  
  // 4. Vérifier les labels trop longs (>12 mots)
  const { data: allLabels } = await supabase
    .from('label_dictionary')
    .select('code, type, label_fr_short');
    
  console.log('\n❌ LABELS TROP LONGS (>12 mots):');
  let tooLongCount = 0;
  allLabels?.forEach(label => {
    const wordCount = label.label_fr_short.split(' ').length;
    if (wordCount > 12) {
      console.log(`  [${label.type}] ${label.code}: "${label.label_fr_short}" (${wordCount} mots)`);
      tooLongCount++;
    }
  });
  
  if (tooLongCount === 0) {
    console.log('  ✅ Tous les labels respectent la limite de 12 mots');
  }
  
  // 5. Statistiques
  const { count: totalLabels } = await supabase
    .from('label_dictionary')
    .select('*', { count: 'exact', head: true });
    
  const { count: zoneCount } = await supabase
    .from('label_dictionary')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'zone');
    
  const { count: constraintCount } = await supabase
    .from('label_dictionary')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'constraint');
    
  const { count: fieldCount } = await supabase
    .from('label_dictionary')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'field');
    
  console.log('\n📊 STATISTIQUES:');
  console.log(`  Total des labels: ${totalLabels}`);
  console.log(`  - Zones: ${zoneCount}`);
  console.log(`  - Contraintes: ${constraintCount}`);
  console.log(`  - Champs: ${fieldCount}`);
}

checkLabels().catch(console.error);