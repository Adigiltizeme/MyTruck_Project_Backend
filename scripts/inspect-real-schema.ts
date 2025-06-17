import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class SchemaInspector {

    async inspectCommandesTable(): Promise<void> {
        console.log('🔍 Inspection de la table commandes...\n');

        try {
            // 1. Obtenir la structure exacte de la table
            const columns = await prisma.$queryRaw`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'commandes' 
          AND table_schema = 'public'
        ORDER BY ordinal_position;
      `;

            console.log('📋 STRUCTURE RÉELLE DE LA TABLE COMMANDES:');
            console.log('='.repeat(60));

            // @ts-ignore
            columns.forEach((col: any, index: number) => {
                const nullable = col.is_nullable === 'YES' ? '(optionnel)' : '(requis)';
                const defaultVal = col.column_default ? ` DEFAULT: ${col.column_default}` : '';
                console.log(`${index + 1}. ${col.column_name} - ${col.data_type} ${nullable}${defaultVal}`);
            });

            console.log('\n' + '='.repeat(60));

            // 2. Tester avec une commande existante pour voir le format
            const existingCommande = await prisma.commande.findFirst();

            if (existingCommande) {
                console.log('\n📦 EXEMPLE DE COMMANDE EXISTANTE:');
                console.log('='.repeat(60));
                console.log(JSON.stringify(existingCommande, null, 2));
                console.log('='.repeat(60));
            }

            // 3. Générer un template de création
            console.log('\n🛠️ TEMPLATE POUR CRÉATION:');
            console.log('='.repeat(60));
            console.log('const commandeData = {');

            // @ts-ignore
            columns.forEach((col: any) => {
                if (col.column_name !== 'id' && col.column_name !== 'createdAt' && col.column_name !== 'updatedAt') {
                    const example = this.getExampleValue(col.column_name, col.data_type);
                    console.log(`  ${col.column_name}: ${example}, // ${col.data_type}`);
                }
            });

            console.log('};');
            console.log('='.repeat(60));

        } catch (error) {
            console.error('❌ Erreur inspection:', error);
        }
    }

    private getExampleValue(columnName: string, dataType: string): string {
        // Générer des exemples basés sur le type de données
        if (dataType.includes('varchar') || dataType.includes('text')) {
            return `"exemple_${columnName}"`;
        } else if (dataType.includes('timestamp') || dataType.includes('date')) {
            return 'new Date()';
        } else if (dataType.includes('boolean')) {
            return 'false';
        } else if (dataType.includes('integer') || dataType.includes('numeric')) {
            return '0';
        } else if (dataType.includes('uuid')) {
            return 'uuidv4()';
        } else {
            return `"${columnName}_value"`;
        }
    }

    async testMinimalCreation(): Promise<void> {
        console.log('\n🧪 Test de création minimale...');

        try {
            // Obtenir un magasin et client pour les FK
            const magasin = await prisma.magasin.findFirst();
            const client = await prisma.client.findFirst();

            if (!magasin || !client) {
                console.log('❌ Pas de magasin ou client pour le test');
                return;
            }

            // Essayer de créer avec seulement les champs obligatoires
            const testData = {
                numeroCommande: `TEST_${Date.now()}`,
                magasin: { connect: { id: magasin.id } },
                client: { connect: { id: client.id } },
                dateLivraison: new Date(),
            };

            console.log('📝 Données de test:', testData);

            const testCommande = await prisma.commande.create({
                data: testData
            });

            console.log('✅ Création test réussie !');
            console.log('📦 Commande créée:', testCommande);

            // Supprimer la commande de test
            await prisma.commande.delete({
                where: { id: testCommande.id }
            });

            console.log('🗑️ Commande de test supprimée');

        } catch (error: any) {
            console.log('❌ Erreur création test:');
            console.log('Message:', error.message);

            if (error.message.includes('Unknown argument')) {
                console.log('\n💡 Il semble que les noms de colonnes soient différents !');
                console.log('Vérifiez le schéma Prisma dans prisma/schema.prisma');
            }
        }
    }

    async listAllTables(): Promise<void> {
        console.log('\n📋 Liste de toutes les tables:');

        try {
            const tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `;

            // @ts-ignore
            tables.forEach((table: any, index: number) => {
                console.log(`${index + 1}. ${table.table_name}`);
            });

        } catch (error) {
            console.error('❌ Erreur liste tables:', error);
        }
    }
}

// Script principal
async function main() {
    const inspector = new SchemaInspector();

    try {
        console.log('🔍 INSPECTION COMPLÈTE DU SCHÉMA');
        console.log('='.repeat(60));

        await inspector.listAllTables();
        await inspector.inspectCommandesTable();
        await inspector.testMinimalCreation();

    } catch (error) {
        console.error('❌ Erreur inspection:', error);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main();
}