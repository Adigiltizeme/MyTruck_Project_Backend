import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Début du seeding...');

    // Nettoyer les données existantes
    await prisma.user.deleteMany();
    await prisma.magasin.deleteMany();
    await prisma.chauffeur.deleteMany();

    // Créer des magasins de test
    const magasinTruffautIvry = await prisma.magasin.create({
        data: {
            nom: 'Truffaut Ivry',
            adresse: '36 Rue Ernest Renan, 94200 Ivry-sur-Seine',
            telephone: '+33140253030',
            email: 'contact@truffaut-ivry.com',
            status: 'Actif',
            categories: ['Plantes/Arbres', 'Mobilier'],
        },
    });

    const magasinMyTruck = await prisma.magasin.create({
        data: {
            nom: 'My Truck Transport',
            adresse: 'Vitry-Sur-Seine',
            telephone: '+33708090102',
            email: 'contact@mytruck.com',
            status: 'Actif',
            categories: ['Préstataire'],
        },
    });

    // Créer des chauffeurs de test
    const chauffeur1 = await prisma.chauffeur.create({
        data: {
            nom: 'Dupont',
            prenom: 'Jean',
            telephone: '+33612345678',
            email: 'jean.dupont@mytruck.com',
            status: 'Actif',
            notes: 5,
        },
    });

    const chauffeur2 = await prisma.chauffeur.create({
        data: {
            nom: 'Martin',
            prenom: 'Pierre',
            telephone: '+33698765432',
            email: 'pierre.martin@mytruck.com',
            status: 'Actif',
            notes: 4,
        },
    });

    // Créer des utilisateurs de test
    const passwordHash = await bcrypt.hash('MyTruck2024!', 12);

    const adminUser = await prisma.user.create({
        data: {
            email: 'admin@mytruck.com',
            password: passwordHash,
            nom: 'Admin',
            prenom: 'Super',
            role: UserRole.ADMIN,
            status: 'Actif',
        },
    });

    const directionUser = await prisma.user.create({
        data: {
            email: 'direction@mytruck.com',
            password: passwordHash,
            nom: 'Direction',
            prenom: 'Chef',
            role: UserRole.DIRECTION,
            status: 'Actif',
            magasinId: magasinMyTruck.id,
        },
    });

    const magasinUser = await prisma.user.create({
        data: {
            email: 'magasin@truffaut-ivry.com',
            password: passwordHash,
            nom: 'Magasin',
            prenom: 'Responsable',
            role: UserRole.MAGASIN,
            status: 'Actif',
            magasinId: magasinTruffautIvry.id,
        },
    });

    const chauffeurUser = await prisma.user.create({
        data: {
            email: 'chauffeur@mytruck.com',
            password: passwordHash,
            nom: 'Chauffeur',
            prenom: 'Test',
            role: UserRole.CHAUFFEUR,
            status: 'Actif',
        },
    });

    console.log('✅ Seeding terminé !');
    console.log('\n📋 Utilisateurs créés:');
    console.log('👑 Admin: admin@mytruck.com / MyTruck2024!');
    console.log('🏢 Direction: direction@mytruck.com / MyTruck2024!');
    console.log('🏪 Magasin: magasin@truffaut-ivry.com / MyTruck2024!');
    console.log('🚛 Chauffeur: chauffeur@mytruck.com / MyTruck2024!');
    console.log('\n🏪 Magasins créés:');
    console.log(`📍 ${magasinTruffautIvry.nom} (${magasinTruffautIvry.id})`);
    console.log(`📍 ${magasinMyTruck.nom} (${magasinMyTruck.id})`);
    console.log('\n🚛 Chauffeurs créés:');
    console.log(`🚛 ${chauffeur1.nom} ${chauffeur1.prenom} (${chauffeur1.id})`);
    console.log(`🚛 ${chauffeur2.nom} ${chauffeur2.prenom} (${chauffeur2.id})`);
}

main()
    .catch((e) => {
        console.error('❌ Erreur lors du seeding:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });