const https = require('https');

// Script pour appeler l'endpoint de setup en production
async function callSetupEndpoint(railwayUrl) {
  const url = `${railwayUrl}/setup/admins`;
  
  console.log(`🚀 Appel de l'endpoint: ${url}`);
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('✅ Réponse:', JSON.stringify(response, null, 2));
          resolve(response);
        } catch (e) {
          console.log('📄 Réponse brute:', data);
          resolve(data);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erreur:', error);
      reject(error);
    });
    
    req.end();
  });
}

// Utilisation
if (process.argv[2]) {
  callSetupEndpoint(process.argv[2])
    .then(response => {
      console.log('\n🔐 Vos identifiants admin sont maintenant créés en production:');
      console.log('   - adama.digiltizeme@gmail.com / Adama123');
      console.log('   - mytruck.transport@gmail.com / Mytruck123');
      console.log('   - admin@test.com / admin123');
    })
    .catch(console.error);
} else {
  console.log('Usage: node setup-production.js https://votre-url-railway.railway.app');
  console.log('Exemple: node setup-production.js https://my-truck-api-production.up.railway.app');
}