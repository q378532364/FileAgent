file-agent/
├── src/
│   ├── config/             # 全局配置
│   │   └── env.ts          # 环境变量、安全工作区(Workspace)路径配置
│   ├── db/                 # 数据库模块（用于 Undo 撤销和审计日志）
│   │   └── sqlite.ts       # SQLite 初始化及操作日志表定义
│   ├── tools/              # Agent 的“双手”：核心文件操作工具箱（纯函数）
│   │   ├── index.ts        # 工具导出总入口
│   │   ├── delete.ts       # 安全删除逻辑（移至暂存区）
│   │   ├── move.ts         # 移动与收纳逻辑
│   │   └── rename.ts       # 单个/批量重命名与排版逻辑
│   ├── agent/              # Agent 的“大脑”：大模型与工作流
│   │   ├── graph.ts        # LangGraph 拓扑结构定义（状态机）
│   │   ├── nodes.ts        # LangGraph 的各个节点（Plan, Check, Execute）
│   │   ├── state.ts        # LangGraph 的全局状态定义 (State Schema)
│   │   └── prompts.ts      # 系统提示词 (System Prompts)
│   └── index.ts            # 应用主入口（CLI 或服务启动点）
├── workspace/              # 专划出的安全工作区（Agent 只能在这里折腾）
│   └── .trash/             # Agent 的专属暂存区（用于 Undo 撤销）
├── package.json
├── pnpm-lock.yaml
└── tsconfig.json