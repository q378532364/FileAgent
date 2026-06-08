# file-agent

预计在7月上线一个FileAgent 致力于将文件批量修改 重命名 移动 整理 排序等做成一个agent，在保持不浪费token的情况下有持久记忆功能，它会记住用户的习惯

```text
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
```

# 重要的写在后面

目前还没有发布mvp版本，在发布1.0.0之前，结构和方法会发生很大变化，有任何需求可以在issues中提出