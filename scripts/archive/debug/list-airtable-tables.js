require('dotenv').config();

async function listAirtableTables() {
  console.log('📋 === LISTE DES TABLES AIRTABLE ===');
  
  const token = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  
  if (!token || !baseId) {
    console.log('❌ Configuration manquante');
    return;
  }

  try {
    console.log('🔄 Récupération des métadonnées de la base...');
    
    const response = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log(`✅ Base trouvée avec ${data.tables.length} table(s):`);
    console.log('');
    
    data.tables.forEach((table, index) => {
      console.log(`${index + 1}. 📋 ${table.name}`);
      console.log(`   ID: ${table.id}`);
      console.log(`   Champs principaux: ${table.fields.slice(0, 20).map(f => f.name).join(', ')}${table.fields.length > 20 ? '...' : ''}`);
      console.log('');
    });
    
    // Générer le code pour l'extraction
    console.log('🔧 Code à utiliser dans extract-airtable.ts:');
    console.log('');
    console.log('const tables = [');
    data.tables.forEach(table => {
      console.log(`  '${table.name}',`);
    });
    console.log('];');
    
  } catch (error) {
    console.log(`❌ Erreur: ${error.message}`);
    
    if (error.message.includes('404')) {
      console.log('');
      console.log('💡 Solutions possibles:');
      console.log('1. Vérifiez que le Base ID est correct');
      console.log('2. Vérifiez que votre token a accès à cette base');
      console.log('3. Vérifiez que la base existe encore');
    }
  }
}

listAirtableTables().catch(console.error);