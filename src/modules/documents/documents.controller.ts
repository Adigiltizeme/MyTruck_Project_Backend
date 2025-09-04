import { Controller, Post, Get, Patch, Param, Body, UseGuards, Res, Delete } from '@nestjs/common';
import { Response } from 'express';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { ConfigService } from '@nestjs/config';

@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
    constructor(
        private readonly documentsService: DocumentsService,
        private readonly cloudinaryService: CloudinaryService,
        private readonly jwtService: JwtService,
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) { }

    @Get(':id/view-url')
    @UseGuards(JwtAuthGuard)
    async getViewUrl(
        @Param('id') documentId: string,
        @CurrentUser() user: any
    ) {
        try {
            console.log(`📄 Génération URL Cloudinary pour document ${documentId}`);

            const viewUrl = await this.documentsService.getFreshViewUrl(documentId);

            console.log(`✅ URL Cloudinary générée: ${viewUrl.substring(0, 50)}...`);

            return {
                viewUrl, // ✅ URL CLOUDINARY SIGNÉE DIRECTE
                expiresIn: '24 hours',
                documentId
            };

        } catch (error) {
            console.error(`❌ Erreur génération URL Cloudinary ${documentId}:`, error);
            throw error;
        }
    }

    @Get(':id/download-url')
    @UseGuards(JwtAuthGuard)
    async getDownloadUrl(
        @Param('id') documentId: string,
        @CurrentUser() user: any
    ) {
        try {
            console.log(`📄 Génération URL téléchargement pour document ${documentId}`);

            const document = await this.prisma.document.findUniqueOrThrow({
                where: { id: documentId }
            });

            const downloadUrl = this.cloudinaryService.generateDownloadUrl(
                document.cloudinaryId,
                document.fileName
            );

            return {
                downloadUrl,
                fileName: document.fileName
            };

        } catch (error) {
            console.error(`❌ Erreur génération URL téléchargement ${documentId}:`, error);
            throw error;
        }
    }

    // ✅ ROUTE DOCUMENTS PAR COMMANDE
    @Get('by-commande/:commandeId')
    @UseGuards(JwtAuthGuard)
    async getDocumentsByCommande(
        @Param('commandeId') commandeId: string,
        @CurrentUser() user: any
    ) {
        try {
            console.log(`📄 Récupération documents pour commande ${commandeId}`);

            const documents = await this.prisma.document.findMany({
                where: { commandeId: commandeId },
                orderBy: { dateDocument: 'desc' }
            });

            console.log(`✅ ${documents.length} documents trouvés`);

            return documents;

        } catch (error) {
            console.error(`❌ Erreur récupération documents commande ${commandeId}:`, error);
            throw error;
        }
    }

    @Get('test')
    async test() {
        return { message: 'Documents controller fonctionne !', timestamp: new Date() };
    }

    @Post('commandes/:id/bon-commande')
    @Roles(UserRole.ADMIN, UserRole.MAGASIN)
    async generateBonCommande(
        @Param('id') commandeId: string,
        @CurrentUser() user: any
    ) {
        console.log(`📄 Génération bon de commande pour commande ${commandeId}`);
        return this.documentsService.generateBonCommande(commandeId, user.id);
    }

    @Post('cessions/:id/bon-cession')
    @Roles(UserRole.ADMIN, UserRole.MAGASIN)
    async generateBonCession(
        @Param('id') cessionId: string,
        @CurrentUser() user: any
    ) {
        console.log(`📄 Génération bon de cession pour cession ${cessionId}`);
        return this.documentsService.generateBonCession(cessionId, user.id);
    }

    @Post('commandes/:id/devis')
    @Roles(UserRole.ADMIN)
    async generateDevis(
        @Param('id') commandeId: string,
        @Body() devisData: any,
        @CurrentUser() user: any
    ) {
        console.log(`📄 Génération devis pour commande ${commandeId}`);
        return this.documentsService.generateDevis(commandeId, user.id, devisData);
    }

    @Post('commandes/:id/facture')
    @Roles(UserRole.ADMIN)
    async generateFacture(
        @Param('id') commandeId: string,
        @Body() factureData: any,
        @CurrentUser() user: any
    ) {
        console.log(`📄 Génération facture pour commande ${commandeId}`);
        return this.documentsService.generateFacture(commandeId, user.id, factureData);
    }

    @Patch(':id/validate')
    @Roles(UserRole.ADMIN)
    async validateDocument(
        @Param('id') documentId: string,
        @CurrentUser() user: any
    ) {
        console.log(`📄 Validation document ${documentId}`);
        return this.documentsService.validateDocument(documentId, user.id);
    }

    @Get(':id/download')
    async downloadDocument(@Param('id') documentId: string, @Res() res: Response) {
        const document = await this.documentsService.getDocument(documentId);

        // TODO: Télécharger depuis Cloudinary
        // Pour l'instant, retourner l'URL
        res.json({ downloadUrl: document.url });
    }

    @Delete(':id')
    @Roles(UserRole.ADMIN, UserRole.MAGASIN)
    async deleteDocument(
        @Param('id') documentId: string,
        @CurrentUser() user: any
    ) {
        console.log(`🗑️ Suppression document ${documentId} par ${user.id}`);

        // Récupérer info document avant suppression
        const document = await this.documentsService.getDocument(documentId);

        await this.documentsService.deleteDocument(documentId, user.id);

        return {
            success: true,
            message: 'Document supprimé avec succès',
            documentId,
            documentType: document.type,
            numeroDocument: document.numeroDocument,
            deletedAt: new Date(),
            deletedBy: user.id
        };
    }

    @Get('debug-cloudinary')
    async debugCloudinary() {
        try {
            const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
            const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
            const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

            // Test configuration
            const testConfig = {
                cloudName: cloudName,
                apiKeyLength: apiKey?.length || 0,
                apiSecretLength: apiSecret?.length || 0,
                cloudNameValid: !!cloudName && cloudName.length > 0,
                apiKeyValid: !!apiKey && apiKey.length > 10,
                apiSecretValid: !!apiSecret && apiSecret.length > 10
            };

            // Test URL simple
            const simpleUrl = `https://res.cloudinary.com/${cloudName}/image/upload/sample.jpg`;

            return {
                success: true,
                config: testConfig,
                testUrls: {
                    simple: simpleUrl,
                    dashboard: `https://cloudinary.com/console/c-${cloudName?.substring(0, 8)}`
                },
                env: {
                    nodeEnv: process.env.NODE_ENV,
                    allCloudinaryVars: Object.keys(process.env).filter(key => key.includes('CLOUDINARY'))
                }
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                stack: error.stack
            };
        }
    }

    @Get('test-cloudinary-connection')
    async testConnection() {
        return await this.cloudinaryService.testCloudinaryConnection();
    }

}