import fs from 'fs-extra';
import path from 'path';
import { CONFIG } from '../config/env';
import { logAction } from '../db/sqlite';

export const renameFile = async (oldPath: string, newName: string) => {
  const absoluteOld = path.isAbsolute(oldPath) 
    ? oldPath 
    : path.resolve(CONFIG.WORKSPACE_PATH, oldPath);
  
  const dir = path.dirname(absoluteOld);
  const absoluteNew = path.resolve(dir, newName);

  if (!absoluteOld.startsWith(CONFIG.WORKSPACE_PATH) || !absoluteNew.startsWith(CONFIG.WORKSPACE_PATH)) {
    throw new Error('拒绝访问：只允许在 workspace 目录内操作。');
  }

  await fs.rename(absoluteOld, absoluteNew);
  await logAction('rename', { from: absoluteOld, to: absoluteNew });
  return `已将 ${path.basename(absoluteOld)} 重命名为 ${newName}。`;
};

/**
 * Batch rename files in a directory using a pattern
 * Example pattern: "doc_{n}.txt" where {n} is index
 */
export const batchRename = async (directory: string, pattern: string) => {
  const absoluteDir = path.isAbsolute(directory) 
    ? directory 
    : path.resolve(CONFIG.WORKSPACE_PATH, directory);

  if (!absoluteDir.startsWith(CONFIG.WORKSPACE_PATH)) {
    throw new Error('拒绝访问：只允许在 workspace 目录内操作。');
  }

  const files = await fs.readdir(absoluteDir);
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const oldName = files[i];
    const oldPath = path.join(absoluteDir, oldName);
    const stats = await fs.stat(oldPath);
    
    if (stats.isFile()) {
      const ext = path.extname(oldName);
      const nameWithoutExt = path.basename(oldName, ext);
      
      const newName = pattern
        .replace('{n}', (i + 1).toString())
        .replace('{name}', nameWithoutExt)
        .replace('{ext}', ext.slice(1));
      
      const newPath = path.join(absoluteDir, newName);
      await fs.rename(oldPath, newPath);
      results.push({ oldName, newName });
    }
  }

  await logAction('batch_rename', { directory: absoluteDir, pattern, results });
  return `已在 ${directory} 中按模式 "${pattern}" 重命名 ${results.length} 个文件。`;
};
