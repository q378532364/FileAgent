import { ChatOpenAI } from "@langchain/openai";
import { CONFIG } from "../config/env";
import { SYSTEM_PROMPT } from "../agent/prompts";
import { agentTools } from "../agent/nodes";

let model: any = null;

export function getModel() {
  if (!model) {
    model = new ChatOpenAI({
      apiKey: CONFIG.OPENAI_API_KEY,
      modelName: CONFIG.OPENAI_MODEL,
      configuration: {
        baseURL: CONFIG.OPENAI_API_BASE || undefined,
      },
      maxRetries: 1,
    }).bindTools(agentTools);
  }
  return model;
}

export const callModel = async (state: any) => {
  const { messages } = state;
  const llm = getModel();
  const response = await llm.invoke([
    { role: "system", content: SYSTEM_PROMPT },
    ...messages,
  ]);
  return { messages: [response] };
};
