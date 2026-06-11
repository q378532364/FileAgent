import fs from 'fs-extra';
import path from 'path';
import { logAction } from '../db/sqlite';
import { resolvePath } from '../utils/path';

export const renameFile = async (oldPath: string, newName: string) => {
  const absoluteOld = resolvePath(oldPath);

  const exists = await fs.pathExists(absoluteOld);
  if (!exists) {
    return `文件不存在：${absoluteOld}`;
  }

  const dir = path.dirname(absoluteOld);
  const absoluteNew = path.resolve(dir, newName);

  await fs.rename(absoluteOld, absoluteNew);
  await logAction('rename', { from: absoluteOld, to: absoluteNew });
  return `已将 ${path.basename(absoluteOld)} 重命名为 ${newName}`;
};

export const batchRename = async (directory: string, pattern: string) => {
  const absoluteDir = resolvePath(directory);

  const dirExists = await fs.pathExists(absoluteDir);
  if (!dirExists) {
    return `目录不存在：${absoluteDir}`;
  }

  const files = await fs.readdir(absoluteDir);
  const results: { oldPath: string; newPath: string; oldName: string; newName: string }[] = [];

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
      results.push({ oldPath, newPath, oldName, newName });
    }
  }

  await logAction('batch_rename', { directory: absoluteDir, pattern, results });
  return `已在 ${directory} 中按模式 "${pattern}" 重命名 ${results.length} 个文件`;
};
