import trash from 'trash';
import path from 'path';
import { CONFIG } from '../config/env';
import { logAction } from '../db/sqlite';

export const safeDelete = async (filePath: string) => {
  const absolutePath = path.isAbsolute(filePath) 
    ? filePath 
    : path.resolve(CONFIG.WORKSPACE_PATH, filePath);

  if (!absolutePath.startsWith(CONFIG.WORKSPACE_PATH)) {
    throw new Error('拒绝访问：不能删除 workspace 目录外的文件。');
  }

  await trash(absolutePath);
  await logAction('delete', { path: absolutePath });
  return `已将 ${path.basename(absolutePath)} 移入回收站。`;
};
