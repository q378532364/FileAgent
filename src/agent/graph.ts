import { StateGraph, END, START } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { AgentState } from "./state";
import { callModel, toolNode } from "./nodes";

const workflow = new StateGraph(AgentState)
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
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
