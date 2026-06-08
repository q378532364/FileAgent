import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

export const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  next: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "agent",
  }),
  instructions: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
});
