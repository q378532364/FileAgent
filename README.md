# FileAgent

[English](README.en.md) | **中文**

AI 驱动的文件管理 CLI 工具，支持自然语言对话 + 斜杠命令双轨操作。通过大模型理解用户意图，自动调用工具完成文件的批量重命名、移动、整理、搜索等操作。

## 功能特性

### 核心能力

| 工具 | 说明 |
|------|------|
| `readFile` | 查看文件内容，大文件自动截断 |
| `listFiles` | 浏览目录结构 |
| `createFile` | 创建文件（有后缀）或目录（无后缀） |
| `renameFile` | 单文件重命名 |
| `batchRename` | 批量重命名，支持 `{n}` `{name}` `{ext}` 模板 |
| `moveFile` | 移动/剪切文件 |
| `safeDelete` | 安全删除，文件移入 `.trash/` 而非系统回收站 |

### 联网搜索

| 工具 | 说明 |
|------|------|
| `webSearch` | Bing 联网搜索，返回标题/链接/摘要 |
| `webSearchAndSave` | 搜索 + 一步保存到文件，支持 `txt` `json` `md` 格式 |

### 撤销系统

所有文件操作均可通过 `/undo` 或 Agent 调用 `undoDelete` 撤销：

| 操作 | 撤销方式 |
|------|---------|
| 删除 | 从 `.trash/` 恢复到原路径 |
| 创建文件 | 删除该文件 |
| 创建目录 | 删除该空目录（非空拒绝） |
| 重命名 | 改回原名 |
| 批量重命名 | 逐个恢复原名 |
| 移动 | 移回原路径 |

### CLI 增强

- AI 回复使用淡色 + `FileAgent` 前缀
- 工具调用实时显示（工具名、参数、结果）
- 上下文容量展示：`xxk (x%) ████████░░░░`
- 短期记忆：自动提取用户习惯保存到 `.fileagent-memory.json`

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8

### 安装

```bash
git clone <repo-url>
cd FileAgent
pnpm install
```

### 配置

在项目根目录创建 `.env` 文件：

```env
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o
# 可选：自定义 API 地址（兼容 OpenAI 协议的服务）
OPENAI_API_BASE=
```

### 启动

```bash
# 开发模式
pnpm dev

# 构建后运行
pnpm build
pnpm start
```

## 使用方式

### 斜杠命令

```
/help              显示帮助
/tools             列出可用工具
/undo              撤销上一次操作
/clear             清除上下文和会话历史
/exit              退出

/create <path>     创建文件或目录（无后缀 = 目录）
/delete <path>     删除文件到 .trash/
/move <src> <dest> 移动文件
/rename <old> <new> 重命名文件
/batch-rename <dir> <pattern>  批量重命名
```

**批量重命名模板变量：**
- `{n}` — 序号（从 1 开始）
- `{name}` — 原文件名（不含扩展名）
- `{ext}` — 原扩展名（不含点号）

```bash
/batch-rename ./docs report_{n}.txt
# 1.txt → report_1.txt, 2.txt → report_2.txt, ...
```

### 自然语言对话

直接用中文描述需求，Agent 自动理解并调用工具：

```
> 帮我把 download 里所有 jpg 重命名为 photo_{n}.jpg
> 看一下 src 目录有什么文件
> 搜索 Node.js 教程保存到 docs/tutorials.md
> 帮我删掉 temp 目录下的 log 文件
> 撤销刚才的操作
```

## 项目结构

```
FileAgent/
├── src/
│   ├── index.ts              # CLI 主入口，Readline 交互循环
│   ├── undo.ts               # 统一撤销调度中心
│   ├── LLM/
│   │   └── index.ts          # 大模型初始化 + callModel
│   ├── agent/
│   │   ├── graph.ts          # LangGraph 状态机拓扑
│   │   ├── nodes.ts          # 工具定义 + ToolNode
│   │   ├── state.ts          # 全局状态定义
│   │   └── prompts.ts        # 系统提示词
│   ├── command/
│   │   ├── index.ts          # 自定义命令框架
│   │   └── fileCommands.ts   # 斜杠命令注册
│   ├── tools/
│   │   ├── read.ts           # 读取文件内容
│   │   ├── create.ts         # 创建文件/目录
│   │   ├── delete.ts         # 安全删除（移入 .trash/）
│   │   ├── move.ts           # 移动文件
│   │   ├── rename.ts         # 重命名/批量重命名
│   │   ├── list.ts           # 列出目录内容
│   │   └── webSearch.ts      # Bing 联网搜索 + 保存
│   ├── config/
│   │   └── env.ts            # 环境变量与路径配置
│   ├── db/
│   │   └── sqlite.ts         # 操作日志（JSON）+ 撤销记录
│   ├── memo/
│   │   └── index.ts          # 短期记忆（用户习惯）
│   └── utils/
│       └── path.ts           # 路径解析（~、相对、绝对）
├── .trash/                   # 删除文件的暂存区
├── .fileagent.json           # 操作日志（撤销依据）
├── .fileagent-memory.json    # 用户习惯记忆
├── package.json
└── tsconfig.json
```

## 技术栈

- **运行时**: Node.js + TypeScript
- **AI 框架**: LangChain + LangGraph（状态机工作流）
- **大模型**: OpenAI API（默认 gpt-4o，兼容任意 OpenAI 协议服务）
- **联网搜索**: Bing HTML 抓取 + Cheerio 解析
- **CLI 交互**: Readline + Enquirer（命令向导/自动补全）
- **文件操作**: fs-extra
- **日志存储**: JSON 文件（`.fileagent.json`）

## 工作原理

### Agent 工作流

```
用户输入
  ↓
[agent] 调用大模型，决定是否需要工具
  ↓ 有 tool_calls
[tools] 执行文件操作，返回结果
  ↓
[agent] 大模型处理结果，生成最终回复
  ↓ 无 tool_calls
返回给用户
```

### 撤销机制

```
每次操作 → logAction(action, details)  写入 .fileagent.json
撤销时  → getLastUndoableAction()     读最后一条未撤销记录
         → 执行逆向操作
         → markUndone(id)             标记已撤销，防重复
```

## License

[Apache-2.0](LICENSE)
