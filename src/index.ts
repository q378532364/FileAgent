import readline from 'readline';

import { graph } from './agent/graph';
import { initDb } from './db/sqlite';
import { HumanMessage } from '@langchain/core/messages';
import { program } from './command/fileCommands';

// ─── 命令列表 ──────────────────────────────────────────────

function getAvailableCommands() {
  const seen = new Set<string>();
  const cmds = program._subcommands
    .filter(sub => {
      if (seen.has(sub._name)) return false;
      seen.add(sub._name);
      return true;
    })
    .map(sub => ({
      name: sub._name,
      description: sub._description,
    }));
  cmds.push({ name: 'help', description: '显示帮助信息' });
  cmds.push({ name: 'tools', description: '列出当前可用工具' });
  cmds.push({ name: 'exit', description: '退出程序' });
  return cmds;
}

function showHelp(): void {
  console.log('\n可用命令：');
  for (const cmd of getAvailableCommands()) {
    console.log(`  /${cmd.name.padEnd(15)} ${cmd.description}`);
  }
  console.log('');
}

// ─── 轻量级内联提示系统 ────────────────────────────────────

const hintState = {
  active: false,
  filtered: [] as { name: string; description: string }[],
  selected: 0,
  rowCount: 0,
  pendingCompletion: null as string | null, // Enter 补全的待处理命令
  argMode: false, // 参数输入模式（禁止触发命令提示）
};

/** 根据当前输入计算过滤后的命令列表 */
function calcFiltered(line: string) {
  const cmds = getAvailableCommands();
  if (!line.startsWith('/')) return [];
  const afterSlash = line.slice(1);
  const spaceIdx = afterSlash.indexOf(' ');
  const cmdPart = spaceIdx >= 0 ? afterSlash.slice(0, spaceIdx) : afterSlash;
  if (!cmdPart) return cmds;
  return cmds.filter(c => c.name.startsWith(cmdPart));
}

/** 将提示列表渲染到输入行下方 */
function renderHints() {
  const { filtered, selected } = hintState;

  // 先清除上一次渲染
  if (hintState.active && hintState.rowCount > 0) {
    process.stdout.write('\x1b[s');                    // save cursor
    process.stdout.write('\x1b[' + (hintState.rowCount + 1) + 'B'); // 移到提示区下方
    for (let i = hintState.rowCount; i > 0; i--) {
      process.stdout.write('\x1b[' + i + 'A');        // 逐行上移
      process.stdout.write('\x1b[2K');                 // 清除该行
    }
    process.stdout.write('\x1b[u');                    // restore cursor
  }

  if (filtered.length === 0) {
    hintState.active = false;
    hintState.rowCount = 0;
    return;
  }

  hintState.active = true;

  // ── 垂直列表渲染（命令名 + 描述分两行） ──
  process.stdout.write('\x1b[s');                    // 保存光标（在输入行）
  process.stdout.write('\n');                         // 换到下一行开始绘制

  for (let i = 0; i < filtered.length; i++) {
    const c = filtered[i];
    const cmdName = '/' + c.name;

    if (i > 0) process.stdout.write('\n');

    // 命令名行
    process.stdout.write('\x1b[2K');
    if (i === selected) {
      process.stdout.write('\x1b[7m' + cmdName + '\x1b[0m');
    } else {
      process.stdout.write('\x1b[36m' + cmdName + '\x1b[0m');
    }

    // 描述行
    process.stdout.write('\n');
    process.stdout.write('\x1b[2K');
    if (i === selected) {
      process.stdout.write('\x1b[7m  ' + c.description + '\x1b[0m');
    } else {
      process.stdout.write('\x1b[90m  ' + c.description + '\x1b[0m');
    }
  }

  hintState.rowCount = filtered.length * 2;
  process.stdout.write('\x1b[u');                    // 恢复光标到输入行
}

/** 清除提示区域 */
function clearHints() {
  if (!hintState.active || hintState.rowCount === 0) {
    hintState.active = false;
    return;
  }
  process.stdout.write('\x1b[s');
  process.stdout.write('\x1b[' + (hintState.rowCount + 1) + 'B');
  for (let i = hintState.rowCount; i > 0; i--) {
    process.stdout.write('\x1b[' + i + 'A');
    process.stdout.write('\x1b[2K');
  }
  process.stdout.write('\x1b[u');
  hintState.active = false;
  hintState.rowCount = 0;
}

// ─── 命令执行 ──────────────────────────────────────────────

async function handleCommand(fullInput: string): Promise<boolean> {
  const parts = fullInput.startsWith('/') ? fullInput.slice(1).trim().split(/\s+/) : [];
  const cmd = parts[0] || '';
  const args = parts.slice(1);

  if (!cmd) return false;

  switch (cmd) {
    case 'exit':
      return true;
    case 'help':
      showHelp();
      return false;
    case 'tools':
      console.log('\n当前可用工具：');
      const { agentTools } = await import('./agent/nodes');
      for (const t of agentTools) {
        console.log(`  - ${t.name}: ${t.description}`);
      }
      console.log('');
      return false;
    default: {
      const sub = program._subcommands.find(c => c._name === cmd);
      if (sub) {
        await program.parse(['node', 'script', cmd, ...args]);
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
  completer: (line: string) => {
    if (line.startsWith('/')) {
      const cmds = getAvailableCommands().map(c => `/${c.name}`);
      const hits = cmds.filter(c => c.startsWith(line));
      return [hits.length ? hits : cmds, line];
    }
    return [[], line];
  },
});

// ─── 提示交互：键盘事件 ────────────────────────────────────

process.stdin.on('keypress', (_str: string, key: any) => {
  if (!key) return;
  const line = rl.line;

  // ── 提示正在显示时的交互 ──
  if (hintState.active) {
    // 方向键：移动选择
    if (key.name === 'up' || key.name === 'down') {
      const dir = key.name === 'up' ? -1 : 1;
      hintState.selected = Math.max(
        0,
        Math.min(hintState.filtered.length - 1, hintState.selected + dir),
      );
      renderHints();
      return;
    }
    if (key.name === 'left' || key.name === 'right') {
      const dir = key.name === 'left' ? -1 : 1;
      hintState.selected = Math.max(
        0,
        Math.min(hintState.filtered.length - 1, hintState.selected + dir),
      );
      renderHints();
      return;
    }

    // Tab：选中当前高亮命令并写入输入行
    if (key.name === 'tab') {
      const chosen = hintState.filtered[hintState.selected];
      if (chosen) {
        clearHints();
        rl.pause();
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        rl.write(`/${chosen.name} `);
        rl.resume();
        rl.prompt(true);
      }
      return;
    }

    // Enter：标记待补全，让 question 回调弹出参数输入框
    if (key.name === 'return') {
      const chosen = hintState.filtered[hintState.selected];
      clearHints();
      if (chosen) {
        const afterCmd = line.slice(1 + chosen.name.length);
        // 命令名不完整 或 完整但没有参数 → 弹出参数输入框
        if (!line.startsWith(`/${chosen.name}`) || !afterCmd.trim()) {
          hintState.pendingCompletion = `/${chosen.name}`;
        }
      }
      // 让 question 回调正常触发
      return;
    }

    // Escape：关闭提示
    if (key.name === 'escape') {
      clearHints();
      rl.pause();
      rl.resume();
      rl.prompt(true);
      return;
    }

    // 其他按键：清除提示，让 readline 正常处理输入
    clearHints();
    return;
  }

  // ── 提示未显示时：检测是否开始输入 / ──
  if (!hintState.argMode && line.startsWith('/')) {
    hintState.filtered = calcFiltered(line);
    hintState.selected = 0;
    renderHints();
  }
});

// ─── 主循环 ────────────────────────────────────────────────

const main = async () => {
  console.log('正在初始化 File Agent...');
  await initDb();
  console.log('File Agent 已就绪。输入 / 查看可用命令，↑↓ 选择，Tab 补全。\n');

  const ask = () => {
    rl.question('> ', async (input) => {
      // 每次提交都清除残留提示
      clearHints();

      // ── 处理 Enter 选择命令后的参数输入 ──
      if (hintState.pendingCompletion) {
        const cmdName = hintState.pendingCompletion;
        hintState.pendingCompletion = null;
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        // 用 rl.write 写入命令名（同步更新 readline 内部行缓冲区）
        rl.write(cmdName + ' ');
        // 进入参数输入模式，禁止触发命令提示
        hintState.argMode = true;
        // 显示参数输入提示
        rl.setPrompt('> ');
        rl.prompt();
        // 注册一次性监听器获取参数
        rl.once('line', async (argInput: string) => {
          hintState.argMode = false;
          const arg = argInput.trim();
          const fullCmd = arg ? `${cmdName} ${arg}` : cmdName;
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
          ask();
        });
        return;
      }

      const trimmed = input.trim();

      // ── 命令处理 ──
      if (trimmed.startsWith('/')) {
        rl.pause();
        const parts = trimmed.slice(1).trim().split(/\s+/);
        const cmdName = parts[0];
        const choices = getAvailableCommands();

        // 命令名完全匹配 → 直接执行
        const exactMatch = cmdName && choices.find(c => c.name === cmdName);
        if (exactMatch) {
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
          rl.resume();
          ask();
          return;
        }

        // 命令不完整 → 尝试模糊匹配
        const matching = cmdName
          ? choices.filter(c => c.name.startsWith(cmdName))
          : choices;

        if (matching.length === 1) {
          // 唯一匹配 → 直接执行（与精确匹配行为一致）
          const rest = parts.slice(1).join(' ');
          const fullCmd = `/${matching[0].name}${rest ? ' ' + rest : ''}`;
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
          rl.resume();
          ask();
          return;
        }

        // 0 或多个匹配 → 文本提示，不弹任何选择器
        if (matching.length === 0) {
          console.log(`未知命令: ${cmdName || '(空)'}，输入 /help 查看可用命令`);
        } else {
          console.log('可选命令：');
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

      try {
        const initialState = { messages: [new HumanMessage(trimmed)] };
        const result = await graph.invoke(initialState);
        const lastMessage = result.messages[result.messages.length - 1];
        console.log(`助手：${lastMessage.content}`);
      } catch (error) {
        console.error('发生错误：', error);
      }
      ask();
    });
  };

  ask();
};

main().catch((error) => console.error('启动失败：', error));
