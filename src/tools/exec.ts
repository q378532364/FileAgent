import { exec } from "child_process";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { CONFIG } from "../config/env";

const SANDBOX_DIR = path.join(CONFIG.TRASH_PATH, "_sandbox");

export const runCode = async (
  code: string,
  timeout: number = 10000
): Promise<string> => {
  await fs.ensureDir(SANDBOX_DIR);

  const scriptPath = path.join(SANDBOX_DIR, `_run_${Date.now()}.mjs`);

  // 注入环境变量（支持 API Key 访问）
  const envVars = JSON.stringify(process.env);

  // 包一层 async IIFE + 错误捕获 + 常用模块注入
  const wrapped = `
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const fs = require("fs-extra");
const path = require("path");

// 注入环境变量
const env = ${envVars};

// 注入网络请求工具
const fetch = globalThis.fetch;
const Headers = globalThis.Headers;
const Request = globalThis.Request;
const Response = globalThis.Response;
const AbortController = globalThis.AbortController;
const AbortSignal = globalThis.AbortSignal;
const URL = globalThis.URL;
const URLSearchParams = globalThis.URLSearchParams;

try {
  const result = await (async () => {
    ${code}
  })();
  if (result !== undefined) {
    console.log(typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result));
  }
} catch(e) {
  console.error(e.message || e);
  process.exitCode = 1;
}
`;

  await fs.writeFile(scriptPath, wrapped, "utf-8");

  return new Promise((resolve) => {
    const child = exec(
      `node "${scriptPath}"`,
      {
        timeout,
        cwd: CONFIG.WORKSPACE_PATH,
        env: { ...process.env, NODE_NO_WARNINGS: "1" },
        maxBuffer: 1024 * 1024,
      },
      async (_, stdout, stderr) => {
        // 清理临时文件
        await fs.remove(scriptPath).catch(() => {});

        if (stderr && !stdout) {
          resolve(`错误: ${stderr.trim()}`);
        } else {
          const output = (stdout || "").trim();
          resolve(output || "(无输出)");
        }
      }
    );
  });
};
