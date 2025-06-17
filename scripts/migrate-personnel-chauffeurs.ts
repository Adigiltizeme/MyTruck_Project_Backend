import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

export class PersonnelChauffeursMigrator {

    async migrateChauffeursFromPersonnel(): Promise<void> {
        console.log('🚛 Migration des chauffeurs depuis Personnel My Truck...\n');

        try {
            // 1. Analyser le fichier Personnel My Truck
            await this.analyzePersonnelFile();

            // 2. Identifier les chauffeurs
            const chauffeurs = await this.identifyChauffeurs();

            // 3. Migrer les chauffeurs manquants
            await this.migrateChauffeurs(chauffeurs);

            // 4. Rapport final
            await this.finalReport();

        } catch (error) {
            console.error('❌ Erreur migration chauffeurs:', error);
        }
    }

    private async analyzePersonnelFile(): Promise<void> {
        console.log('📊 Analyse du fichier Personnel My Truck...');

        try {
            const personnelData = JSON.parse(
                fs.readFileSync('./data/airtable-export/Personnel_My_Truck.json', 'utf8')
            );

            console.log(`📋 ${personnelData.length} enregistrements dans Personnel My Truck`);

            // Analyser les rôles disponibles
            const roles = new Set();
            const roleCount: Record<string, number> = {};

            personnelData.forEach(person => {
                const role = person.fields['ROLE'] || 'N/A';
                roles.add(role);
                roleCount[role] = (roleCount[role] || 0) + 1;
            });

            console.log('\n📈 Répartition par rôles:');
            Object.entries(roleCount).forEach(([role, count]) => {
                const emoji = role.toLowerCase().includes('chauffeur') ? '🚛' :
                    role.toLowerCase().includes('admin') ? '👨‍💼' :
                        role.toLowerCase().includes('support') ? '🛠️' : '👤';
                console.log(`   ${emoji} ${role}: ${count}`);
            });

            // Montrer quelques exemples de chauffeurs
            const exemplesChauffeurs = personnelData
                .filter(p => p.fields['ROLE']?.toLowerCase().includes('chauffeur'))
                .slice(0, 3);

            if (exemplesChauffeurs.length > 0) {
                console.log('\n👀 Exemples de chauffeurs trouvés:');
                exemplesChauffeurs.forEach((chauffeur, index) => {
                    const nom = chauffeur.fields['NOM'] || 'N/A';
                    const email = chauffeur.fields['E-MAIL'] || 'N/A';
                    const tel = chauffeur.fields['TELEPHONE'] || 'N/A';
                    console.log(`   ${index + 1}. ${nom} (${email}, ${tel})`);
                });
            }

        } catch (error) {
            console.error('❌ Erreur analyse fichier personnel:', error);
            throw error;
        }
    }

    private async identifyChauffeurs(): Promise<any[]> {
        console.log('\n🚛 Identification des chauffeurs...');

        try {
            const personnelData = JSON.parse(
                fs.readFileSync('./data/airtable-export/Personnel_My_Truck.json', 'utf8')
            );

            // Filtrer pour garder seulement les chauffeurs
            const chauffeurs = personnelData.filter(person => {
                const role = person.fields['ROLE']?.toLowerCase() || '';
                return role.includes('chauffeur');
            });

            console.log(`✅ ${chauffeurs.length} chauffeurs identifiés dans le personnel`);

            // Vérifier lesquels sont déjà migrés
            const postgresData = await prisma.chauffeur.findMany({
                select: { airtableId: true, nom: true, prenom: true }
            });

            const migratedIds = new Set(postgresData.map(c => c.airtableId).filter(Boolean));
            const missingChauffeurs = chauffeurs.filter(c => !migratedIds.has(c.id));

            console.log(`📊 État actuel:`);
            console.log(`   ✅ Déjà migrés: ${chauffeurs.length - missingChauffeurs.length}`);
            console.log(`   ❌ À migrer: ${missingChauffeurs.length}`);

            if (missingChauffeurs.length > 0) {
                console.log('\n📋 Chauffeurs à migrer:');
                missingChauffeurs.forEach((chauffeur, index) => {
                    const nom = chauffeur.fields['NOM'] || 'N/A';
                    const email = chauffeur.fields['E-MAIL'] || 'N/A';
                    console.log(`   ${index + 1}. ${nom} (${email}) - ID: ${chauffeur.id}`);
                });
            }

            return missingChauffeurs;

        } catch (error) {
            console.error('❌ Erreur identification chauffeurs:', error);
            throw error;
        }
    }

    private async migrateChauffeurs(chauffeurs: any[]): Promise<void> {
        console.log('\n🚀 Migration des chauffeurs...');

        if (chauffeurs.length === 0) {
            console.log('✅ Tous les chauffeurs sont déjà migrés !');
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const chauffeur of chauffeurs) {
            try {
                const fields = chauffeur.fields;

                // Validation des champs requis
                if (!fields['NOM']) {
                    console.warn(`⚠️ Chauffeur ${chauffeur.id} sans nom, ignoré`);
                    errorCount++;
                    continue;
                }

                // Préparer les données selon le schéma réel
                const chauffeurData = {
                    nom: fields['NOM'] || '',
                    prenom: fields['PRENOM'] || '', // Si le champ existe
                    email: fields['E-MAIL'] || null,
                    telephone: fields['TELEPHONE'] || null,
                    // Ajouter d'autres champs selon votre schéma chauffeur
                    statut: 'ACTIF', // Valeur par défaut
                    airtableId: chauffeur.id
                };

                // Vérifier l'unicité de l'email
                if (chauffeurData.email) {
                    const existingEmail = await prisma.chauffeur.findFirst({
                        where: { email: chauffeurData.email }
                    });

                    if (existingEmail) {
                        console.warn(`⚠️ Email ${chauffeurData.email} déjà utilisé, ajout suffix`);
                        chauffeurData.email = `${chauffeurData.email}.migrated${Date.now()}`;
                    }
                }

                // Créer le chauffeur
                await prisma.chauffeur.create({ data: chauffeurData });

                successCount++;
                console.log(`✅ ${chauffeurData.nom} migré avec succès`);

            } catch (error: any) {
                console.error(`❌ Erreur migration chauffeur ${chauffeur.id}:`, error.message);

                // Afficher plus de détails sur l'erreur
                if (error.message.includes('Unknown argument')) {
                    console.error('   💡 Problème de schéma - vérifiez les noms des colonnes');
                }

                errorCount++;
            }
        }

        console.log(`\n📊 RÉSULTATS MIGRATION:`);
        console.log(`   ✅ Succès: ${successCount}`);
        console.log(`   ❌ Erreurs: ${errorCount}`);
        console.log(`   📋 Total traités: ${chauffeurs.length}`);

        if (successCount > 0) {
            console.log(`\n🎉 Migration réussie pour ${successCount} chauffeurs !`);
        }
    }

    private async finalReport(): Promise<void> {
        console.log('\n📊 RAPPORT FINAL...');

        try {
            const totalChauffeurs = await prisma.chauffeur.count();
            const migratedChauffeurs = await prisma.chauffeur.count({
                where: { airtableId: { not: null } }
            });
            const manualChauffeurs = totalChauffeurs - migratedChauffeurs;

            console.log(`📈 État final des chauffeurs:`);
            console.log(`   👥 Total: ${totalChauffeurs}`);
            console.log(`   📥 Migrés d'Airtable: ${migratedChauffeurs}`);
            console.log(`   🆕 Ajoutés manuellement: ${manualChauffeurs}`);

            console.log(`\n🎯 Migration chauffeurs: ${migratedChauffeurs > 0 ? '✅ TERMINÉE' : '⚠️ À VÉRIFIER'}`);

            // Lister tous les chauffeurs pour vérification
            const allChauffeurs = await prisma.chauffeur.findMany({
                select: {
                    nom: true,
                    prenom: true,
                    email: true,
                    airtableId: true
                },
                orderBy: { nom: 'asc' }
            });

            console.log(`\n👥 Liste complète des chauffeurs en base:`);
            allChauffeurs.forEach((chauffeur, index) => {
                const source = chauffeur.airtableId ? '📥' : '🆕';
                const prenom = chauffeur.prenom || '';
                console.log(`   ${index + 1}. ${source} ${prenom} ${chauffeur.nom} (${chauffeur.email || 'Pas d\'email'})`);
            });

        } catch (error) {
            console.error('❌ Erreur rapport final:', error);
        }
    }

    async inspectPersonnelData(): Promise<void> {
        console.log('🔍 Inspection détaillée des données Personnel...\n');

        try {
            const personnelData = JSON.parse(
                fs.readFileSync('./data/airtable-export/Personnel_My_Truck.json', 'utf8')
            );

            console.log('📋 Structure des champs dans Personnel My Truck:');

            if (personnelData.length > 0) {
                const firstRecord = personnelData[0];
                const fields = Object.keys(firstRecord.fields || {});

                console.log('🔍 Champs disponibles:');
                fields.forEach((field, index) => {
                    console.log(`   ${index + 1}. ${field}`);
                });

                console.log('\n📝 Exemple d\'enregistrement:');
                console.log(JSON.stringify(firstRecord, null, 2));
            }

        } catch (error) {
            console.error('❌ Erreur inspection:', error);
        }
    }
}

// Script principal
async function main() {
    const migrator = new PersonnelChauffeursMigrator();

    try {
        // Inspection détaillée d'abord
        await migrator.inspectPersonnelData();

        console.log('\n' + '='.repeat(60) + '\n');

        // Migration des chauffeurs
        await migrator.migrateChauffeursFromPersonnel();

    } catch (error) {
        console.error('❌ Erreur script principal:', error);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main();
}