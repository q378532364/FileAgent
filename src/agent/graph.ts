import { StateGraph, END, START } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { AgentState } from "./state";
import { toolNode } from "./nodes";
import { callModel } from "../LLM/index";

const C = {
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
};

const workflow = new StateGraph(AgentState)
  .addNode("agent", callModel)
  .addNode("tools", async (state: any) => {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
      const names = lastMessage.tool_calls.map((tc: any) => tc.name).join(", ");
      console.log(
        `\n  ${C.cyan}${C.bold}⚡执行工具${C.reset} ${C.cyan}${names}${C.reset}`,
      );
    }
    return toolNode.invoke(state);
  })
  .addEdge(START, "agent")
  .addConditionalEdges("agent", (state) => {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1] as AIMessage;
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
      return "tools";
    }
    return END;
  })
  .addEdge("tools", "agent");

export const graph = workflow.compile();
