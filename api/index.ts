/**
 * Vercel deploy entry handler, for serverless deployment, please don't modify this file
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from './app.js';
import { initDatabase } from './db/init.js';

let dbInitialized = false;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
  }
  return app(req, res);
}
