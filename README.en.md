# FileAgent

**English** | [中文](README.md)

AI-powered CLI tool for file management. Supports natural language + slash commands. Understands user intent via LLM and automatically calls tools for batch rename, move, organize, search, and more.

## Features

### Core Tools

| Tool | Description |
|------|-------------|
| `readFile` | View file contents, auto-truncates large files |
| `listFiles` | Browse directory structure |
| `createFile` | Create file (with extension) or directory (without extension) |
| `renameFile` | Rename a single file |
| `batchRename` | Batch rename with `{n}` `{name}` `{ext}` templates |
| `moveFile` | Move/cut files |
| `safeDelete` | Safe delete to `.trash/` (not system recycle bin) |

### Web Search

| Tool | Description |
|------|-------------|
| `webSearch` | Search the web via Bing, returns title/URL/snippet |
| `webSearchAndSave` | Search + save results to file (txt/json/md) |

### Undo System

All operations are reversible via `/undo` or agent `undoDelete`:

| Operation | Undo Action |
|-----------|-------------|
| Delete | Restore from `.trash/` to original path |
| Create file | Delete the file |
| Create directory | Delete the empty directory |
| Rename | Rename back to original name |
| Batch rename | Restore each file's original name |
| Move | Move back to original location |

### CLI Enhancements

- AI responses with dim color + `FileAgent` prefix
- Real-time tool call display (name, args, result)
- Context usage bar: `xxk (x%) ████████░░░░`
- Short-term memory: auto-extracts user habits to `.fileagent-memory.json`

## Quick Start

### Requirements

- Node.js >= 18
- pnpm >= 8

### Install

```bash
git clone <repo-url>
cd FileAgent
pnpm install
```

### Configure

Create `.env` in project root:

```env
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o
# Optional: custom API base (any OpenAI-compatible service)
OPENAI_API_BASE=
```

### Run

```bash
pnpm dev          # Development
pnpm build        # Build
pnpm start        # Production
```

## Usage

### Slash Commands

```
/help              Show help
/tools             List available tools
/undo              Undo last operation
/clear             Clear context and history
/exit              Exit

/create <path>     Create file or directory
/delete <path>     Delete file to .trash/
/move <src> <dest> Move file
/rename <old> <new> Rename file
/batch-rename <dir> <pattern>  Batch rename
```

**Batch rename templates:**
- `{n}` — index (starting from 1)
- `{name}` — original name (without extension)
- `{ext}` — original extension (without dot)

### Natural Language

```
> Rename all jpgs in download to photo_{n}.jpg
> What's in the src directory?
> Search Node.js tutorials and save to docs/tutorials.md
> Delete log files in temp
> Undo that
```

## Project Structure

```
FileAgent/
├── src/
│   ├── index.ts              # CLI main entry, Readline loop
│   ├── undo.ts               # Central undo dispatcher
│   ├── LLM/
│   │   └── index.ts          # Model init + callModel
│   ├── agent/
│   │   ├── graph.ts          # LangGraph state machine
│   │   ├── nodes.ts          # Tool definitions + ToolNode
│   │   ├── state.ts          # Global state definition
│   │   └── prompts.ts        # System prompt
│   ├── command/
│   │   ├── index.ts          # Custom command framework
│   │   └── fileCommands.ts   # Slash command registration
│   ├── tools/
│   │   ├── read.ts           # Read file contents
│   │   ├── create.ts         # Create file/directory
│   │   ├── delete.ts         # Safe delete (to .trash/)
│   │   ├── move.ts           # Move files
│   │   ├── rename.ts         # Rename / batch rename
│   │   ├── list.ts           # List directory contents
│   │   └── webSearch.ts      # Bing web search + save
│   ├── config/
│   │   └── env.ts            # Environment & path config
│   ├── db/
│   │   └── sqlite.ts         # Action log (JSON) + undo records
│   ├── memo/
│   │   └── index.ts          # Short-term memory (user habits)
│   └── utils/
│       └── path.ts           # Path resolution (~, relative, absolute)
├── .trash/                   # Deleted files staging area
├── .fileagent.json           # Action log (undo basis)
├── .fileagent-memory.json    # User habit memory
├── package.json
└── tsconfig.json
```

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **AI Framework**: LangChain + LangGraph (state machine workflow)
- **LLM**: OpenAI API (default gpt-4o, compatible with any OpenAI-protocol service)
- **Web Search**: Bing HTML scraping + Cheerio parsing
- **CLI**: Readline + Enquirer (command wizard / autocomplete)
- **File Ops**: fs-extra
- **Storage**: JSON files (`.fileagent.json`)

## License

[Apache-2.0](LICENSE)
