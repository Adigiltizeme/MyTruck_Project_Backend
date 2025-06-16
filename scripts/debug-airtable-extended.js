require('dotenv').config();
const Airtable = require('airtable');

async function debugAirtableExtended() {
  console.log('🔍 === DIAGNOSTIC AIRTABLE ÉTENDU ===');
  
  const token = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  
  console.log(`🔑 Token: ${token ? token.substring(0, 15) + '...' : 'Non défini'}`);
  console.log(`📊 Base ID: ${baseId || 'Non défini'}`);
  
  if (!token || !baseId) {
    console.log('❌ Configuration manquante');
    return;
  }

  try {
    console.log('\n🔄 Test 1: Connexion de base...');
    const base = new Airtable({ apiKey: token }).base(baseId);
    
    console.log('\n🔄 Test 2: Liste des tables via API REST...');
    // Tester avec l'API REST directement
    const response = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Connexion réussie via API REST !');
      console.log('📋 Tables disponibles:');
      data.tables.forEach((table, index) => {
        console.log(`  ${index + 1}. ${table.name} (ID: ${table.id})`);
      });
      
      // Tester l'accès à la première table
      if (data.tables.length > 0) {
        const firstTable = data.tables[0];
        console.log(`\n🔄 Test 3: Lecture de la table "${firstTable.name}"...`);
        
        try {
          const records = await base(firstTable.name).select({ maxRecords: 1 }).firstPage();
          console.log(`✅ Lecture réussie ! ${records.length} enregistrement(s) trouvé(s)`);
          
          if (records.length > 0) {
            console.log('📋 Structure du premier enregistrement:');
            console.log(`  ID: ${records[0].id}`);
            console.log(`  Champs: ${Object.keys(records[0].fields).join(', ')}`);
          }
        } catch (error) {
          console.log(`❌ Erreur lecture table: ${error.message}`);
        }
      }
      
    } else {
      console.log(`❌ Erreur API REST: ${response.status} ${response.statusText}`);
      const errorData = await response.text();
      console.log(`📄 Réponse: ${errorData}`);
    }
    
  } catch (error) {
    console.log(`❌ Erreur générale: ${error.message}`);
    
    // Tests supplémentaires pour diagnostiquer
    console.log('\n🔄 Test 4: Validation du format du token...');
    if (token.startsWith('pat')) {
      console.log('✅ Format Personal Access Token détecté');
    } else if (token.startsWith('key')) {
      console.log('⚠️  Format ancienne API Key détecté (deprecated)');
    } else {
      console.log('❌ Format de token non reconnu');
    }
    
    console.log('\n🔄 Test 5: Validation du Base ID...');
    if (baseId.startsWith('app') && baseId.length === 17) {
      console.log('✅ Format Base ID correct');
    } else {
      console.log('❌ Format Base ID incorrect');
      console.log('   Format attendu: app + 14 caractères (ex: appXXXXXXXXXXXXXX)');
    }
  }
}

debugAirtableExtended().catch(console.error);