import readline from 'readline';
import { graph } from './agent/graph';
import { initDb } from './db/sqlite';
import { HumanMessage } from '@langchain/core/messages';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const main = async () => {
  console.log('正在初始化 File Agent...');
  await initDb();
  console.log("File Agent 已就绪，输入 'exit' 退出。");

  const ask = () => {
    rl.question('> ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        rl.close();
        return;
      }

      try {
        const initialState = {
          messages: [new HumanMessage(input)]
        };

        const result = await graph.invoke(initialState);
        const lastMessage = result.messages[result.messages.length - 1];
        console.log(`助手：${lastMessage.content}`);
      } catch (error) {
        console.error('发生错误：', error);
      }
      ask();
    });
  };

  ask();
};

main().catch((error) => console.error('启动失败：', error));
