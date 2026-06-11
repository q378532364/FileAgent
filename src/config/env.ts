import path from "path";
import dotenv from "dotenv";

dotenv.config();

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
