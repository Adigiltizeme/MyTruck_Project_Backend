require('dotenv').config();

async function debugAirtable() {
    console.log('🔍 === DIAGNOSTIC AIRTABLE ===');

    // 1. Vérifier les variables d'environnement
    console.log('\n📋 Variables d\'environnement:');
    const token = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || process.env.AIRTABLE_API_KEY || process.env.VITE_AIRTABLE_TOKEN;
    const baseId = process.env.AIRTABLE_BASE_ID || process.env.VITE_AIRTABLE_BASE_ID;

    console.log('- AIRTABLE_PERSONAL_ACCESS_TOKEN:', token ? `✅ Défini (${token.substring(0, 10)}...)` : '❌ Non défini');
    console.log('- AIRTABLE_API_KEY:', process.env.AIRTABLE_API_KEY ? `✅ Défini (${process.env.AIRTABLE_API_KEY.substring(0, 10)}...)` : '❌ Non défini');
    console.log('- VITE_AIRTABLE_TOKEN:', process.env.VITE_AIRTABLE_TOKEN ? `✅ Défini (${process.env.VITE_AIRTABLE_TOKEN.substring(0, 10)}...)` : '❌ Non défini');
    console.log('- AIRTABLE_BASE_ID:', baseId ? `✅ Défini (${baseId})` : '❌ Non défini');
    console.log('- VITE_AIRTABLE_BASE_ID:', process.env.VITE_AIRTABLE_BASE_ID ? `✅ Défini (${process.env.VITE_AIRTABLE_BASE_ID})` : '❌ Non défini');

    if (!token || !baseId) {
        console.log('\n❌ ERREUR: Variables manquantes!');
        console.log('Ajoutez dans votre .env:');
        console.log('AIRTABLE_PERSONAL_ACCESS_TOKEN=patl.xxxxxxxxx');
        console.log('AIRTABLE_BASE_ID=appxxxxxxxxx');
        return;
    }

    // 2. Test de connexion simple avec axios
    console.log('\n🔄 Test de connexion à Airtable...');

    try {
        const axios = require('axios');

        const response = await axios.get(`https://api.airtable.com/v0/${baseId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'MyTruckApp/1.0'
            },
            timeout: 10000 // 10 secondes de timeout
        });

        console.log('✅ Connexion réussie à Airtable!');
        console.log('📊 Tables disponibles:', response.data.tables?.map(t => t.name) || 'Aucune table trouvée');

    } catch (error) {
        console.log('❌ Erreur de connexion:', error.message);

        if (error.response) {
            console.log('📄 Réponse du serveur:', error.response.status, error.response.statusText);
            console.log('📋 Détails:', error.response.data);
        } else if (error.code === 'ENOTFOUND') {
            console.log('🌐 Problème de réseau: Impossible de joindre Airtable');
        } else if (error.code === 'ETIMEDOUT') {
            console.log('⏰ Timeout: La connexion a pris trop de temps');
        }

        return;
    }

    // 3. Test avec la librairie Airtable
    console.log('\n🔄 Test avec la librairie Airtable...');

    try {
        const Airtable = require('airtable');

        console.log('📦 Version Airtable:', Airtable.VERSION || 'Version inconnue');

        const base = new Airtable({ apiKey: token }).base(baseId);

        // Essayer de lister les enregistrements d'une table commune
        const tables = ['Commandes', 'Users', 'Magasins', 'Personnel My Truck'];

        for (const tableName of tables) {
            try {
                console.log(`🔍 Test de la table "${tableName}"...`);

                const records = await base(tableName).select({
                    maxRecords: 1,
                    view: 'Grid view'
                }).firstPage();

                console.log(`✅ Table "${tableName}": ${records.length} enregistrement(s) trouvé(s)`);

                if (records.length > 0) {
                    const fields = Object.keys(records[0].fields);
                    console.log(`📋 Champs disponibles: ${fields.slice(0, 5).join(', ')}${fields.length > 5 ? '...' : ''}`);
                }

                break; // Si une table fonctionne, on peut continuer

            } catch (tableError) {
                console.log(`❌ Table "${tableName}": ${tableError.message}`);
            }
        }

    } catch (error) {
        console.log('❌ Erreur avec la librairie Airtable:', error.message);
    }

    console.log('\n🎯 === FIN DU DIAGNOSTIC ===');
}

// Lancer le diagnostic
debugAirtable().catch(console.error);