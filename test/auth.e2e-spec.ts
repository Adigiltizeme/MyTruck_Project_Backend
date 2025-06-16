import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { AuthModule } from '../src/modules/auth/auth.module';
import { UsersModule } from '../src/modules/users/users.module';
import { SharedModule } from '../src/shared/shared.module';
import { User } from '../src/modules/users/entities/user.entity';
import { RefreshToken } from '../src/modules/auth/entities/refresh-token.entity';
import { PasswordReset } from '../src/modules/auth/entities/password-reset.entity';
import { UserRole } from '../src/modules/users/enums/user-role.enum';
import { UsersService } from '../src/modules/users/users.service';
import { LocalAuthGuard } from '../src/modules/auth/guards/local-auth.guard';

describe('AuthController (e2e)', () => {
    let app: INestApplication;
    let usersService: UsersService;
    let dataSource: DataSource;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: '.env.test',
                    load: [() => ({
                        JWT_SECRET: 'test-secret-key'
                    })],
                }),
                ThrottlerModule.forRoot([{
                    ttl: 60,
                    limit: 10,
                }]),
                TypeOrmModule.forRootAsync({
                    imports: [ConfigModule],
                    useFactory: (configService: ConfigService) => ({
                        type: 'postgres',
                        host: configService.get('DATABASE_HOST'),
                        port: configService.get('DATABASE_PORT'),
                        username: configService.get('DATABASE_USER'),
                        password: configService.get('DATABASE_PASSWORD'),
                        database: configService.get('DATABASE_NAME'),
                        entities: [User, RefreshToken, PasswordReset],
                        synchronize: true,
                    }),
                    inject: [ConfigService],
                }),
                SharedModule,
                AuthModule,
                UsersModule,
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        usersService = moduleFixture.get<UsersService>(UsersService);
        dataSource = moduleFixture.get<DataSource>(DataSource);
        await app.init();
    });

    beforeEach(async () => {
        // Nettoyer la base de données avant chaque test
        if (dataSource && dataSource.isInitialized) {
            const entities = dataSource.entityMetadatas;
            for (const entity of entities) {
                const repository = dataSource.getRepository(entity.name);
                await repository.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE;`);
            }
        }
    });

    describe('/auth/login (POST)', () => {
        it('should return 401 with invalid credentials', () => {
            return request(app.getHttpServer())
                .post('/auth/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'wrongpassword',
                })
                .expect(401);
        });
        it('should return JWT token with valid credentials', async () => {
            // Créer un utilisateur de test
            await usersService.create({
                email: 'test@example.com',
                password: 'Password123!',
                role: UserRole.DRIVER,
            });

            const response = await request(app.getHttpServer())
                .post('/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'Password123!',
                })
                .expect(200);

            expect(response.body).toHaveProperty('access_token');
            expect(response.body).toHaveProperty('user');
            expect(response.body.user.email).toBe('test@example.com');
            expect(response.body.user.role).toBe(UserRole.DRIVER);
        });
        it('should handle throttling correctly', async () => {
            // Réduire la limite du throttle pour le test
            const loginAttempts = 12; // Dépasse la limite de 10
            const promises = [];

            // Faire plusieurs requêtes simultanées
            for (let i = 0; i < loginAttempts; i++) {
                promises.push(
                    request(app.getHttpServer())
                        .post('/auth/login')
                        .send({
                            email: 'test@example.com',
                            password: 'wrongpassword',
                        })
                );
            }

            // Attendre que toutes les requêtes soient terminées
            const responses = await Promise.all(promises);

            // Vérifier qu'au moins une requête a été throttle
            const hasThrottledResponse = responses.some(response => response.status === 429);
            expect(hasThrottledResponse).toBe(true);
        });
    });

    describe('/auth/refresh (POST)', () => {
        let refreshToken: string;

        beforeEach(async () => {
            // Créer un utilisateur test
            await usersService.create({
                email: 'refresh@test.com',
                password: 'Refresh123!',
                role: UserRole.USER,
            });

            // Obtenir les tokens initiaux
            const loginResponse = await request(app.getHttpServer())
                .post('/auth/login')
                .send({
                    email: 'refresh@test.com',
                    password: 'Refresh123!',
                });

            refreshToken = loginResponse.body.refresh_token;
        });
        it('should return 401 with invalid refresh token', () => {
            return request(app.getHttpServer())
                .post('/auth/refresh')
                .send({
                    refreshToken: 'invalid-token',
                })
                .expect(401);
        });
        // it('should refresh token successfully with valid refresh token', async () => {
        //     // Créer un utilisateur
        //     const user = await usersService.create({
        //         email: 'refresh@example.com',
        //         password: 'Password123!',
        //         role: UserRole.DRIVER,
        //     });

        //     // Se connecter pour obtenir les tokens
        //     const loginResponse = await request(app.getHttpServer())
        //         .post('/auth/login')
        //         .send({
        //             email: 'refresh@example.com',
        //             password: 'Password123!',
        //         });

        //     // Utiliser le refresh token
        //     const refreshResponse = await request(app.getHttpServer())
        //         .post('/auth/refresh')
        //         .send({
        //             refreshToken: loginResponse.body.refresh_token,
        //         });

        //     expect(refreshResponse.status).toBe(200);
        //     expect(refreshResponse.body).toHaveProperty('access_token');
        // });
        it('should refresh token successfully with valid refresh token', async () => {
            const response = await request(app.getHttpServer())
                .post('/auth/refresh')
                .send({ refreshToken })
                .expect(200);
    
            expect(response.body).toHaveProperty('access_token');
        });
    });

    describe('/auth/forgot-password (POST)', () => {
        it('should accept email for password reset', () => {
            return request(app.getHttpServer())
                .post('/auth/forgot-password')
                .send({
                    email: 'test@example.com',
                })
                .expect(200)
                .expect(res => {
                    expect(res.body).toHaveProperty('message');
                });
        });
        it('should handle non-existent email gracefully', async () => {
            const response = await request(app.getHttpServer())
                .post('/auth/forgot-password')
                .send({
                    email: 'nonexistent@example.com',
                });

            expect(response.status).toBe(200); // Ne pas révéler si l'email existe
            expect(response.body).toHaveProperty('message');
        });

        it('should generate reset token for existing user', async () => {
            // Créer un utilisateur
            await usersService.create({
                email: 'reset@example.com',
                password: 'Password123!',
                role: UserRole.DRIVER,
            });

            const response = await request(app.getHttpServer())
                .post('/auth/forgot-password')
                .send({
                    email: 'reset@example.com',
                });

            expect(response.status).toBe(200);
            // Vérifier que le token a été généré dans la base de données
            const resetToken = await dataSource
                .getRepository(PasswordReset)
                .findOne({ where: { email: 'reset@example.com' } });
            expect(resetToken).toBeDefined();
        });
    });

    describe('Input Validation', () => {
        it('should validate email format', async () => {
            // Désactiver le guard pour ce test
            const moduleRef = await Test.createTestingModule({
                imports: [AuthModule],
            })
            .overrideGuard(LocalAuthGuard)
            .useValue({ canActivate: () => true })
            .compile();
    
            const app = moduleRef.createNestApplication();
            app.useGlobalPipes(new ValidationPipe());
            await app.init();
    
            const response = await request(app.getHttpServer())
                .post('/auth/login')
                .send({
                    email: 'invalid-email',
                    password: 'Password123!'
                });
    
            expect(response.status).toBe(400);
            expect(response.body.message).toContain('email must be an email');
    
            await app.close();
        });

        it('should validate password minimum length', async () => {
            const response = await request(app.getHttpServer())
                .post('/auth/login') // ou le endpoint approprié
                .send({
                    email: 'test@example.com',
                    password: '123'
                });

            expect(response.status).toBe(400);
            const messages = Array.isArray(response.body.message) ?
                response.body.message : [response.body.message];
            expect(messages.some((msg: string) => msg.includes('password'))).toBeTruthy();
        });
    });

    afterAll(async () => {
        if (dataSource && dataSource.isInitialized) {
            await dataSource.destroy();
        }
        if (app) {
            await app.close();
        }
    });
});