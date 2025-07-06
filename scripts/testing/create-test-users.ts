import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createTestUsers() {
    const saltRounds = 12;

    // Créer un magasin de test
    // Try to find existing magasin by name (since nom is not unique, we use findFirst)
    let testMagasin = await prisma.magasin.findFirst({
        where: { nom: 'Magasin Test' },
    });

    if (!testMagasin) {
        testMagasin = await prisma.magasin.create({
            data: {
                nom: 'Magasin Test',
                adresse: '123 Rue de Test',
                telephone: '0123456789',
                email: 'test@magasin.com',
            },
        });
    }

    const testUsers = [
        {
            email: 'admin@test.com',
            password: await bcrypt.hash('admin123', saltRounds),
            nom: 'Admin',
            prenom: 'Test',
            role: 'ADMIN',
            magasinId: null,
        },
        {
            email: 'magasin@test.com',
            password: await bcrypt.hash('magasin123', saltRounds),
            nom: 'Magasin',
            prenom: 'Test',
            role: 'MAGASIN',
            magasinId: testMagasin.id,
        },
        {
            email: 'chauffeur@test.com',
            password: await bcrypt.hash('chauffeur123', saltRounds),
            nom: 'Chauffeur',
            prenom: 'Test',
            role: 'CHAUFFEUR',
            magasinId: null,
        },
    ];

    for (const userData of testUsers) {
        const { email, password, nom, prenom, role, magasinId } = userData;
        const updateData: any = { password, nom, prenom, role };
        if (magasinId) {
            updateData.magasin = { connect: { id: magasinId } };
        } else {
            updateData.magasin = { disconnect: true };
        }
        const createData: any = { email, password, nom, prenom, role };
        if (magasinId) {
            createData.magasin = { connect: { id: magasinId } };
        }
        const user = await prisma.user.upsert({
            where: { email },
            update: updateData,
            create: createData,
        });
        console.log(`✅ Utilisateur créé: ${user.email} (${user.role})`);
    }

    console.log('\n🔑 Utilisateurs de test créés:');
    console.log('Admin: admin@test.com / admin123');
    console.log('Magasin: magasin@test.com / magasin123');
    console.log('Chauffeur: chauffeur@test.com / chauffeur123');
}

createTestUsers()
    .catch((e) => {
        console.error('❌ Erreur:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });