import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONFIG = {
  WORKSPACE_PATH: path.resolve(__dirname, '../../workspace'),
  TRASH_PATH: path.resolve(__dirname, '../../workspace/.trash'),
  DB_PATH: path.resolve(__dirname, '../../fileagent.db'),
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: 'gpt-4o',
};
