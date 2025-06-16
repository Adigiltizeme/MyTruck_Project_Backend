import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '..', '.env.test') });

jest.setTimeout(30000);