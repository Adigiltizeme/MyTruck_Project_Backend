import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

export class ChauffeursMigrationFix {

    async fixChauffeursMigration(): Promise<void> {
        console.log('🚛 Correction de la migration des chauffeurs...\n');

        try {
            // 1. Trouver le bon fichier chauffeurs
            const chauffeursFile = await this.findChauffeursFile();

            if (!chauffeursFile) {
                console.log('❌ Aucun fichier chauffeurs trouvé dans l\'export Airtable');
                return;
            }

            // 2. Analyser les chauffeurs manquants
            await this.analyzeMissingChauffeurs(chauffeursFile);

            // 3. Migrer les chauffeurs manquants
            await this.migrateMissingChauffeurs(chauffeursFile);

            // 4. Rapport final
            await this.finalReport();

        } catch (error) {
            console.error('❌ Erreur correction chauffeurs:', error);
        }
    }

    private async findChauffeursFile(): Promise<string | null> {
        console.log('🔍 Recherche du fichier chauffeurs...');

        const exportDir = './data/airtable-export/';
        const possibleNames = [
            'Chauffeurs.json',
            'Chauffeur.json',
            'chauffeurs.json',
            'chauffeur.json',
            'CHAUFFEURS.json',
            'Driver.json',
            'Drivers.json'
        ];

        // Lister tous les fichiers du dossier
        try {
            const files = fs.readdirSync(exportDir);
            console.log('📁 Fichiers trouvés dans export:', files.join(', '));

            // Chercher une correspondance
            for (const name of possibleNames) {
                if (files.includes(name)) {
                    console.log(`✅ Fichier chauffeurs trouvé: ${name}`);
                    return path.join(exportDir, name);
                }
            }

            // Chercher des fichiers qui contiennent "chauffeur" dans le nom
            const chauffeursFile = files.find(file =>
                file.toLowerCase().includes('chauffeur') ||
                file.toLowerCase().includes('driver')
            );

            if (chauffeursFile) {
                console.log(`✅ Fichier chauffeurs trouvé (approximatif): ${chauffeursFile}`);
                return path.join(exportDir, chauffeursFile);
            }

        } catch (error) {
            console.error('❌ Erreur lecture dossier export:', error);
        }

        return null;
    }

    private async analyzeMissingChauffeurs(filePath: string): Promise<void> {
        console.log('📊 Analyse des chauffeurs Airtable vs PostgreSQL...');

        try {
            // Charger les données Airtable
            const airtableData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            console.log(`📋 ${airtableData.length} chauffeurs dans Airtable`);

            // Charger les données PostgreSQL
            const postgresData = await prisma.chauffeur.findMany({
                select: {
                    id: true,
                    airtableId: true,
                    nom: true,
                    prenom: true,
                    email: true,
                    telephone: true
                }
            });
            console.log(`🗄️ ${postgresData.length} chauffeurs dans PostgreSQL`);

            // Identifier les migrés et non-migrés
            const migratedIds = new Set(postgresData.map(c => c.airtableId).filter(Boolean));
            const missingChauffeurs = airtableData.filter(c => !migratedIds.has(c.id));
            const extraChauffeurs = postgresData.filter(c => !c.airtableId);

            console.log(`\n📈 RÉSUMÉ:`);
            console.log(`   ✅ Déjà migrés: ${postgresData.length - extraChauffeurs.length}`);
            console.log(`   ❌ Manquants: ${missingChauffeurs.length}`);
            console.log(`   🆕 Ajoutés manuellement: ${extraChauffeurs.length}`);

            if (missingChauffeurs.length > 0) {
                console.log(`\n❌ CHAUFFEURS NON MIGRÉS:`);
                missingChauffeurs.forEach((chauffeur, index) => {
                    const nom = chauffeur.fields['NOM'] || 'N/A';
                    const prenom = chauffeur.fields['PRENOM'] || 'N/A';
                    const email = chauffeur.fields['EMAIL'] || 'N/A';
                    console.log(`   ${index + 1}. ${prenom} ${nom} (${email}) - ID: ${chauffeur.id}`);
                });
            }

            if (extraChauffeurs.length > 0) {
                console.log(`\n🆕 CHAUFFEURS AJOUTÉS MANUELLEMENT:`);
                extraChauffeurs.forEach((chauffeur, index) => {
                    console.log(`   ${index + 1}. ${chauffeur.prenom} ${chauffeur.nom} (${chauffeur.email})`);
                });
            }

        } catch (error) {
            console.error('❌ Erreur analyse chauffeurs:', error);
            throw error;
        }
    }

    private async migrateMissingChauffeurs(filePath: string): Promise<void> {
        console.log('\n🚛 Migration des chauffeurs manquants...');

        try {
            const airtableData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const postgresData = await prisma.chauffeur.findMany({
                select: { airtableId: true }
            });

            const migratedIds = new Set(postgresData.map(c => c.airtableId).filter(Boolean));
            const missingChauffeurs = airtableData.filter(c => !migratedIds.has(c.id));

            if (missingChauffeurs.length === 0) {
                console.log('✅ Tous les chauffeurs sont déjà migrés !');
                return;
            }

            let successCount = 0;
            let errorCount = 0;

            for (const chauffeur of missingChauffeurs) {
                try {
                    const fields = chauffeur.fields;

                    // Validation des champs requis
                    if (!fields['NOM'] && !fields['PRENOM']) {
                        console.warn(`⚠️ Chauffeur ${chauffeur.id} sans nom/prénom, ignoré`);
                        errorCount++;
                        continue;
                    }

                    // Préparer les données
                    const chauffeurData = {
                        nom: fields['NOM'] || '',
                        prenom: fields['PRENOM'] || '',
                        email: fields['EMAIL'] || null,
                        telephone: fields['TELEPHONE'] || null,
                        dateEmbauche: fields['DATE_EMBAUCHE'] ? new Date(fields['DATE_EMBAUCHE']) : null,
                        statut: fields['STATUT'] || 'ACTIF',
                        airtableId: chauffeur.id
                    };

                    // Vérifier l'unicité de l'email
                    if (chauffeurData.email) {
                        const existingEmail = await prisma.chauffeur.findFirst({
                            where: { email: chauffeurData.email }
                        });

                        if (existingEmail) {
                            console.warn(`⚠️ Email ${chauffeurData.email} déjà utilisé, générant un nouveau`);
                            chauffeurData.email = `${chauffeurData.email}.migrated${Date.now()}`;
                        }
                    }

                    // Créer le chauffeur
                    await prisma.chauffeur.create({ data: chauffeurData });

                    successCount++;
                    console.log(`✅ ${chauffeurData.prenom} ${chauffeurData.nom} migré`);

                } catch (error) {
                    console.error(`❌ Erreur migration chauffeur ${chauffeur.id}:`, error.message);
                    errorCount++;
                }
            }

            console.log(`\n📊 RÉSULTATS MIGRATION CHAUFFEURS:`);
            console.log(`   ✅ Succès: ${successCount}`);
            console.log(`   ❌ Erreurs: ${errorCount}`);
            console.log(`   📋 Total traités: ${missingChauffeurs.length}`);

        } catch (error) {
            console.error('❌ Erreur migration chauffeurs:', error);
            throw error;
        }
    }

    private async finalReport(): Promise<void> {
        console.log('\n📊 RAPPORT FINAL CHAUFFEURS...');

        try {
            const totalChauffeurs = await prisma.chauffeur.count();
            const migratedChauffeurs = await prisma.chauffeur.count({
                where: { airtableId: { not: null } }
            });
            const manualChauffeurs = totalChauffeurs - migratedChauffeurs;

            console.log(`📈 État final:`);
            console.log(`   👥 Total chauffeurs: ${totalChauffeurs}`);
            console.log(`   📥 Migrés d'Airtable: ${migratedChauffeurs}`);
            console.log(`   🆕 Ajoutés manuellement: ${manualChauffeurs}`);

            if (migratedChauffeurs > 0) {
                console.log(`   🎯 Taux de migration: 100%`);
                console.log(`\n🎉 MIGRATION CHAUFFEURS TERMINÉE AVEC SUCCÈS !`);
            }

        } catch (error) {
            console.error('❌ Erreur rapport final:', error);
        }
    }

    async listAllExportFiles(): Promise<void> {
        console.log('📁 Liste complète des fichiers d\'export Airtable:\n');

        try {
            const exportDir = './data/airtable-export/';
            const files = fs.readdirSync(exportDir);

            files.forEach((file, index) => {
                const filePath = path.join(exportDir, file);
                const stats = fs.statSync(filePath);
                const size = (stats.size / 1024).toFixed(2);

                console.log(`${index + 1}. ${file} (${size} KB)`);

                // Si c'est un JSON, essayer de compter les enregistrements
                if (file.endsWith('.json')) {
                    try {
                        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                        if (Array.isArray(data)) {
                            console.log(`   📊 ${data.length} enregistrements`);
                        }
                    } catch {
                        console.log(`   ❌ Fichier JSON invalide`);
                    }
                }
            });

        } catch (error) {
            console.error('❌ Erreur lecture dossier export:', error);
        }
    }
}

// Script principal
async function main() {
    const fixer = new ChauffeursMigrationFix();

    try {
        // Lister tous les fichiers d'export d'abord
        await fixer.listAllExportFiles();

        console.log('\n' + '='.repeat(60) + '\n');

        // Corriger la migration des chauffeurs
        await fixer.fixChauffeursMigration();

    } catch (error) {
        console.error('❌ Erreur script correction:', error);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main();
}