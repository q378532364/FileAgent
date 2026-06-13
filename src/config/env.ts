import path from "path";
import dotenv from "dotenv";

// 优先读取当前项目根目录下的 .env，而不是 src/ 目录或系统全局环境。
dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
  override: true,
});

export const CONFIG = {
  WORKSPACE_PATH: path.resolve(process.cwd()),
  TRASH_PATH: path.resolve(process.cwd(), ".trash"),
  DB_PATH: path.resolve(process.cwd(), ".fileagent.json"),
  MEMORY_PATH: path.resolve(process.cwd(), ".fileagent-memory.json"),
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4o",
  OPENAI_API_BASE: process.env.OPENAI_API_BASE || "",
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || "",
  ANTHROPIC_API_BASE: process.env.ANTHROPIC_API_BASE || "",
};
