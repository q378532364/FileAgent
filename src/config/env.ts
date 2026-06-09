import path from "path";

export const CONFIG = {
  // 以启动时的当前工作目录作为根路径
  WORKSPACE_PATH: path.resolve(process.cwd()),
  TRASH_PATH: path.resolve(process.cwd(), ".trash"),
  DB_PATH: path.resolve(process.cwd(), ".fileagent.db"),
  // openai
  OPENAI_API_KEY: "",
  OPENAI_MODEL: "",
  OPENAI_API_BASE: "",
  // anthropic
  ANTHROPIC_API_KEY: "",
  ANTHROPIC_MODEL: "",
  ANTHROPIC_API_BASE: "",

};
