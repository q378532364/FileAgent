import fs from 'fs-extra';
import { CONFIG } from '../config/env';

const LOG_FILE = CONFIG.DB_PATH.replace('.db', '.json');

export const initDb = async () => {
  if (!await fs.pathExists(LOG_FILE)) {
    await fs.writeJson(LOG_FILE, []);
  }
};

export const logAction = async (action: string, details: any) => {
  const logs = await fs.readJson(LOG_FILE);
  logs.push({
    action,
    details,
    timestamp: new Date().toISOString()
  });
  await fs.writeJson(LOG_FILE, logs, { spaces: 2 });
};

export default {};
