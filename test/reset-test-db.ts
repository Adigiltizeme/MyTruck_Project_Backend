import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { join } from 'path';
import { User } from '../src/modules/users/entities/user.entity';
import { Driver } from '../src/modules/chauffeurs/entities/driver.entity';
import { Delivery } from '../src/modules/deliveries/entities/delivery.entity';
import { Store } from '../src/modules/magasins/entities/store.entity';
import { RefreshToken } from '../src/modules/auth/entities/refresh-token.entity';
import { PasswordReset } from '../src/modules/auth/entities/password-reset.entity';

config({ path: join(__dirname, '..', '.env.test') });

const configService = new ConfigService();

const dataSource = new DataSource({
  type: 'postgres',
  host: configService.get('DATABASE_HOST'),
  port: configService.get('DATABASE_PORT'),
  username: configService.get('DATABASE_USER'),
  password: configService.get('DATABASE_PASSWORD'),
  database: configService.get('DATABASE_NAME'),
  synchronize: true,
  entities: [
    User,
    Driver,
    Delivery,
    Store,
    RefreshToken,
    PasswordReset
  ],
});

async function resetTestDatabase() {
  try {
    await dataSource.initialize();
    const entities = dataSource.entityMetadatas;
    
    for (const entity of entities) {
      const repository = dataSource.getRepository(entity.name);
      await repository.query(`TRUNCATE "${entity.tableName}" CASCADE;`);
    }
    
    console.log('Base de données de test réinitialisée avec succès');
  } catch (error) {
    console.error('Erreur lors de la réinitialisation :', error);
    throw error;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

resetTestDatabase();