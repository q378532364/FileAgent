import fs from "fs-extra";
import path from "path";
import { logAction } from "../db/sqlite";
import { resolvePath } from "../utils/path";

export const readFile = async (
  filePath: string,
  maxLines: number = 200
): Promise<string> => {
  const absolutePath = resolvePath(filePath);

  if (!await fs.pathExists(absolutePath)) {
    return `文件不存在: ${absolutePath}`;
  }

  const stat = await fs.stat(absolutePath);
  if (stat.isDirectory()) {
    return `这是一个目录，不是文件: ${absolutePath}。请使用 listFiles 查看目录内容。`;
  }

  if (stat.size > 5 * 1024 * 1024) {
    return `文件过大 (${(stat.size / 1024 / 1024).toFixed(1)}MB)，无法读取。建议指定行数范围。`;
  }

  const content = await fs.readFile(absolutePath, "utf-8");
  const lines = content.split("\n");

  await logAction("readFile", { path: absolutePath, lines: lines.length });

  if (lines.length <= maxLines) {
    return `[${path.basename(absolutePath)}] (${lines.length} 行)\n\n${content}`;
  }

  const truncated = lines.slice(0, maxLines).join("\n");
  return `[${path.basename(absolutePath)}] (${lines.length} 行，显示前 ${maxLines} 行)\n\n${truncated}\n\n... (已截断，共 ${lines.length} 行)`;
};
