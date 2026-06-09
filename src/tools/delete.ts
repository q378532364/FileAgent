import trash from 'trash';
import path from 'path';
import fs from 'fs-extra';
import { logAction } from '../db/sqlite';
import { resolvePath } from '../utils/path';

export const safeDelete = async (filePath: string) => {
  const absolutePath = resolvePath(filePath);

  // 检查文件是否存在
  const exists = await fs.pathExists(absolutePath);
  if (!exists) {
    return `文件不存在：${absolutePath}`;
  }
  
  await trash(absolutePath);
  await logAction('delete', { path: absolutePath });
  return `已将 ${path.basename(absolutePath)} 移入回收站。`;
};
