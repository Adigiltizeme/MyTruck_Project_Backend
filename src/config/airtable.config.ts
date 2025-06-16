import { registerAs } from '@nestjs/config';

export const airtableConfig = registerAs('airtable', () => ({
  apiKey: process.env.AIRTABLE_API_KEY,
  baseId: process.env.AIRTABLE_BASE_ID,
  webhookKey: process.env.AIRTABLE_WEBHOOK_KEY,
}));