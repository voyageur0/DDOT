const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkConnection() {
  console.log('🔍 Vérification de la connexion Supabase...\n');
  
  console.log('URL:', process.env.SUPABASE_URL);
  console.log('Key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Test simple
    const { data, error } = await supabase
      .from('label_dictionary')
      .select('count(*)', { count: 'exact', head: true });
      
    if (error) {
      console.log('❌ Erreur:', error);
    } else {
      console.log('✅ Connexion réussie');
    }
    
    // Vérifier si la table existe
    const { data: tables, error: tableError } = await supabase
      .rpc('check_table_exists', { table_name: 'label_dictionary' })
      .maybeSingle();
      
    if (tableError) {
      console.log('Table label_dictionary peut ne pas exister:', tableError.message);
    }
    
  } catch (err) {
    console.error('❌ Erreur de connexion:', err);
  }
}

checkConnection();