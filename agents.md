# FileAgent 项目要点

## 1. 项目愿景与目标
- **核心定位**：一个用于批量修改、重命名、移动、整理、排序等文件操作的 AI Agent CLI 工具。
- **产品特性**：在保证低 Token 消耗的前提下，计划实现持久记忆功能，能够学习和记住用户的操作习惯。
- **安全性**：划分了专门的安全工作区（`workspace/`），Agent 的所有操作被严格限制在该区域内；并设立专属暂存区（`.trash/`）实现安全删除与撤销（Undo）机制。

## 2. 核心架构与技术栈
- **语言**：TypeScript (运行于 Node.js 环境)。
- **AI 框架**：基于 **LangChain** 与 **LangGraph** 构建具备状态机工作流的智能体。
- **大模型**：使用 OpenAI 模型（默认配置为 `gpt-4o`）。
- **主要依赖**：
  - `enquirer` & `readline`: 用于构建命令行交互界面（CLI）、支持输入与自动补全。
  - `fs-extra`: 提供健壮的文件系统操作能力。
  - `trash`: 用于将文件安全地移至回收站，而不是直接永久删除。
  - `zod`: 用于大模型 Function Calling 的参数结构校验。

## 3. 项目核心模块划分
- **主入口 (`src/index.ts` & `src/command/`)**：
  - 负责启动 CLI 交互服务，解析用户输入。
  - 支持“斜杠指令（如 `/rename`）”与“自然语言对话”双轨并行。
- **智能大脑 / Agent (`src/agent/`)**：
  - **`graph.ts`**: LangGraph 状态机拓扑定义，控制 LLM 节点与 Tool 节点之间的循环与结束。
  - **`nodes.ts`**: 封装模型调用（`callModel`）与工具节点（`toolNode`），并将底层纯函数注册为 LangChain 识别的 `DynamicStructuredTool`。
  - **`state.ts` & `prompts.ts`**: 定义全局状态（Messages）与系统角色设定（限制其只能在安全工作区操作）。
- **执行双手 / Tools (`src/tools/`)**：
  - `delete.ts`: 调用系统/暂存区实现安全删除。
  - `move.ts`: 实现文件的移动与收纳。
  - `rename.ts`: 支持单文件重命名与基于模板（如 `doc_{n}.txt`）的批量重命名。
- **配置与数据 (`src/config/`, `src/db/`)**：
  - **`env.ts`**: 集中管理环境路径（Workspace, Trash, DB）与 API 密钥。
  - **`sqlite.ts`**: 负责操作日志与审计追踪（当前版本基于 JSON 实现日志记录，为撤销功能提供基础数据）。

## 4. 交互方式与核心链路
- **CLI 硬命令模式**：用户输入带 `/` 的指令（如 `/batch-rename <dir> <pattern>`），CLI 将直接解析参数并执行对应的工具函数。
- **Agent 对话模式**：用户输入自然语言（如“帮我把当前目录的 txt 换成 doc_{n} 的格式”），系统将消息传递给 LangGraph 工作流：
  1. LLM 接收系统提示词与历史对话。
  2. LLM 决定调用 `batchRenameTool` 等预设工具。
  3. `toolNode` 节点执行文件操作。
  4. LLM 汇总结果回复给用户。

## 5. 待开发与扩展计划（占位模块）
从目前的空目录与规划可以看出，未来 1.0.0 版本的迭代方向包括：
- **持久化与记忆体系**：`src/memo/` (习惯记忆) 与 `src/sessions/` (会话管理)。
- **复杂任务规划**：`src/sub-agent/` (多 Agent 协作) 与 `src/queryEngine/` (智能查询引擎)。
- **上下文与权限控制**：`src/context/` 与 `src/permission/`。
- **工具链拓展**：针对特定技术栈 (`src/techStack/`) 或其他扩展能力 (`src/skills/`) 进行深度集成。