import { ToolNode } from "@langchain/langgraph/prebuilt";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as tools from "../tools/index";
import { undoLastAction } from "../undo";

const C = {
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
};

function wrapTool(tool: DynamicStructuredTool): DynamicStructuredTool {
  const original = tool.func;
  return new DynamicStructuredTool({
    name: tool.name,
    description: tool.description,
    schema: tool.schema,
    func: async (input) => {
      const argsStr = JSON.stringify(input, null, 2);
      console.log(
        `  ${C.cyan}${C.bold}⚙ 调用工具${C.reset} ${C.yellow}${tool.name}${C.reset}`
      );
      console.log(
        `    ${C.dim}参数: ${argsStr.length > 120 ? argsStr.slice(0, 120) + "..." : argsStr}${C.reset}`
      );
      const result = await original(input);
      const resultStr = String(result);
      if (resultStr.length > 200) {
        console.log(
          `    ${C.dim}结果: ${resultStr.slice(0, 200)}...${C.reset}`
        );
      }
      return result;
    },
  });
}

// ─── 文件操作工具 ──────────────────────────────────────────
const readFileTool = new DynamicStructuredTool({
  name: "readFile",
  description:
    "Read the content of a file. Returns the full content or first N lines for large files. Use this when the user wants to view file contents.",
  schema: z.object({
    filePath: z.string().describe("Path of the file to read."),
    maxLines: z
      .number()
      .optional()
      .default(200)
      .describe("Max lines to return for large files. Default 200."),
  }),
  func: async ({ filePath, maxLines }) => await tools.readFile(filePath, maxLines),
});

const safeDeleteTool = new DynamicStructuredTool({
  name: "safeDelete",
  description: "Safely delete a file by moving it to the trash.",
  schema: z.object({
    filePath: z.string().describe("The path of the file to delete."),
  }),
  func: async ({ filePath }) => await tools.safeDelete(filePath),
});

const moveFileTool = new DynamicStructuredTool({
  name: "moveFile",
  description: "Move a file from source to destination.",
  schema: z.object({
    src: z.string().describe("Source path."),
    dest: z.string().describe("Destination path."),
  }),
  func: async ({ src, dest }) => await tools.moveFile(src, dest),
});

const renameFileTool = new DynamicStructuredTool({
  name: "renameFile",
  description: "Rename a single file.",
  schema: z.object({
    oldPath: z.string().describe("Current file path."),
    newName: z.string().describe("New name for the file."),
  }),
  func: async ({ oldPath, newName }) => await tools.renameFile(oldPath, newName),
});

const batchRenameTool = new DynamicStructuredTool({
  name: "batchRename",
  description:
    "Rename multiple files in a directory using a pattern like 'doc_{n}.txt'.",
  schema: z.object({
    directory: z.string().describe("Directory containing files to rename."),
    pattern: z
      .string()
      .describe(
        "Naming pattern. Use {n} for index, {name} for old name, {ext} for extension."
      ),
  }),
  func: async ({ directory, pattern }) =>
    await tools.batchRename(directory, pattern),
});

const listFilesTool = new DynamicStructuredTool({
  name: "listFiles",
  description:
    "List files and directories in a given path. Returns names, types (file/dir), and sizes.",
  schema: z.object({
    directory: z
      .string()
      .optional()
      .default(".")
      .describe("Directory to list. Defaults to current workspace."),
  }),
  func: async ({ directory }) => await tools.listFiles(directory),
});

const createFileTool = new DynamicStructuredTool({
  name: "createFile",
  description:
    "Create a file or directory. If the path has no extension, it creates a directory. If it has an extension, it creates a file with optional content.",
  schema: z.object({
    filePath: z.string().describe("Path to create. No extension = directory, with extension = file."),
    content: z
      .string()
      .optional()
      .default("")
      .describe("File content. Only used when creating files. Defaults to empty string."),
  }),
  func: async ({ filePath, content }) => await tools.createFile(filePath, content),
});

// ─── 联网搜索工具 ──────────────────────────────────────────
const webSearchTool = new DynamicStructuredTool({
  name: "webSearch",
  description:
    "Search the web and return titles, URLs, and snippets. Supports multiple engines (auto/google/baidu/bing). Use this to find information from the internet. You can call this multiple times with different queries to gather comprehensive information.",
  schema: z.object({
    query: z.string().describe("The search query. Be specific for better results."),
    maxResults: z
      .number()
      .optional()
      .default(5)
      .describe("Maximum number of results. Default 5."),
    engine: z
      .enum(["auto", "google", "baidu", "bing"])
      .optional()
      .default("auto")
      .describe("Search engine to use. Auto tries all and returns first success."),
  }),
  func: async ({ query, maxResults, engine }) =>
    await tools.webSearch(query, maxResults, engine),
});

const fetchWebpageTool = new DynamicStructuredTool({
  name: "fetchWebpage",
  description:
    "Fetch and extract content from a specific URL. Returns page title, text content, and/or links. Use this after webSearch to read detailed content from promising results.",
  schema: z.object({
    url: z.string().describe("The URL to fetch."),
    extractMode: z
      .enum(["text", "links", "full"])
      .optional()
      .default("text")
      .describe("What to extract: 'text' for main content, 'links' for hyperlinks, 'full' for both."),
    maxChars: z
      .number()
      .optional()
      .default(5000)
      .describe("Maximum characters to extract. Default 5000."),
  }),
  func: async ({ url, extractMode, maxChars }) =>
    await tools.fetchWebpage(url, extractMode, maxChars),
});

const webSearchAndSaveTool = new DynamicStructuredTool({
  name: "webSearchAndSave",
  description:
    "Search the web AND save results to a file in one step. Use this when the user wants to search for data and save it to a file. Supports txt, json, md formats.",
  schema: z.object({
    query: z.string().describe("The search query."),
    savePath: z
      .string()
      .describe("File path to save the results (e.g. './data/results.txt')."),
    maxResults: z
      .number()
      .optional()
      .default(10)
      .describe("Maximum number of results. Default 10."),
    format: z
      .enum(["txt", "json", "md"])
      .optional()
      .default("txt")
      .describe("Output format: txt, json, or md."),
    engine: z
      .enum(["auto", "google", "baidu", "bing"])
      .optional()
      .default("auto")
      .describe("Search engine to use."),
  }),
  func: async ({ query, savePath, maxResults, format, engine }) =>
    await tools.webSearchAndSave(query, savePath, maxResults, format, engine),
});

// ─── 代码执行工具 ──────────────────────────────────────────
const runCodeTool = new DynamicStructuredTool({
  name: "runCode",
  description:
    "Execute JavaScript code in a sandbox and return the output. Use this for any task that needs computation, data processing, time operations, or anything not covered by other tools. The code runs as an async IIFE — just write the logic, the result is printed automatically.",
  schema: z.object({
    code: z
      .string()
      .describe(
        "JavaScript code to execute. Write expression or assign to 'result'. The output is captured and returned."
      ),
    timeout: z
      .number()
      .optional()
      .default(10000)
      .describe("Max execution time in ms. Default 10000."),
  }),
  func: async ({ code, timeout }) => await tools.runCode(code, timeout),
});

// ─── 撤销工具 ──────────────────────────────────────────────
const undoTool = new DynamicStructuredTool({
  name: "undoDelete",
  description:
    "Undo the last file operation (delete, create, rename, move, batch-rename). Restores the previous state.",
  schema: z.object({}),
  func: async () => {
    const result = await undoLastAction();
    return result.message;
  },
});

// ─── 导出 ──────────────────────────────────────────────────
const rawTools = [
  readFileTool,
  safeDeleteTool,
  undoTool,
  runCodeTool,
  moveFileTool,
  renameFileTool,
  batchRenameTool,
  listFilesTool,
  createFileTool,
  webSearchTool,
  fetchWebpageTool,
  webSearchAndSaveTool,
];
export const agentTools = rawTools.map(wrapTool);
export const toolNode = new ToolNode(agentTools);
