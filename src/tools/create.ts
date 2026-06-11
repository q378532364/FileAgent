import fs from 'fs-extra';
import path from 'path';
import { logAction } from '../db/sqlite';
import { resolvePath } from '../utils/path';

export const createFile = async (filePath: string, content: string = '') => {
  const absolutePath = resolvePath(filePath);

  const exists = await fs.pathExists(absolutePath);
  if (exists) {
    return `已存在：${absolutePath}`;
  }

  const ext = path.extname(absolutePath);

  if (!ext) {
    await fs.ensureDir(absolutePath);
    await logAction('createDir', { path: absolutePath, isDir: true });
    return `已创建目录 ${path.basename(absolutePath)}/`;
  }

  const dir = path.dirname(absolutePath);
  await fs.ensureDir(dir);
  await fs.writeFile(absolutePath, content, 'utf-8');
  await logAction('create', { path: absolutePath, isDir: false, content });
  return `已创建文件 ${path.basename(absolutePath)}`;
};
