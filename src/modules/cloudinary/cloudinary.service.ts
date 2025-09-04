import { Inject, Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CloudinaryService {
    private readonly logger = new Logger(CloudinaryService.name);

    constructor(
        private readonly configService: ConfigService,
    ) {
        // ✅ CONFIGURATION AUTOMATIQUE
        cloudinary.config({
            cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
            api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
            api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
        });
        console.log('🔧 Cloudinary configuré avec cloud_name:', this.configService.get<string>('CLOUDINARY_CLOUD_NAME'));
    }

    /**
     * ✅ UPLOAD PDF AVEC SIGNATURE AUTOMATIQUE
     */
    async uploadPDF(
        fileBuffer: Buffer,
        fileName: string,
        metadata: {
            documentType: string;
            commandeId: string;
            numeroDocument: string;
        }
    ): Promise<{
        publicId: string;
        secureUrl: string;
        viewUrl: string;
        downloadUrl: string;
    }> {
        try {
            this.logger.log(`📤 Upload PDF vers Cloudinary: ${fileName}`);

            const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        resource_type: 'image',
                        folder: 'mytruck-documents',
                        public_id: `${metadata.documentType}_${metadata.numeroDocument}_${Date.now()}`,
                        format: 'pdf',
                        use_filename: true,
                        unique_filename: true,
                        // ✅ AJOUTER : Rendre fichier public
                        type: 'upload', // Public par défaut
                        access_mode: 'public', // ✅ EXPLICITEMENT PUBLIC
                        context: {
                            type: 'document',
                            commandeId: metadata.commandeId,
                            documentType: metadata.documentType,
                            app: 'mytruck'
                        }
                    },
                    (error, result) => {
                        if (error) {
                            this.logger.error('❌ Erreur upload Cloudinary:', error);
                            reject(error);
                        } else {
                            resolve(result as UploadApiResponse);
                        }
                    }
                );
                uploadStream.end(fileBuffer);
            });

            // ✅ URL PUBLIQUE (pas de signature)
            const viewUrl = cloudinary.url(uploadResult.public_id, {
                resource_type: 'image',
                format: 'pdf'
                // ✅ PAS DE SIGNATURE pour test
            });

            // ✅ URL TÉLÉCHARGEMENT PUBLIQUE
            const downloadUrl = cloudinary.url(uploadResult.public_id, {
                resource_type: 'image',
                format: 'pdf',
                flags: 'attachment'
                // ✅ PAS DE SIGNATURE pour test
            });

            this.logger.log(`✅ PDF uploadé vers Cloudinary: ${uploadResult.public_id}`);
            this.logger.log(`🔗 View URL publique: ${viewUrl}`);

            return {
                publicId: uploadResult.public_id,
                secureUrl: uploadResult.secure_url,
                viewUrl, // ✅ URL PUBLIQUE
                downloadUrl
            };

        } catch (error) {
            this.logger.error(`❌ Erreur upload PDF ${fileName}:`, error);
            throw error;
        }
    }

    generateFreshViewUrl(publicId: string, expiresInHours: number = 2): string {
        console.log(`🔗 Génération URL Cloudinary pour publicId: ${publicId}`);

        // ✅ UTILISER resource_type: image pour aperçu PDF
        const url = cloudinary.url(publicId, {
            resource_type: 'image', // ✅ IMAGE au lieu de raw
            sign_url: true,
            format: 'pdf', // ✅ GARDER FORMAT PDF
            expires_at: Math.floor(Date.now() / 1000) + (expiresInHours * 60 * 60)
        });

        console.log(`✅ URL Cloudinary PDF aperçu: ${url.substring(0, 50)}...`);

        return url;
    }

    // ✅ MÉTHODE SÉPARÉE pour téléchargement
    generateDownloadUrl(publicId: string, fileName?: string): string {
        return cloudinary.url(publicId, {
            resource_type: 'image', // ✅ IMAGE même pour téléchargement
            sign_url: true,
            format: 'pdf',
            flags: 'attachment',
            expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
            ...(fileName && { attachment: fileName })
        });
    }

    /**
     * ✅ SUPPRIMER PDF
     */
    async deletePDF(publicId: string): Promise<void> {
        try {
            const result = await cloudinary.uploader.destroy(publicId, {
                resource_type: 'raw'
            });

            if (result.result === 'ok') {
                this.logger.log(`✅ PDF supprimé: ${publicId}`);
            } else {
                throw new Error(`Échec suppression: ${result.result}`);
            }
        } catch (error) {
            this.logger.error(`❌ Erreur suppression PDF ${publicId}:`, error);
            throw error;
        }
    }

    async testCloudinaryConnection(): Promise<any> {
        try {
            console.log('🧪 Test connexion Cloudinary...');

            // Test 1: Configuration
            const config = cloudinary.config();
            console.log('Configuration actuelle:', {
                cloud_name: config.cloud_name,
                api_key: config.api_key,
                api_secret: config.api_secret ? '***défini***' : '***MANQUANT***'
            });

            // Test 2: API Resources (liste des fichiers)
            const resources = await cloudinary.api.resources({
                resource_type: 'image',
                max_results: 1
            });

            console.log('✅ Connexion API réussie, ressources:', resources.resources.length);

            return {
                success: true,
                config: {
                    cloud_name: config.cloud_name,
                    api_key_defined: !!config.api_key,
                    api_secret_defined: !!config.api_secret
                },
                api_test: 'OK',
                resources_count: resources.resources.length
            };

        } catch (error) {
            console.error('❌ Erreur test Cloudinary:', error);

            return {
                success: false,
                error: error.message,
                code: error.error?.http_code || 'unknown'
            };
        }
    }
}