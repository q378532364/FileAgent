import fs from "fs-extra";
import path from "path";
import { CONFIG } from "./config/env";
import { getLastUndoableAction, markUndone } from "./db/sqlite";

interface UndoResult {
  success: boolean;
  message: string;
}

export const undoLastAction = async (): Promise<UndoResult> => {
  const record = await getLastUndoableAction();
  if (!record) {
    return { success: false, message: "没有可撤销的操作。" };
  }
  if (record.undone) {
    return { success: false, message: "该操作已撤销过。" };
  }

  let result: UndoResult;
  try {
    switch (record.action) {
      case "delete":
        result = await undoDelete(record.details);
        break;
      case "create":
      case "createDir":
        result = await undoCreate(record.details);
        break;
      case "rename":
        result = await undoRename(record.details);
        break;
      case "batch_rename":
        result = await undoBatchRename(record.details);
        break;
      case "move":
        result = await undoMove(record.details);
        break;
      default:
        result = { success: false, message: `不支持撤销操作: ${record.action}` };
    }
  } catch (error: any) {
    result = { success: false, message: `撤销失败: ${error?.message || error}` };
  }

  if (result.success) {
    await markUndone(record.id);
  }
  return result;
};

async function undoDelete(details: any): Promise<UndoResult> {
  const { trashPath, basename, path: originalPath } = details;
  if (!(await fs.pathExists(trashPath))) {
    return { success: false, message: `回收站中未找到 ${basename}，可能已被清理。` };
  }
  const destDir = path.dirname(originalPath);
  await fs.ensureDir(destDir);
  await fs.move(trashPath, originalPath, { overwrite: true });
  return { success: true, message: `已恢复 ${basename} 到 ${originalPath}` };
}

async function undoCreate(details: any): Promise<UndoResult> {
  const { path: targetPath, isDir } = details;
  if (!(await fs.pathExists(targetPath))) {
    return { success: false, message: `${path.basename(targetPath)} 已不存在，无法撤销。` };
  }
  if (isDir) {
    const items = await fs.readdir(targetPath);
    if (items.length > 0) {
      return { success: false, message: `目录 ${path.basename(targetPath)}/ 非空，无法撤销。` };
    }
    await fs.rmdir(targetPath);
  } else {
    await fs.remove(targetPath);
  }
  return { success: true, message: `已删除 ${path.basename(targetPath)}` };
}

async function undoRename(details: any): Promise<UndoResult> {
  const { from, to } = details;
  if (!(await fs.pathExists(to))) {
    return { success: false, message: `${path.basename(to)} 已不存在，无法撤销。` };
  }
  if (await fs.pathExists(from)) {
    return { success: false, message: `${path.basename(from)} 已存在，目标位置冲突。` };
  }
  await fs.rename(to, from);
  return { success: true, message: `已将 ${path.basename(to)} 恢复为 ${path.basename(from)}` };
}

async function undoBatchRename(details: any): Promise<UndoResult> {
  const { results } = details;
  if (!results || results.length === 0) {
    return { success: false, message: "无重命名记录。" };
  }
  let count = 0;
  for (const r of results) {
    if (await fs.pathExists(r.newPath) && !(await fs.pathExists(r.oldPath))) {
      await fs.rename(r.newPath, r.oldPath);
      count++;
    }
  }
  return { success: true, message: `已恢复 ${count}/${results.length} 个文件的原名` };
}

async function undoMove(details: any): Promise<UndoResult> {
  const { from, to } = details;
  if (!(await fs.pathExists(to))) {
    return { success: false, message: `${path.basename(to)} 已不存在，无法撤销。` };
  }
  const destDir = path.dirname(from);
  await fs.ensureDir(destDir);
  await fs.move(to, from, { overwrite: true });
  return { success: true, message: `已将 ${path.basename(to)} 移回 ${from}` };
}
