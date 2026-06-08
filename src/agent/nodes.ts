import { ChatOpenAI } from "@langchain/openai";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as tools from "../tools/index";
import { SYSTEM_PROMPT } from "./prompts";
import { CONFIG } from "../config/env";

// Define tools for the agent
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
  description: "Rename multiple files in a directory using a pattern like 'doc_{n}.txt'.",
  schema: z.object({
    directory: z.string().describe("Directory containing files to rename."),
    pattern: z.string().describe("Naming pattern. Use {n} for index, {name} for old name, {ext} for extension."),
  }),
  func: async ({ directory, pattern }) => await tools.batchRename(directory, pattern),
});

export const agentTools = [safeDeleteTool, moveFileTool, renameFileTool, batchRenameTool];
export const toolNode = new ToolNode(agentTools);

const model = new ChatOpenAI({
  apiKey: CONFIG.OPENAI_API_KEY,
  modelName: CONFIG.OPENAI_MODEL,
}).bindTools(agentTools);

export const callModel = async (state: any) => {
  const { messages } = state;
  const response = await model.invoke([
    { role: "system", content: SYSTEM_PROMPT },
    ...messages,
  ]);
  return { messages: [response] };
};
