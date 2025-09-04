require('dotenv').config();

console.log('=== TEST VARIABLES ENVIRONNEMENT ===');
console.log('Fichier .env existe:', require('fs').existsSync('.env'));
console.log('Contenu .env:', require('fs').readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('JWT')));
console.log('process.env.JWT_SECRET:', !!process.env.JWT_SECRET);
console.log('Longueur:', process.env.JWT_SECRET?.length);
console.log('Première partie:', process.env.JWT_SECRET?.substring(0, 10));
console.log('Toutes les vars JWT:', Object.keys(process.env).filter(k => k.includes('JWT')));