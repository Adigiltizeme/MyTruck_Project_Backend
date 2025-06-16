import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';

// Entités
import { User } from '../src/modules/users/entities/user.entity';
import { Driver } from '../src/modules/chauffeurs/entities/driver.entity';

// Modules
import { AuthModule } from '../src/modules/auth/auth.module';
import { UsersModule } from '../src/modules/users/users.module';
import { DriversModule } from '../src/modules/chauffeurs/drivers.module';

// Services
import { UsersService } from '../src/modules/users/users.service';

// Enums
import { UserRole } from '../src/modules/users/enums/user-role.enum';

describe('DriversController (e2e)', () => {
    let app: INestApplication;
    let usersService: UsersService;
    let adminToken: string;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: '.env.test',
                }),
                TypeOrmModule.forRootAsync({
                    imports: [ConfigModule],
                    useFactory: (configService: ConfigService) => ({
                        type: 'postgres',
                        host: configService.get('DATABASE_HOST'),
                        port: configService.get('DATABASE_PORT'),
                        username: configService.get('DATABASE_USER'),
                        password: configService.get('DATABASE_PASSWORD'),
                        database: configService.get('DATABASE_NAME'),
                        entities: [User, Driver],
                        synchronize: true,
                    }),
                    inject: [ConfigService],
                }),
                AuthModule,
                UsersModule,
                DriversModule,
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        usersService = moduleFixture.get<UsersService>(UsersService);

        await app.init();

        // Créer admin et obtenir token
        await usersService.create({
            email: 'admin@test.com',
            password: 'Admin123!',
            role: UserRole.ADMIN,
        });

        const loginResponse = await request(app.getHttpServer())
            .post('/auth/login')
            .send({
                email: 'admin@test.com',
                password: 'Admin123!',
            });

        adminToken = loginResponse.body.access_token;
    });

    describe('Opérations CRUD basiques', () => {
        it('should create a new driver', () => {
            return request(app.getHttpServer())
                .post('/drivers')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    firstName: 'Jean',
                    lastName: 'Dupont',
                    phoneNumber: '+33612345678',
                    email: 'jean.dupont@example.com',
                    password: 'Driver123!',
                })
                .expect(201);
        });

        it('should get all drivers', () => {
            return request(app.getHttpServer())
                .get('/drivers')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);
        });
    });

    afterAll(async () => {
        await app.close();
    });
});