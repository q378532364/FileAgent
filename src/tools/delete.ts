import path from "path";
import fs from "fs-extra";
import { logAction } from "../db/sqlite";
import { resolvePath } from "../utils/path";
import { CONFIG } from "../config/env";

export const safeDelete = async (filePath: string) => {
  const absolutePath = resolvePath(filePath);

  const exists = await fs.pathExists(absolutePath);
  if (!exists) {
    return `文件不存在：${absolutePath}`;
  }

  const basename = path.basename(absolutePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const trashDir = path.join(CONFIG.TRASH_PATH, `${timestamp}_${basename}`);

  await fs.ensureDir(trashDir);

  // 把文件移到 trash 子目录，保留原文件名
  const destPath = path.join(trashDir, basename);
  await fs.move(absolutePath, destPath, { overwrite: true });

  // 写入元数据，记录原始路径以便撤销
  await fs.writeJson(
    path.join(trashDir, "._meta.json"),
    {
      originalPath: absolutePath,
      deletedAt: new Date().toISOString(),
      basename,
    },
    { spaces: 2 }
  );

  await logAction("delete", {
    path: absolutePath,
    trashPath: destPath,
    basename,
  });

  return `已将 ${basename} 移入 .trash/，可使用 /undo 撤销。`;
};
