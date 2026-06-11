import fs from 'fs-extra';
import path from 'path';
import { logAction } from '../db/sqlite';
import { resolvePath } from '../utils/path';

export const moveFile = async (src: string, dest: string) => {
  const absoluteSrc = resolvePath(src);
  const absoluteDest = resolvePath(dest);

  const srcExists = await fs.pathExists(absoluteSrc);
  if (!srcExists) {
    return `源文件不存在：${absoluteSrc}`;
  }

  await fs.move(absoluteSrc, absoluteDest, { overwrite: true });
  await logAction('move', { from: absoluteSrc, to: absoluteDest });
  return `已将 ${path.basename(absoluteSrc)} 移动到 ${absoluteDest}`;
};
