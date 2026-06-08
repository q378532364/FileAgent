import fs from 'fs-extra';
import path from 'path';
import { CONFIG } from '../config/env';
import { logAction } from '../db/sqlite';

export const moveFile = async (src: string, dest: string) => {
  const absoluteSrc = path.isAbsolute(src) 
    ? src 
    : path.resolve(CONFIG.WORKSPACE_PATH, src);
  
  const absoluteDest = path.isAbsolute(dest) 
    ? dest 
    : path.resolve(CONFIG.WORKSPACE_PATH, dest);

  if (!absoluteSrc.startsWith(CONFIG.WORKSPACE_PATH) || !absoluteDest.startsWith(CONFIG.WORKSPACE_PATH)) {
    throw new Error('拒绝访问：只允许在 workspace 目录内操作。');
  }

  await fs.move(absoluteSrc, absoluteDest, { overwrite: true });
  await logAction('move', { from: absoluteSrc, to: absoluteDest });
  return `已将 ${path.basename(absoluteSrc)} 移动到 ${dest}。`;
};
