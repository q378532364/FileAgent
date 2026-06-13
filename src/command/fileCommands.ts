import { Command } from './index';
import { safeDelete } from '../tools/delete';
import { moveFile } from '../tools/move';
import { renameFile, batchRename } from '../tools/rename';
import { createFile } from '../tools/create';
import { runCode } from '../tools/exec';

export const program = new Command()
  .name('FileAgent')
  .description('一个可以帮你操作任意文件的工具')
  .version('1.0.0');

program.command('delete')
  .description('删除文件到回收站')
  .action(async (args) => {
    if (args.length < 1) {
      console.log('用法: /delete <文件路径>');
      return;
    }
    const result = await safeDelete(args[0]);
    console.log(result);
  });

program.command('move')
  .description('移动/剪切文件')
  .action(async (args) => {
    if (args.length < 2) {
      console.log('用法: /move <源路径> <目标路径>');
      return;
    }
    const result = await moveFile(args[0], args[1]);
    console.log(result);
  });

program.command('rename')
  .description('重命名文件')
  .action(async (args) => {
    if (args.length < 2) {
      console.log('用法: /rename <当前文件名> <新文件名>');
      return;
    }
    const result = await renameFile(args[0], args[1]);
    console.log(result);
  });

program.command('batch-rename')
  .description('批量重命名文件')
  .action(async (args) => {
    if (args.length < 2) {
      console.log('用法: /batch-rename <目录路径> <命名模板>');
      console.log('  模板变量: {n} 序号  {name} 原名  {ext} 扩展名');
      return;
    }
    const result = await batchRename(args[0], args[1]);
    console.log(result);
  });

program.command('create')
  .description('创建文件或目录（无后缀则创建目录）')
  .action(async (args) => {
    if (args.length < 1) {
      console.log('用法: /create <路径>');
      console.log('  有后缀 → 创建文件，如 /create notes.txt');
      console.log('  无后缀 → 创建目录，如 /create docs');
      return;
    }
    const result = await createFile(args[0]);
    console.log(result);
  });


