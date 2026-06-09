import path from 'path';
import os from 'os';

/**
 * 将用户输入的路径解析为绝对路径。
 * 行为和 Mac 终端一致：
 *   ~/foo     → 用户主目录/foo
 *   ./foo     → 当前目录/foo
 *   ../foo    → 上级目录/foo
 *   /foo/bar  → 原样使用（绝对路径）
 *   foo/bar   → 当前目录/foo/bar（默认相对路径）
 */
export function resolvePath(input: string): string {
  if (!input) return process.cwd();

  // ~/ 或 ~\ 开头 → 展开为用户主目录
  if (input === '~' || input.startsWith('~/') || input.startsWith('~\\')) {
    return path.join(os.homedir(), input.slice(2) || '');
  }

  // 已经是绝对路径（Windows: C:\xxx  Linux/Mac: /xxx）
  if (path.isAbsolute(input)) {
    return path.resolve(input);
  }

  // 相对路径（包括 ./  ../  和普通相对路径）一律基于 cwd 解析
  return path.resolve(process.cwd(), input);
}
