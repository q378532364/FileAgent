import fs from 'fs-extra';
import path from 'path';
import { resolvePath } from '../utils/path';

export const listFiles = async (directory: string = '.') => {
  const absoluteDir = resolvePath(directory);

  const dirExists = await fs.pathExists(absoluteDir);
  if (!dirExists) {
    return `目录不存在：${absoluteDir}`;
  }

  const entries = await fs.readdir(absoluteDir);
  if (entries.length === 0) {
    return `目录 ${directory} 为空。`;
  }

  const results: { name: string; type: string; size: number }[] = [];

  for (const entry of entries) {
    const fullPath = path.join(absoluteDir, entry);
    const stats = await fs.stat(fullPath);
    results.push({
      name: entry,
      type: stats.isDirectory() ? 'dir' : 'file',
      size: stats.isFile() ? stats.size : 0,
    });
  }

  const lines = results.map((r) => {
    const icon = r.type === 'dir' ? '[DIR]' : '     ';
    const size = r.type === 'file' ? ` (${formatSize(r.size)})` : '';
    return `  ${icon} ${r.name}${size}`;
  });

  return `目录 ${directory} 下共 ${results.length} 项：\n${lines.join('\n')}`;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
