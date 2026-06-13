#!/usr/bin/env node
import readline from "readline";

import { graph } from "./agent/graph";
import { initDb } from "./db/sqlite";
import { HumanMessage, BaseMessage } from "@langchain/core/messages";
import { program } from "./command/fileCommands";
import { CONFIG } from "./config/env";
import { extractAndSaveMemory, clearMemory } from "./memo/index";
import { undoLastAction } from "./undo";
import enquirer from "enquirer";
const { AutoComplete, Input } = enquirer;


// ─── ANSI 颜色常量 ──────────────────────────────────────────
const C = {
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  gray: "\x1b[90m",
  white: "\x1b[97m",
  reset: "\x1b[0m",
};

// ─── 会话状态 ────────────────────────────────────────────────
let conversationHistory: BaseMessage[] = [];
let totalTokensUsed = 0;
let sessionTokensUsed = 0; // 当前会话 token 使用量
let maxContextTokens = 128000; // 默认上下文窗口
const CONTEXT_THRESHOLD = 0.8; // 上下文使用率阈值，超过则截断

// ─── 命令列表 ──────────────────────────────────────────────

function getAvailableCommands() {
  const seen = new Set<string>();
  const cmds: { name: string; description: string }[] = [];

  for (const sub of program._subcommands) {
    if (!seen.has(sub._name)) {
      seen.add(sub._name);
      cmds.push({ name: sub._name, description: sub._description });
    }
  }

  const builtins = [
    { name: "help", description: "显示帮助信息" },
    { name: "tools", description: "列出当前可用工具" },
    { name: "undo", description: "撤销上一次文件操作" },
    { name: "clear", description: "清除上下文和会话历史" },
    { name: "exit", description: "退出程序" },
  ];
  for (const b of builtins) {
    if (!seen.has(b.name)) {
      seen.add(b.name);
      cmds.push(b);
    }
  }

  return cmds;
}

function showHelp(): void {
  console.log("\n可用命令：");
  for (const cmd of getAvailableCommands()) {
    console.log(`  /${cmd.name.padEnd(15)} ${cmd.description}`);
  }
  console.log("");
}

// ─── 模型上下文窗口配置 ──────────────────────────────────────
function getModelContextWindow(model: string): number {
  const m = model.toLowerCase();
  if (m.includes("gpt-4o")) return 128000;
  if (m.includes("gpt-4-turbo")) return 128000;
  if (m.includes("gpt-4")) return 8192;
  if (m.includes("gpt-3.5")) return 16385;
  if (m.includes("gpt-3")) return 4096;
  if (m.includes("claude-3")) return 200000;
  if (m.includes("claude")) return 100000;
  if (m.includes("deepseek")) return 64000;
  if (m.includes("qwen")) return 32000;
  if (m.includes("glm")) return 128000;
  return 128000; // 默认
}

// ─── 估算消息 token 数 ──────────────────────────────────────
function estimateTokens(text: string): number {
  // 粗略估算：中文约 2 token/字，英文约 0.75 token/word
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const otherChars = text.length - chineseChars - englishWords;
  return Math.ceil(chineseChars * 2 + englishWords * 0.75 + otherChars * 0.5);
}

function estimateMessagesTokens(messages: BaseMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    total += estimateTokens(content);
    // 工具调用也占用 token
    if ((msg as any).tool_calls) {
      total += estimateTokens(JSON.stringify((msg as any).tool_calls));
    }
  }
  return total;
}

// ─── 上下文截断 ──────────────────────────────────────────────
function truncateContext(): void {
  const currentTokens = estimateMessagesTokens(conversationHistory);
  const threshold = maxContextTokens * CONTEXT_THRESHOLD;

  if (currentTokens <= threshold) return;

  // 保留最近的消息，确保不超过阈值
  // 策略：从前往后删除，直到估算 token 数低于阈值
  while (conversationHistory.length > 2 && estimateMessagesTokens(conversationHistory) > threshold) {
    // 保留第一条消息（可能是系统消息或第一条用户消息），删除第二条
    conversationHistory.splice(1, 1);
  }

  // 更新 token 计数
  sessionTokensUsed = estimateMessagesTokens(conversationHistory);
}

function showContextUsage(): void {
  // 显示当前会话的上下文使用情况
  const usedK = (sessionTokensUsed / 1000).toFixed(1);
  const percent = ((sessionTokensUsed / maxContextTokens) * 100).toFixed(1);
  const barLen = 20;
  const filled = Math.round((sessionTokensUsed / maxContextTokens) * barLen);
  const bar = "█".repeat(filled) + "░".repeat(barLen - filled);
  console.log(
    `  ${C.gray}上下文: ${C.green}${usedK}k${C.gray} (${percent}%) ${C.cyan}${bar}${C.reset}`
  );
}

// ─── 命令向导 ──────────────────────────────────────────────

async function runCommandWizard(initialCmd?: string): Promise<boolean> {
  let selectedCmd = initialCmd;
  const cmds = getAvailableCommands();

  while (true) {
    if (!selectedCmd) {
      try {
        selectedCmd = await new AutoComplete({
          name: "cmd",
          message: "请选择命令",
          limit: 10,
          choices: cmds.map((c) => ({
            name: c.name,
            message: `/${c.name.padEnd(15)} ${c.description}`,
          })),
        }).run();
      } catch (e) {
        return false;
      }
    }

    if (selectedCmd && ["help", "tools", "exit", "clear", "undo"].includes(selectedCmd)) {
      const shouldExit = await handleCommand(`/${selectedCmd}`);
      return shouldExit;
    }

    try {
      const args = await new Input({
        name: "args",
        message: `请输入 /${selectedCmd} 对应的参数 (按 Esc 重新选择命令):`,
      }).run();

      const fullCmd = `/${selectedCmd} ${args}`.trim();
      const shouldExit = await handleCommand(fullCmd);
      return shouldExit;
    } catch (e) {
      selectedCmd = undefined;
    }
  }
}

// ─── 命令执行 ──────────────────────────────────────────────

async function handleCommand(fullInput: string): Promise<boolean> {
  const parts = fullInput.startsWith("/")
    ? fullInput.slice(1).trim().split(/\s+/)
    : [];
  const cmd = parts[0] || "";
  const args = parts.slice(1);

  if (!cmd) return false;

  switch (cmd) {
    case "exit":
      return true;
    case "help":
      showHelp();
      return false;
    case "clear":
      conversationHistory = [];
      totalTokensUsed = 0;
      sessionTokensUsed = 0;
      await clearMemory();
      console.log(
        `  ${C.green}✓ 上下文已清除，会话历史已重置${C.reset}`
      );
      return false;
    case "undo": {
      const result = await undoLastAction();
      if (result.success) {
        console.log(`  ${C.green}✓ ${result.message}${C.reset}`);
      } else {
        console.log(`  ${C.yellow}${result.message}${C.reset}`);
      }
      return false;
    }
    case "tools":
      console.log("\n当前可用工具：");
      const { agentTools } = await import("./agent/nodes");
      for (const t of agentTools) {
        console.log(`  - ${t.name}: ${t.description}`);
      }
      console.log("");
      return false;
    default: {
      const sub = program._subcommands.find((c) => c._name === cmd);
      if (sub) {
        await program.parse(["node", "script", cmd, ...args]);
      } else {
        console.error(`未知命令: ${cmd}`);
      }
      return false;
    }
  }
}

// ─── Readline 初始化 ───────────────────────────────────────

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function showBanner(): void {
  const O = "\x1b[38;5;214m";
  const W = "\x1b[97m";
  const D = "\x1b[90m";
  const B = "\x1b[1m";
  const R = "\x1b[0m";

  const vlen = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "").length;
  const padL = (s: string, w: number) =>
    s + " ".repeat(Math.max(0, w - vlen(s)));
  const padC = (s: string, w: number) => {
    const vl = vlen(s);
    const lt = Math.floor((w - vl) / 2);
    return (
      " ".repeat(Math.max(0, lt)) + s + " ".repeat(Math.max(0, w - vl - lt))
    );
  };
  const cl = (t: string, c: string) => `${c}${t}${R}`;

  const cwd = process.cwd();
  const cwdDisp = cwd.length > 29 ? cwd.slice(0, 26) + "..." : cwd;

  const LW = 35;
  const RW = 40;

  const icon = ["┌──────┐", "│██╱╱██│", "└──────┘"];

  const banner = [
    "",
    `${O}╭─── ${R}${B}${W}FileAgent v0.0.2${R} ${O}${"─".repeat(53)}╮${R}`,
    `${O}│${R}${" ".repeat(76)}${O}│${R}`,
    `${O}│${R}${padC(cl("Welcome back!", B + W), LW)}${O}│${R}${padL(cl("Tips for getting started", O), RW)}${O}│${R}`,
    `${O}│${R}${" ".repeat(LW)}${O}│${R}${padL(cl("Run ", D) + cl("/help", W) + cl(" to see all commands.", D), RW)}${O}│${R}`,
    `${O}│${R}${padC(cl(icon[0], O), LW)}${O}│${R}${padL(cl("Type ", D) + cl("/tools", W) + cl(" to browse tools.", D), RW)}${O}│${R}`,
    `${O}│${R}${padC(cl(icon[1], O), LW)}${O}│${R}${" ".repeat(RW)}${O}│${R}`,
    `${O}│${R}${padC(cl(icon[2], O), LW)}${O}│${R}${" ".repeat(RW)}${O}│${R}`,
    `${O}│${R}${padL(cl(`${CONFIG.OPENAI_MODEL} · API Usage`, W), LW)}${O}│${R}${O}${"─".repeat(RW)}${R}${O}│${R}`,
    `${O}│${R}${padL(cl(cwdDisp, D), LW)}${O}│${R}${padL(cl("Type /clear to reset context", O), RW)}${O}│${R}`,
    `${O}│${R}${" ".repeat(LW)}${O}│${R}${" ".repeat(RW)}${O}│${R}`,
    `${O}│${R}${" ".repeat(76)}${O}│${R}`,
    `${O}╰${"─".repeat(76)}╯${R}`,
    "",
  ].join("\n");

  console.log(banner);
}

// ─── 主循环 ────────────────────────────────────────────────

const main = async () => {
  console.log("正在初始化 File Agent...");
  await initDb();
  showBanner();
  console.log("输入 / 查看可用命令，↑↓ 选择，Tab 补全。\n");

  const ask = () => {
    rl.question("> ", async (input) => {
      const trimmed = input.trim();

      // 如果用户直接输入 /，进入向导模式
      if (trimmed === "/") {
        rl.pause();
        const shouldExit = await runCommandWizard();
        if (shouldExit) {
          rl.close();
          process.exit(0);
          return;
        }
        rl.resume();
        ask();
        return;
      }

      // ── 命令处理 ──
      if (trimmed.startsWith("/")) {
        rl.pause();
        const parts = trimmed.slice(1).trim().split(/\s+/);
        const cmdName = parts[0];
        const args = parts.slice(1);
        const choices = getAvailableCommands();

        const exactMatch = cmdName && choices.find((c) => c.name === cmdName);
        if (exactMatch) {
          if (args.length === 0) {
            const shouldExit = await runCommandWizard(cmdName);
            if (shouldExit) {
              rl.close();
              process.exit(0);
              return;
            }
          } else {
            try {
              const shouldExit = await handleCommand(trimmed);
              if (shouldExit) {
                rl.close();
                process.exit(0);
                return;
              }
            } catch (error: any) {
              console.error(`命令执行出错：${error?.message || error}`);
            }
          }
          rl.resume();
          ask();
          return;
        }

        const matching = cmdName
          ? choices.filter((c) => c.name.startsWith(cmdName))
          : choices;

        if (matching.length === 1) {
          if (args.length === 0) {
            const shouldExit = await runCommandWizard(matching[0].name);
            if (shouldExit) {
              rl.close();
              process.exit(0);
              return;
            }
          } else {
            const fullCmd = `/${matching[0].name} ${args.join(" ")}`;
            try {
              const shouldExit = await handleCommand(fullCmd);
              if (shouldExit) {
                rl.close();
                process.exit(0);
                return;
              }
            } catch (error: any) {
              console.error(`命令执行出错：${error?.message || error}`);
            }
          }
          rl.resume();
          ask();
          return;
        }

        if (matching.length === 0) {
          console.log(`未知命令: ${cmdName || "(空)"}，输入 /help 查看可用命令`);
        } else {
          console.log("可选命令：");
          for (const m of matching) {
            console.log(`  /${m.name.padEnd(15)} ${m.description}`);
          }
        }
        rl.resume();
        ask();
        return;
      }

      // ── 普通对话 ──
      if (!trimmed) {
        ask();
        return;
      }

      if (!CONFIG.OPENAI_API_KEY) {
        console.log("未配置 OPENAI_API_KEY，请在 .env 文件中设置。");
        ask();
        return;
      }

      try {
        process.stdout.write("思考中...");
        conversationHistory.push(new HumanMessage(trimmed));

        const initialState = { messages: [...conversationHistory] };
        const result = await Promise.race([
          graph.invoke(initialState, { recursionLimit: 10 }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("请求超时（30s）")), 30000)
          ),
        ]);
        process.stdout.write("\r\x1b[K");

        // 更新会话历史
        conversationHistory = result.messages;

        const lastMessage = result.messages[result.messages.length - 1];

        // 显示上下文容量
        showContextUsage();

        // AI 回复：FileAgent 前缀 + 淡色
        console.log(
          `${C.cyan}${C.bold}${C.reset} ${C.dim}${lastMessage.content}${C.reset}`
        );

        // 提取 token 使用量
        const usage = (lastMessage as any)?.usage_metadata;
        if (usage) {
          // 累加 token 使用量（而非覆盖）
          const inputTokens = usage.input_tokens || 0;
          const outputTokens = usage.output_tokens || 0;
          totalTokensUsed += inputTokens + outputTokens;
          sessionTokensUsed += inputTokens + outputTokens;

          // 更新上下文窗口（基于模型）
          maxContextTokens = getModelContextWindow(CONFIG.OPENAI_MODEL);
        } else {
          // 如果没有 usage_metadata，用估算值
          const estimatedTokens = estimateTokens(String(lastMessage.content));
          totalTokensUsed += estimatedTokens;
          sessionTokensUsed += estimatedTokens;
        }

        // 截断上下文以防止超出窗口
        truncateContext();

        // 提取工具调用信息用于记忆
        const toolCalls: { name: string; args: any }[] = [];
        for (const msg of result.messages) {
          if (
            (msg as any).tool_calls &&
            (msg as any).tool_calls.length > 0
          ) {
            for (const tc of (msg as any).tool_calls) {
              toolCalls.push({ name: tc.name, args: tc.args });
            }
          }
        }

        // 保存短期记忆
        await extractAndSaveMemory(trimmed, String(lastMessage.content), toolCalls);
      } catch (error: any) {
        process.stdout.write("\r\x1b[K");
        console.error("调用模型失败：", error?.message || error);
      }
      ask();
    });
  };

  ask();
};

main().catch((error) => console.error("启动失败：", error));
