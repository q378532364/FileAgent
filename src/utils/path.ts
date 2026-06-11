import path from 'path';
import os from 'os';

export function resolvePath(input: string): string {
  if (!input) return process.cwd();

  if (input === '~' || input.startsWith('~/') || input.startsWith('~\\')) {
    return path.join(os.homedir(), input.slice(2) || '');
  }

  if (path.isAbsolute(input)) {
    return path.resolve(input);
  }

  return path.resolve(process.cwd(), input);
}
