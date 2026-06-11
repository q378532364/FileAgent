import fs from "fs-extra";
import path from "path";
import { CONFIG } from "../config/env";

const LOG_FILE = CONFIG.DB_PATH.replace(".db", ".json");

export const initDb = async () => {
  if (!(await fs.pathExists(LOG_FILE))) {
    await fs.writeJson(LOG_FILE, []);
  }
  await fs.ensureDir(CONFIG.TRASH_PATH);
};

export const logAction = async (action: string, details: any) => {
  const logs = await fs.readJson(LOG_FILE);
  logs.push({
    id: logs.length + 1,
    action,
    details,
    timestamp: new Date().toISOString(),
  });
  await fs.writeJson(LOG_FILE, logs, { spaces: 2 });
};

export interface UndoRecord {
  id: number;
  action: string;
  details: any;
  timestamp: string;
  undone?: boolean;
}

// 获取最近一条未撤销的操作（任意类型）
export const getLastUndoableAction = async (): Promise<UndoRecord | null> => {
  if (!(await fs.pathExists(LOG_FILE))) return null;
  const logs: UndoRecord[] = await fs.readJson(LOG_FILE);
  for (let i = logs.length - 1; i >= 0; i--) {
    if (!logs[i].undone) {
      return logs[i];
    }
  }
  return null;
};

export const markUndone = async (id: number): Promise<void> => {
  const logs: any[] = await fs.readJson(LOG_FILE);
  const idx = logs.findIndex((l) => l.id === id);
  if (idx !== -1) {
    logs[idx].undone = true;
    await fs.writeJson(LOG_FILE, logs, { spaces: 2 });
  }
};

export default {};
