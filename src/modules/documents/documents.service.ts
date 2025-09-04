import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { DocumentType, DocumentStatus } from '@prisma/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as fs from 'fs';
import * as path from 'path';
import { JwtService } from '@nestjs/jwt';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class DocumentsService {
    private readonly logger = new Logger(DocumentsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly cloudinaryService: CloudinaryService,
        // private readonly emailService: EmailService, // TODO: Implémenter
    ) { }

    private fallback(value: any, defaultValue = 'Non spécifié') {
        if (value === undefined || value === null || value === '' || value === 'undefined' || value === 'N/A') {
            return defaultValue;
        }
        return value;
    }

    private formatDate(date: any, defaultValue: string = 'Non spécifiée'): string {
        if (!date) return defaultValue;
        try {
            return new Date(date).toLocaleDateString('fr-FR');
        } catch {
            return defaultValue;
        }
    }

    private checkPageOverflow(doc: jsPDF, yPos: number, spaceNeeded: number = 20): number {
        const pageHeight = doc.internal.pageSize.height;
        const maxY = pageHeight - 30; // Marge pour footer

        if (yPos + spaceNeeded > maxY) {
            doc.addPage();
            // this.addMyTruckHeader(doc); // Réajouter header sur nouvelle page
            return 85; // Position après header
        }

        return yPos;
    }

    // ✅ VALIDATION ENTITÉ
    private async validateEntity(entityId: string, entityType: 'commande' | 'cession'): Promise<any> {
        if (entityType === 'commande') {
            return await this.prisma.commande.findUniqueOrThrow({
                where: { id: entityId },
                include: {
                    client: true,
                    magasin: true,
                    articles: true,
                    chauffeurs: { include: { chauffeur: true } }
                }
            });
        } else {
            return await this.prisma.cessionInterMagasin.findUniqueOrThrow({
                where: { id: entityId },
                include: {
                    magasinOrigine: true,
                    magasinDestination: true
                }
            });
        }
    }

    // ✅ GÉNÉRATION NUMÉRO DOCUMENT
    private async generateDocumentNumber(type: DocumentType): Promise<string> {
        const prefix = {
            BON_COMMANDE: 'BC',
            BON_CESSION: 'CESS',
            DEVIS: 'DEV',
            FACTURE: 'FAC',
            AVOIR: 'AV',
            RAPPORT_LIVRAISON: 'RL'
        };

        const year = new Date().getFullYear();
        const timestamp = Date.now();

        return `${prefix[type]}-${year}-${timestamp}`;
    }

    private transformCommandeForTemplate(commande: any): any {
        console.log('🔍 Commande brute reçue:', JSON.stringify(commande, null, 2));

        // Extraction sécurisée des données imbriquées
        const client = commande.client || {};
        const magasin = commande.magasin || {};
        const articles = commande.articles || {};

        const templateData = {
            numeroCommande: this.fallback(commande.numeroCommande),
            dateCommande: this.formatDate(commande.dateCommande),
            dateLivraison: this.formatDate(commande.dateLivraison),
            creneauLivraison: this.fallback(commande.creneauLivraison),

            client: {
                nom: this.fallback(client.nom || commande.clientNom),
                prenom: this.fallback(client.prenom || commande.clientPrenom),
                telephone: this.fallback(client.telephone || commande.clientTelephone),
                telephoneSecondaire: this.fallback(client.telephoneSecondaire || commande.clientTelephoneSecondaire, ''),
                adresse: {
                    ligne1: this.fallback(client.adresseLigne1 || commande.clientAdresseLigne1),
                    batiment: this.fallback(client.batiment || commande.clientBatiment, ''),
                    etage: this.fallback(client.etage || commande.clientEtage, ''),
                    interphone: this.fallback(client.interphone || commande.clientInterphone, ''),
                    ascenseur: Boolean(client.ascenseur || commande.clientAscenseur),
                    type: this.fallback(client.typeAdresse || commande.clientTypeAdresse, 'Domicile')
                }
            },

            magasin: {
                nom: this.fallback(magasin.nom || commande.magasinNom),
                adresse: this.fallback(magasin.adresse || commande.magasinAdresse),
                telephone: this.fallback(magasin.telephone || commande.magasinTelephone)
            },

            articles: {
                nombre: Number(articles.nombre || commande.nombreArticles || 0),
                details: this.fallback(articles.details || commande.detailsArticles),
                categories: Array.isArray(articles.categories) ? articles.categories :
                    Array.isArray(commande.categoriesArticles) ? commande.categoriesArticles : [],
                dimensions: Array.isArray(articles.dimensions) ? articles.dimensions :
                    Array.isArray(commande.dimensionsArticles) ? commande.dimensionsArticles : [],
                canBeTilted: Boolean(articles.canBeTilted || commande.canBeTilted)
            },

            vehicule: this.fallback(commande.categorieVehicule),
            equipiers: Number(commande.optionEquipier || 0),
            montantHT: Number(commande.tarifHT || 0),
            montantTTC: Number(commande.tarifHT || 0) * 1.2,
            remarques: this.fallback(commande.remarques, ''),

            chauffeurs: Array.isArray(commande.chauffeurs) ?
                commande.chauffeurs.filter(ch => ch && ch.chauffeur && ch.chauffeur.nom) : []
        };

        console.log('✅ Template data transformé:', JSON.stringify(templateData, null, 2));
        return templateData;
    }

    // ✅ TRANSFORMATION CESSION POUR TEMPLATE
    private transformCessionForTemplate(cession: any): any {
        return {
            numeroCession: cession.numeroCession,
            dateCession: cession.dateCession,
            dateLivraison: cession.dateLivraison,
            creneauLivraison: cession.creneauLivraison,
            magasinOrigine: {
                nom: cession.magasinOrigine.nom,
                adresse: cession.magasinOrigine.adresse,
                telephone: cession.magasinOrigine.telephone
            },
            magasinDestination: {
                nom: cession.magasinDestination.nom,
                adresse: cession.magasinDestination.adresse,
                telephone: cession.magasinDestination.telephone
            },
            vehicule: cession.categorieVehicule,
            equipiers: cession.optionEquipier,
            montantHT: parseFloat(cession.tarifHT?.toString() || '0'),
            montantTTC: parseFloat(cession.tarifHT?.toString() || '0') * 1.2,
            nombreArticles: cession.nombreArticles,
            detailsArticles: cession.detailsArticles
        };
    }

    private async generatePDF(type: DocumentType, templateData: any): Promise<{ buffer: Buffer, size: number }> {
        const doc = new jsPDF();

        // ===== EN-TÊTE MY TRUCK =====
        if (type === DocumentType.FACTURE) {
            this.addMyTruckHeader(doc);
        }

        // ===== TITRE DOCUMENT =====
        this.addDocumentTitle(doc, type, templateData);

        // ===== CONTENU SELON TYPE =====
        let yPosition = 65; // Position après header

        switch (type) {
            case DocumentType.BON_COMMANDE:
                yPosition = this.generateBonCommandePDF(doc, templateData, yPosition, type);
                break;
            case DocumentType.BON_CESSION:
                yPosition = this.generateBonCessionPDF(doc, templateData, yPosition);
                break;
            case DocumentType.DEVIS:
                this.generateDevisPDF(doc, templateData);
                break;
            case DocumentType.FACTURE:
                this.generateFacturePDF(doc, templateData);
                break;
        }

        // ===== PIED DE PAGE =====
        this.addMyTruckFooter(doc);

        // Conversion en buffer
        const pdfArrayBuffer = doc.output('arraybuffer');
        const pdfBuffer = Buffer.from(pdfArrayBuffer);

        return {
            buffer: pdfBuffer,
            size: pdfBuffer.length
        };
    }

    private addMyTruckHeader(doc: jsPDF): void {
        const pageWidth = doc.internal.pageSize.width;

        // Rectangle rouge header
        doc.setFillColor(220, 20, 60); // #DC143C
        doc.rect(0, 0, pageWidth, 35, 'F');

        // Logo text MY TRUCK (blanc)
        doc.setTextColor(255, 255, 255); // Blanc
        doc.setFontSize(24);
        doc.setFont(undefined, 'bold');
        doc.text('MY TRUCK', pageWidth / 2, 15, { align: 'center' });

        // Ligne de séparation
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(2);
        doc.line(60, 18, pageWidth - 60, 18);

        // Sous-titre
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.text('Transport et Livraison', pageWidth / 2, 27, { align: 'center' });

        // Coordonnées entreprise (sous header)
        doc.setTextColor(44, 62, 80); // Gris foncé
        doc.setFontSize(9);
        doc.text('139, Bd de Stalingrad, 94400 VITRY SUR SEINE', pageWidth / 2, 45, { align: 'center' });
        doc.text('Tél: 06 22 15 62 60 | Email: mytruck.transport@gmail.com', pageWidth / 2, 52, { align: 'center' });
        doc.text('RCS Créteil: 851 349 357', pageWidth / 2, 59, { align: 'center' });
    }

    // ===== TITRE DOCUMENT =====
    private addDocumentTitle(doc: jsPDF, type: DocumentType, data: any): void {
        const titres = {
            BON_COMMANDE: 'BON DE COMMANDE',
            BON_CESSION: 'BON DE CESSION INTER-MAGASINS',
            DEVIS: 'DEVIS',
            FACTURE: 'FACTURE',
            AVOIR: 'AVOIR',
            RAPPORT_LIVRAISON: 'RAPPORT DE LIVRAISON'
        };

        const pageWidth = doc.internal.pageSize.width;

        // Titre principal
        if (type !== DocumentType.FACTURE) {
            doc.setFontSize(18);
            doc.setTextColor(220, 20, 60); // Rouge My Truck
            doc.setFont(undefined, 'bold');
            doc.text(titres[type], pageWidth / 2, 28, { align: 'center' });

            // Numéro document et date
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            const numeroDoc = data.numeroCommande || data.numeroDocument || 'N/A';
            const dateDoc = new Date().toLocaleDateString('fr-FR');
            doc.text(`N° ${numeroDoc} - ${dateDoc}`, pageWidth / 2, 42, { align: 'center' });
        } else {
            // Pour facture, titre en haut à gauche, après Coordonnées entreprise (sous header)
            // Numéro facture et date en dessous du titre
            doc.setFontSize(16);
            doc.setTextColor(220, 20, 60); // Rouge My Truck
            doc.setFont(undefined, 'bold');
            doc.text(titres[type], 15, 50);

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            const numeroDoc = data.numeroFacture || data.numeroDocument || 'N/A';
            const dateDoc = new Date().toLocaleDateString('fr-FR');
            doc.text(`N° ${numeroDoc}`, 15, 58);
            doc.text(`Date: ${dateDoc}`, 15, 65);
        }
    }

    // ===== BON DE COMMANDE COMPLET =====
    private generateBonCommandePDF(doc: jsPDF, data: any, yPos: number, type: DocumentType): number {
        const pageWidth = doc.internal.pageSize.width;
        const maxY = 250; // Limite pour tenir sur une page

        // SECTION INFORMATIONS COMMANDE (compacte)
        yPos = this.addSectionCompact(doc, 'INFORMATIONS COMMANDE', yPos);

        doc.setFontSize(9); // Police plus petite
        doc.setTextColor(44, 62, 80);
        doc.text(`Commande: ${data.numeroCommande}`, 15, yPos);
        doc.text(`Date: ${data.dateCommande}`, 100, yPos);
        yPos += 6;
        doc.text(`Livraison: ${data.dateLivraison}`, 15, yPos);
        doc.text(`Créneau: ${data.creneauLivraison}`, 100, yPos);
        yPos += 10;

        // CLIENT (compact)
        yPos = this.addSectionCompact(doc, 'CLIENT DESTINATAIRE', yPos);
        doc.setFont(undefined, 'bold');
        doc.text(`${data.client.nom} ${data.client.prenom}`, 15, yPos);
        yPos += 6;

        doc.setFont(undefined, 'normal');
        doc.text(data.client.adresse.ligne1, 15, yPos);
        yPos += 5;

        // Regrouper les détails adresse sur une ligne si possible
        const adresseDetails = [];
        if (data.client.adresse.etage !== 'Non spécifié') adresseDetails.push(`${data.client.adresse.etage}ème`);
        if (data.client.adresse.batiment !== 'Non spécifié') adresseDetails.push(`Bât. ${data.client.adresse.batiment}`);
        if (data.client.adresse.interphone !== 'Non spécifié') adresseDetails.push(`Code: ${data.client.adresse.interphone}`);

        if (adresseDetails.length > 0) {
            doc.text(adresseDetails.join(' - '), 15, yPos);
            yPos += 5;
        }

        doc.text(`Tél: ${data.client.telephone}`, 15, yPos);
        if (data.client.telephoneSecondaire !== '') {
            doc.text(`/ ${data.client.telephoneSecondaire}`, 80, yPos);
        }
        yPos += 5;

        if (data.client.adresse.ascenseur) {
            doc.setTextColor(34, 197, 94);
            doc.text('✓ Ascenseur', 15, yPos);
            doc.setTextColor(44, 62, 80);
            yPos += 5;
        }
        yPos += 8;

        // ARTICLES (compact)
        yPos = this.addSectionCompact(doc, 'ARTICLES', yPos);
        doc.text(`Quantité: ${data.articles.nombre}`, 15, yPos);
        yPos += 5;

        if (data.articles.details !== 'Non spécifié') {
            const detailLines = doc.splitTextToSize(data.articles.details, pageWidth - 30);
            // Limiter à 2 lignes maximum
            const limitedLines = detailLines.slice(0, 2);
            doc.text(limitedLines, 15, yPos);
            yPos += limitedLines.length * 5;
        }

        // Dimensions en format compact
        if (data.articles.dimensions.length > 0) {
            doc.text('Dimensions:', 15, yPos);
            yPos += 5;
            data.articles.dimensions.slice(0, 3).forEach((dim: any, index: number) => {
                if (dim && dim.longueur) {
                    doc.setFontSize(8);
                    doc.text(`${index + 1}. ${dim.longueur}×${dim.largeur}×${dim.hauteur}cm - ${dim.poids}kg`, 20, yPos);
                    yPos += 4;
                }
            });
            doc.setFontSize(9);
            yPos += 3;
        }

        // TRANSPORT (compact)
        yPos = this.addSectionCompact(doc, 'TRANSPORT', yPos);
        doc.text(`Véhicule: ${data.vehicule}`, 15, yPos);
        doc.text(`Équipiers: ${data.equipiers}`, 100, yPos);
        yPos += 8;

        // SIGNATURES (si espace restant)
        if (yPos < maxY - 40) {
            yPos = this.addSignatureSection(doc, type, yPos);
        }

        return yPos;
    }

    private addSectionCompact(doc: jsPDF, title: string, yPos: number): number {
        doc.setFillColor(248, 250, 252);
        doc.rect(10, yPos - 1, doc.internal.pageSize.width - 20, 8, 'F');

        doc.setTextColor(220, 20, 60);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text(title, 15, yPos + 4);

        return yPos + 12;
    }

    private generateBonCessionPDF(doc: jsPDF, data: any, yPos: number): number {
        // Informations cession
        doc.setFontSize(12);
        doc.setTextColor(44, 62, 80);
        doc.text(`Cession N° ${data.numeroCession}`, 15, yPos);
        doc.text(`Date: ${new Date(data.dateCession).toLocaleDateString('fr-FR')}`, 15, yPos + 7);
        yPos += 20;

        // Magasin origine
        doc.text('Magasin origine:', 15, yPos);
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`${data.magasinOrigine.nom}`, 15, yPos + 7);
        doc.text(`${data.magasinOrigine.adresse}`, 15, yPos + 14);
        yPos += 30;

        // Magasin destination
        doc.setFontSize(12);
        doc.setTextColor(44, 62, 80);
        doc.text('Magasin destination:', 15, yPos);
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`${data.magasinDestination.nom}`, 15, yPos + 7);
        doc.text(`${data.magasinDestination.adresse}`, 15, yPos + 14);
        yPos += 30;

        // Articles
        doc.setFontSize(12);
        doc.setTextColor(44, 62, 80);
        doc.text('Articles:', 15, yPos);
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Nombre: ${data.nombreArticles}`, 15, yPos + 7);
        doc.text(`Détails: ${data.detailsArticles || 'Non spécifié'}`, 15, yPos + 14);
        yPos += 21;

        return yPos;
    }

    // ✅ PDF DEVIS
    private generateDevisPDF(doc: jsPDF, data: any): void {
        let yPos = 55;

        // Numéro et date
        doc.setFontSize(10);
        doc.text(`Devis valable jusqu'au: ${new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')}`, 15, yPos);
        yPos += 15;

        // Client
        doc.setFontSize(12);
        doc.setTextColor(44, 62, 80);
        doc.text('Client:', 15, yPos);
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`${data.client.nom} ${data.client.prenom}`, 15, yPos + 7);
        yPos += 25;

        // Prestations
        const tableColumn = ["Désignation", "Prix HT (€)"];
        const tableRows = [
            ["Transport", data.montantHT.toFixed(2)],
            ["TVA (20%)", (data.montantHT * 0.2).toFixed(2)]
        ];

        // @ts-ignore
        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: yPos,
            theme: 'striped'
        });

        // @ts-ignore
        const finalY = (doc as any).lastAutoTable?.finalY || yPos + 50;

        // Total
        doc.setFontSize(12);
        doc.setTextColor(44, 62, 80);
        doc.text(`Total TTC: ${data.montantTTC.toFixed(2)} €`, 150, finalY + 10, { align: 'right' });
    }

    private generateFacturePDF(doc: jsPDF, data: any): void {
        console.log('📄 generateFacturePDF - données reçues:', JSON.stringify(data, null, 2));

        let yPos = 95;

        // EN-TÊTE FACTURE
        doc.setFontSize(10);
        doc.setTextColor(220, 20, 60);
        doc.text(`Facture émise le: ${this.formatDate(new Date())}`, 15, yPos);
        doc.text(`Échéance: ${this.formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))}`, 110, yPos);
        yPos += 15;

        // FACTURÉ À (LE MAGASIN - CLIENT DE MY TRUCK)
        yPos = this.addSection(doc, 'FACTURÉ À', yPos);

        doc.setTextColor(44, 62, 80);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(12);

        // ✅ ACCÈS SÉCURISÉ AUX DONNÉES MAGASIN
        const magasinNom = data.magasin?.nom || data.magasinNom || 'Magasin non spécifié';
        const magasinAdresse = data.magasin?.adresse || data.magasinAdresse || 'Adresse non spécifiée';
        const magasinTelephone = data.magasin?.telephone || data.magasinTelephone || 'Téléphone non spécifié';

        doc.text(magasinNom, 15, yPos);
        yPos += 8;

        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(magasinAdresse, 15, yPos);
        yPos += 6;
        doc.text(`Tél: ${magasinTelephone}`, 15, yPos);
        yPos += 15;

        // PRESTATION RÉALISÉE
        yPos = this.addSection(doc, 'PRESTATION RÉALISÉE', yPos);

        doc.setTextColor(100, 100, 100);
        doc.text(`Service: Transport et livraison`, 15, yPos);
        yPos += 6;

        const numeroCommande = data.numeroCommande || 'Non spécifié';
        doc.text(`Commande N°: ${numeroCommande}`, 15, yPos);
        yPos += 6;

        const dateLivraison = data.dateLivraison || 'Non spécifiée';
        doc.text(`Date prestation: ${dateLivraison}`, 15, yPos);
        yPos += 6;

        // ✅ ACCÈS SÉCURISÉ AUX DONNÉES CLIENT
        const clientNom = data.client?.nom || 'Non spécifié';
        const clientPrenom = data.client?.prenom || '';
        const clientAdresse = data.client?.adresse?.ligne1 || data.client?.adresse || 'Adresse non spécifiée';

        doc.text(`Destinataire final: ${clientNom} ${clientPrenom}`, 15, yPos);
        yPos += 6;
        doc.text(`Adresse livraison: ${clientAdresse}`, 15, yPos);
        yPos += 6;

        // ✅ ACCÈS SÉCURISÉ AUX ARTICLES
        const nombreArticles = data.articles?.nombre || data.nombreArticles || 0;
        const detailsArticles = data.articles?.details || data.detailsArticles || '';
        doc.text(`Articles: ${nombreArticles} article(s) - ${detailsArticles}`, 15, yPos);
        yPos += 15;

        // FACTURATION
        yPos = this.addSection(doc, 'FACTURATION', yPos);

        const montantHT = Number(data.montantHT || 0);
        const tva = montantHT * 0.2;
        const montantTTC = Number(data.montantTTC || montantHT + tva);

        doc.setTextColor(44, 62, 80);
        doc.text(`Prestation transport et livraison`, 15, yPos);
        doc.text(`${montantHT.toFixed(2)} € HT`, 150, yPos);
        yPos += 8;

        doc.text(`TVA 20%`, 15, yPos);
        doc.text(`${tva.toFixed(2)} €`, 150, yPos);
        yPos += 8;

        doc.setFont(undefined, 'bold');
        doc.setFontSize(12);
        doc.text(`TOTAL TTC`, 15, yPos);
        doc.text(`${montantTTC.toFixed(2)} €`, 150, yPos);
        yPos += 15;

        // MODALITÉS DE PAIEMENT
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text('Modalités: Paiement à 30 jours net - Pénalités de retard: 3 fois le taux légal', 15, yPos);
    }

    // ===== CONDITIONS SPÉCIALES =====
    private addDeliveryConditions(doc: jsPDF, conditions: any, yPos: number): number {
        if (!conditions) return yPos;

        yPos = this.addSection(doc, 'CONDITIONS SPÉCIALES DE LIVRAISON', yPos);

        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);

        if (conditions.rueInaccessible) {
            doc.setTextColor(220, 38, 127); // Rouge attention
            doc.text('🚫 Rue inaccessible - Portage nécessaire', 15, yPos);
            yPos += 6;
        }

        if (conditions.paletteComplete) {
            doc.setTextColor(245, 158, 11); // Orange
            doc.text('📦 Palette complète à dépalettiser', 15, yPos);
            yPos += 6;
        }

        if (conditions.parkingDistance && conditions.parkingDistance > 50) {
            doc.setTextColor(245, 158, 11);
            doc.text(`📏 Distance portage: ${conditions.parkingDistance}m`, 15, yPos);
            yPos += 6;
        }

        if (conditions.hasStairs && conditions.stairCount) {
            doc.setTextColor(168, 85, 247); // Violet
            doc.text(`🪜 Escaliers: ${conditions.stairCount} marches`, 15, yPos);
            yPos += 6;
        }

        if (conditions.isDuplex) {
            doc.setTextColor(59, 130, 246); // Bleu
            doc.text('🏠 Livraison en duplex/étages multiples', 15, yPos);
            yPos += 6;
        }

        if (conditions.needsAssembly) {
            doc.setTextColor(16, 185, 129); // Vert
            doc.text('🔧 Assemblage/Installation requis', 15, yPos);
            yPos += 6;
        }

        return yPos + 10;
    }

    // ===== UTILITAIRES DESIGN =====
    private addSection(doc: jsPDF, title: string, yPos: number): number {
        // Vérifier espace pour section
        yPos = this.checkPageOverflow(doc, yPos, 25);

        doc.setFillColor(248, 250, 252);
        doc.rect(10, yPos - 2, doc.internal.pageSize.width - 20, 12, 'F');

        doc.setTextColor(220, 20, 60);
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text(title, 15, yPos + 6);

        return yPos + 15; // Espacement réduit et constant
    }

    private addSignatureSection(doc: jsPDF, type: DocumentType, yPos: number): number {
        const pageWidth = doc.internal.pageSize.width;

        // Vérifier espace disponible
        if (yPos > 240) {
            doc.addPage();
            yPos = 30;
        }

        yPos = this.addSection(doc, 'SIGNATURES', yPos);

        // Signature My Truck
        doc.setTextColor(44, 62, 80);
        doc.setFontSize(10);
        doc.text('My Truck Transport', 15, yPos);
        doc.rect(15, yPos + 5, 80, 25); // Rectangle signature
        doc.setFontSize(8);
        doc.text('Signature et cachet', 20, yPos + 35);

        // Signature client/magasin
        const signataire = type === DocumentType.FACTURE ? 'Magasin' : 'Client destinataire';
        doc.setFontSize(10);
        doc.text(signataire, pageWidth - 95, yPos);
        doc.rect(pageWidth - 95, yPos + 5, 80, 25);
        doc.setFontSize(8);
        doc.text('Signature', pageWidth - 90, yPos + 35);

        return yPos + 45;
    }

    // ===== PIED DE PAGE =====
    private addMyTruckFooter(doc: jsPDF): void {
        const pageHeight = doc.internal.pageSize.height;
        const pageWidth = doc.internal.pageSize.width;

        // Ligne de séparation
        doc.setDrawColor(220, 20, 60);
        doc.setLineWidth(1);
        doc.line(15, pageHeight - 25, pageWidth - 15, pageHeight - 25);

        // Informations légales
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.text('MY TRUCK TRANSPORT ET LIVRAISON - 139, Bd de Stalingrad, 94400 VITRY SUR SEINE', pageWidth / 2, pageHeight - 18, { align: 'center' });
        doc.text('RCS Créteil: 851 349 357 | Tél: 06 22 15 62 60 | Email: mytruck.transport@gmail.com', pageWidth / 2, pageHeight - 12, { align: 'center' });
    }

    // ✅ MÉTHODES PRINCIPALES - Endpoints spécifiques
    async generateBonCommande(commandeId: string, userId: string): Promise<any> {
        console.log(`📄 Génération bon de commande pour commande ${commandeId}`);

        const commande = await this.validateEntity(commandeId, 'commande');
        const templateData = this.transformCommandeForTemplate(commande);

        // Générer PDF
        const pdfResult = await this.generatePDF(DocumentType.BON_COMMANDE, templateData);
        const numeroDocument = await this.generateDocumentNumber(DocumentType.BON_COMMANDE);

        // ✅ UPLOAD VERS CLOUDINARY AVEC URLs SIGNÉES
        const cloudinaryResult = await this.cloudinaryService.uploadPDF(
            pdfResult.buffer,
            `bon_commande_${numeroDocument}.pdf`,
            {
                documentType: 'BON_COMMANDE',
                commandeId,
                numeroDocument
            }
        );

        // Créer en base
        const document = await this.prisma.document.create({
            data: {
                type: DocumentType.BON_COMMANDE,
                numeroDocument,
                montantHT: templateData.montantHT,
                montantTTC: templateData.montantTTC,
                statut: 'VALIDE',
                url: cloudinaryResult.viewUrl, // ✅ URL SIGNÉE POUR APERÇU
                downloadUrl: cloudinaryResult.downloadUrl, // ✅ URL TÉLÉCHARGEMENT
                cloudinaryId: cloudinaryResult.publicId,
                fileName: `bon_commande_${numeroDocument}.pdf`,
                fileSize: pdfResult.size,
                commandeId,
                createdBy: userId,
                validatedBy: userId,
                validatedAt: new Date(),
                templateUsed: 'bon_commande_v1',
                generationData: templateData
            }
        });

        return document;
    }

    async getDocumentViewUrl(documentId: string): Promise<string> {
        const document = await this.prisma.document.findUniqueOrThrow({
            where: { id: documentId }
        });

        // ✅ GÉNÉRER NOUVELLE URL SIGNÉE (toujours fraîche)
        return this.cloudinaryService.generateFreshViewUrl(document.cloudinaryId, 2); // 2h
    }

    async getDocumentDownloadUrl(documentId: string): Promise<string> {
        const document = await this.prisma.document.findUniqueOrThrow({
            where: { id: documentId }
        });

        return this.cloudinaryService.generateDownloadUrl(
            document.cloudinaryId,
            document.fileName
        );
    }

    async generateBonCession(cessionId: string, userId: string): Promise<any> {
        console.log(`📄 Génération bon de cession pour cession ${cessionId}`);

        const cession = await this.validateEntity(cessionId, 'cession');
        const templateData = this.transformCessionForTemplate(cession);

        const pdfResult = await this.generatePDF(DocumentType.BON_CESSION, templateData);
        const numeroDocument = await this.generateDocumentNumber(DocumentType.BON_CESSION);

        const localFilePath = await this.saveToLocalStorage(pdfResult.buffer, `${DocumentType.BON_CESSION}_${numeroDocument}.pdf`);
        const mockUrl = `http://localhost:3000/api/v1/documents/local/${path.basename(localFilePath)}`;

        const document = await this.prisma.document.create({
            data: {
                type: DocumentType.BON_CESSION,
                numeroDocument,
                montantHT: templateData.montantHT,
                montantTTC: templateData.montantTTC,
                statut: 'VALIDE',
                url: mockUrl,
                fileName: `bon_cession_${numeroDocument}.pdf`,
                fileSize: pdfResult.size,
                cessionId: cessionId,
                createdBy: userId,
                validatedBy: userId,
                validatedAt: new Date(),
                templateUsed: 'bon_cession_v1',
                generationData: templateData
            }
        });

        return document;
    }

    async generateDevis(commandeId: string, userId: string, templateData: any): Promise<any> {
        console.log(`📄 Génération devis pour commande ${commandeId}`);

        const commande = await this.validateEntity(commandeId, 'commande');
        await this.validateBusinessRules(DocumentType.DEVIS, commande, 'commande');

        const pdfResult = await this.generatePDF(DocumentType.DEVIS, templateData);
        const numeroDocument = await this.generateDocumentNumber(DocumentType.DEVIS);

        const localFilePath = await this.saveToLocalStorage(pdfResult.buffer, `${DocumentType.DEVIS}_${numeroDocument}.pdf`);
        const mockUrl = `http://localhost:3000/api/v1/documents/local/${path.basename(localFilePath)}`;

        const document = await this.prisma.document.create({
            data: {
                type: DocumentType.DEVIS,
                numeroDocument,
                dateEcheance: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
                montantHT: templateData.montantHT,
                montantTTC: templateData.montantTTC,
                statut: 'EN_ATTENTE', // Nécessite validation
                url: mockUrl,
                fileName: `devis_${numeroDocument}.pdf`,
                fileSize: pdfResult.size,
                commandeId: commandeId,
                createdBy: userId,
                templateUsed: 'devis_v1',
                generationData: templateData
            }
        });

        return document;
    }

    async generateFacture(commandeId: string, userId: string, templateData: any): Promise<any> {
        console.log('📄 Génération facture pour commande', commandeId);
        console.log('📄 TemplateData reçu:', templateData);

        try {
            const commande = await this.validateEntity(commandeId, 'commande');
            console.log('📄 Commande trouvée:', commande.id, commande.numeroCommande);

            await this.validateBusinessRules(DocumentType.FACTURE, commande, 'commande');
            console.log('📄 Règles métier validées');

            // ✅ UTILISER LES DONNÉES COMPLÈTES DE LA COMMANDE
            const completeTemplateData = this.transformCommandeForTemplate(commande);

            // ✅ MERGER AVEC TEMPLATEDATA REÇU (montants, dates)
            const mergedData = {
                ...completeTemplateData,
                ...templateData, // Garde montants et dates du frontend
                // Force certaines données de la commande
                numeroCommande: commande.numeroCommande,
                dateCommande: this.formatDate(commande.dateCommande),
                dateLivraison: this.formatDate(commande.dateLivraison)
            };

            console.log('📄 Données complètes pour PDF:', JSON.stringify(mergedData, null, 2));

            const pdfResult = await this.generatePDF(DocumentType.FACTURE, mergedData);
            const numeroDocument = await this.generateDocumentNumber(DocumentType.FACTURE);

            const cloudinaryResult = await this.cloudinaryService.uploadPDF(
                pdfResult.buffer,
                `facture_${numeroDocument}.pdf`,
                {
                    documentType: 'FACTURE',
                    commandeId,
                    numeroDocument
                }
            );

            const document = await this.prisma.document.create({
                data: {
                    type: DocumentType.FACTURE,
                    numeroDocument,
                    dateEcheance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    montantHT: templateData.montantHT,
                    montantTTC: templateData.montantTTC,
                    statut: 'EN_ATTENTE',
                    url: cloudinaryResult.viewUrl,
                    downloadUrl: cloudinaryResult.downloadUrl,
                    cloudinaryId: cloudinaryResult.publicId,
                    fileName: `facture_${numeroDocument}.pdf`,
                    fileSize: pdfResult.size,
                    commandeId: commandeId,
                    createdBy: userId,
                    templateUsed: 'facture_v1',
                    generationData: mergedData,
                }
            });

            console.log('📄 Document créé en base:', document.id);
            return document;

        } catch (error) {
            console.error('❌ ERREUR generateFacture:', error);
            throw error;
        }
    }

    async getFreshViewUrl(documentId: string): Promise<string> {
        try {
            const document = await this.prisma.document.findUniqueOrThrow({
                where: { id: documentId }
            });

            console.log(`🔍 Document trouvé:`, {
                id: document.id,
                cloudinaryId: document.cloudinaryId,
                url: document.url?.substring(0, 50) + '...'
            });

            // ✅ DÉTECTION TYPE STOCKAGE
            if (!document.cloudinaryId || document.cloudinaryId.includes('uploads')) {
                console.log('📁 Document local (ancien système)');
                return document.url || '';
            }

            // ✅ NOUVEAUX DOCUMENTS CLOUDINARY
            if (document.cloudinaryId.includes('mytruck-documents')) {
                console.log(`☁️ Document Cloudinary (nouveau système): ${document.cloudinaryId}`);

                // ✅ GÉNÉRER URL AVEC resource_type: image
                const freshUrl = this.cloudinaryService.generateFreshViewUrl(document.cloudinaryId, 2);

                console.log(`✅ URL fraîche générée: ${freshUrl.substring(0, 50)}...`);

                return freshUrl;
            }

            // ✅ FALLBACK
            console.log('⚠️ Type document non reconnu, utilisation URL existante');
            return document.url || '';

        } catch (error) {
            console.error(`❌ Erreur génération URL fraîche ${documentId}:`, error);
            throw error;
        }
    }

    // ✅ Générer URL temporaire pour aperçu
    async generateTempViewUrl(documentId: string, userId: string): Promise<string> {
        try {
            // Vérifier que l'utilisateur peut accéder au document
            const document = await this.prisma.document.findUniqueOrThrow({
                where: { id: documentId },
                include: {
                    commande: {
                        include: {
                            magasin: true
                        }
                    }
                }
            });

            console.log(`📄 Génération URL temporaire pour document ${documentId}`);

            // Vérifier permissions (simplifié pour l'exemple)
            // TODO: Ajouter logique de permissions selon rôle utilisateur

            // Générer token temporaire (valide 10 minutes)
            const tempToken = this.generateTempToken(userId, documentId);

            const tempUrl = `http://localhost:3000/api/v1/documents/public/${documentId}/${tempToken}`;

            console.log(`✅ URL temporaire générée: ${tempUrl}`);

            return tempUrl;

        } catch (error) {
            console.error(`❌ Erreur génération URL temporaire ${documentId}:`, error);
            throw error;
        }
    }

    // ✅ MÉTHODE HELPER : Token temporaire
    private generateTempToken(userId: string, documentId: string): string {

        return this.jwtService.sign(
            {
                sub: userId,
                documentId,
                type: 'temp_document_access'
            },
            {
                expiresIn: '1h' // ✅ Expire dans 1 heure
            }
        );
    }

    // ✅ Stockage local temporaire
    private async saveToLocalStorage(buffer: Buffer, fileName: string): Promise<string> {
        try {
            // Créer dossier uploads s'il n'existe pas
            const uploadsDir = path.join(process.cwd(), 'uploads', 'documents');

            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }

            const filePath = path.join(uploadsDir, fileName);

            // Écrire le fichier
            fs.writeFileSync(filePath, buffer);

            console.log(`💾 PDF sauvé localement: ${filePath}`);
            return filePath;

        } catch (error) {
            console.error('❌ Erreur sauvegarde locale:', error);
            throw new BadRequestException('Impossible de sauvegarder le document');
        }
    }

    // ✅ NOUVELLE MÉTHODE : Téléchargement depuis stockage local
    // async downloadDocument(documentId: string): Promise<{ buffer: Buffer; fileName: string; contentType: string }> {
    //     try {
    //         const document = await this.prisma.document.findUniqueOrThrow({
    //             where: { id: documentId }
    //         });

    //         const localPath = document.cloudinaryId; // On réutilise ce champ

    //         if (!localPath || !fs.existsSync(localPath)) {
    //             throw new BadRequestException('Document non trouvé sur le serveur');
    //         }

    //         const buffer = fs.readFileSync(localPath);

    //         return {
    //             buffer,
    //             fileName: document.fileName || `document_${document.numeroDocument}.pdf`,
    //             contentType: 'application/pdf'
    //         };

    //     } catch (error) {
    //         console.error(`❌ Erreur téléchargement document ${documentId}:`, error);
    //         throw error;
    //     }
    // }

    // ✅ VALIDATION RÈGLES MÉTIER
    private async validateBusinessRules(
        type: DocumentType,
        entity: any,
        entityType: 'commande' | 'cession'
    ): Promise<void> {
        switch (type) {
            case DocumentType.DEVIS:
                if (entityType === 'commande') {
                    const needsQuote = entity.optionEquipier > 2 ||
                        entity.devisObligatoire;

                    if (!needsQuote) {
                        // throw new BadRequestException('Devis non requis pour cette commande');
                        console.log('⚠️ Devis non requis mais autorisation forcée');
                    }
                }
                break;

            case DocumentType.FACTURE:
                if (entityType === 'commande') {
                    console.log(`🔍 Validation facture: statut = ${entity.statutLivraison}`);

                    // ✅ ASSOUPLIR : Autoriser facture si livraison confirmée OU livrée
                    const canGenerateInvoice = ['LIVREE'].includes(entity.statutLivraison);

                    if (!canGenerateInvoice) {
                        console.log(`⚠️ Facture autorisée malgré statut ${entity.statutLivraison} (mode admin)`);
                        // Ne pas bloquer pour admin
                    }
                }
                break;

            case DocumentType.BON_COMMANDE:
            case DocumentType.BON_CESSION:
                // Toujours autorisé
                console.log('✅ Bon toujours autorisé');
                break;
        }

        console.log('✅ Validation règles métier terminée');
    }

    // ✅ RÉCUPÉRATION DOCUMENT
    async getDocument(documentId: string): Promise<any> {
        return await this.prisma.document.findUniqueOrThrow({
            where: { id: documentId }
        });
    }

    // ✅ VALIDATION DOCUMENT
    async validateDocument(documentId: string, userId: string): Promise<any> {
        return await this.prisma.document.update({
            where: { id: documentId },
            data: {
                statut: 'VALIDE',
                validatedBy: userId,
                validatedAt: new Date()
            }
        });
    }

    async deleteDocument(documentId: string, userId: string): Promise<void> {
        console.log(`🗑️ Suppression document ${documentId} par ${userId}`);

        try {
            // Récupérer le document
            const document = await this.prisma.document.findUniqueOrThrow({
                where: { id: documentId }
            });

            console.log(`📄 Document trouvé: ${document.numeroDocument} (${document.type})`);

            // Vérifier permissions
            if (document.createdBy !== userId) {
                // Seul l'admin peut supprimer les documents d'autres
                const user = await this.prisma.user.findUnique({
                    where: { id: userId },
                    select: { role: true }
                });

                if (user?.role !== 'ADMIN') {
                    throw new BadRequestException('Seul le créateur ou un admin peut supprimer ce document');
                }
            }

            // ✅ SUPPRIMER DE CLOUDINARY
            if (document.cloudinaryId) {
                try {
                    await this.cloudinaryService.deletePDF(document.cloudinaryId);
                    console.log(`✅ Document supprimé de Cloudinary: ${document.cloudinaryId}`);
                } catch (error) {
                    console.warn(`⚠️ Erreur suppression Cloudinary ${document.cloudinaryId}:`, error);
                }
            }

            // Supprimer de la base
            await this.prisma.document.delete({
                where: { id: documentId }
            });

            console.log(`✅ Document ${document.numeroDocument} supprimé avec succès`);

        } catch (error) {
            console.error(`❌ Erreur suppression document ${documentId}:`, error);
            throw error;
        }
    }
}