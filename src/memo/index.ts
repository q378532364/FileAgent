import fs from "fs-extra";
import { CONFIG } from "../config/env";

interface MemoryEntry {
  timestamp: string;
  summary: string;
}

interface UserMemory {
  habits: string[];
  preferences: Record<string, string>;
  recentInteractions: MemoryEntry[];
  lastUpdated: string;
}

const DEFAULT_MEMORY: UserMemory = {
  habits: [],
  preferences: {},
  recentInteractions: [],
  lastUpdated: "",
};

let memoryCache: UserMemory | null = null;

async function loadMemory(): Promise<UserMemory> {
  if (memoryCache) return memoryCache;
  if (await fs.pathExists(CONFIG.MEMORY_PATH)) {
    memoryCache = await fs.readJson(CONFIG.MEMORY_PATH);
  } else {
    memoryCache = { ...DEFAULT_MEMORY };
    await saveMemory();
  }
  return memoryCache!;
}

async function saveMemory(): Promise<void> {
  if (!memoryCache) return;
  memoryCache.lastUpdated = new Date().toISOString();
  await fs.writeJson(CONFIG.MEMORY_PATH, memoryCache, { spaces: 2 });
}

export async function addHabit(habit: string): Promise<void> {
  const mem = await loadMemory();
  if (!mem.habits.includes(habit)) {
    mem.habits.push(habit);
    if (mem.habits.length > 20) mem.habits.shift();
    await saveMemory();
  }
}

export async function setPreference(key: string, value: string): Promise<void> {
  const mem = await loadMemory();
  mem.preferences[key] = value;
  await saveMemory();
}

export async function addInteraction(summary: string): Promise<void> {
  const mem = await loadMemory();
  mem.recentInteractions.push({
    timestamp: new Date().toISOString(),
    summary,
  });
  if (mem.recentInteractions.length > 30) mem.recentInteractions.shift();
  await saveMemory();
}

export async function getMemory(): Promise<UserMemory> {
  return loadMemory();
}

export async function clearMemory(): Promise<void> {
  memoryCache = { ...DEFAULT_MEMORY };
  await saveMemory();
}

export async function extractAndSaveMemory(
  userMessage: string,
  aiResponse: string,
  toolCalls: { name: string; args: any }[]
): Promise<void> {
  const lower = userMessage.toLowerCase();

  // Detect common habits
  if (/\b(renam|重命名)\b/.test(lower) && /\b(batch|批量|all|所有)\b/.test(lower)) {
    await addHabit("用户喜欢批量重命名文件");
  }
  if (/\b(list|列出|查看|查看目录)\b/.test(lower)) {
    await addHabit("用户经常查看目录结构");
  }
  if (/\b(move|移动|整理|organize)\b/.test(lower)) {
    await addHabit("用户喜欢整理/移动文件");
  }
  if (/\b(create|创建|新建)\b/.test(lower)) {
    await addHabit("用户经常创建文件");
  }
  if (/\b(delete|删除|清理|clean)\b/.test(lower)) {
    await addHabit("用户会清理不需要的文件");
  }

  // Detect preferences
  const pathMatch = userMessage.match(/(?:在|到|from|to)\s*[`"']?([\/\\~][^\s`"']+)/);
  if (pathMatch) {
    await setPreference("常用路径", pathMatch[1]);
  }

  const extMatch = userMessage.match(/\b(\w+)\s*(?:文件|文件|files?)\b/);
  if (extMatch && ["txt", "pdf", "doc", "docx", "jpg", "png", "mp3", "mp4", "zip"].includes(extMatch[1].toLowerCase())) {
    await setPreference("常用文件类型", extMatch[1]);
  }

  // Save interaction summary
  const toolSummary = toolCalls.length > 0
    ? `调用了: ${toolCalls.map((t) => t.name).join(", ")}`
    : "纯对话";
  const summary = `[${toolSummary}] ${userMessage.slice(0, 50)}${userMessage.length > 50 ? "..." : ""}`;
  await addInteraction(summary);
}
