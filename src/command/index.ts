export interface CommandOption {
  flags: string;
  description: string;
}

export interface SubCommand {
  name: string;
  description: string;
  action: (args: string[], options: Record<string, string | boolean>) => void;
}

function showBanner(): void {
  const banner = `
  ╔══════════════════════════════════════════╗
  ║     ██╗    ██╗███████╗██╗██╗   ██╗██╗  ║
  ║     ██║    ██║██╔════╝██║╚██╗ ██╔╝██║  ║
  ║     ██║ █╗ ██║█████╗  ██║ ╚████╔╝ ██║  ║
  ║     ██║███╗██║██╔══╝  ██║  ╚██╔╝  ██║  ║
  ║     ╚███╔███╔╝███████╗██║   ██║   ██║  ║
  ║      ╚══╝╚══╝ ╚══════╝╚═╝   ╚═╝   ╚═╝  ║
  ║──────────────────────────────────────────║
  ║     ✦  一个可以帮你操作任意文件的工具  ✦           ║
  ╚══════════════════════════════════════════╝
  `;
  console.log(banner);
}

export class Command {
  private _name = "";
  private _description = "";
  private _version = "";
  private _options: CommandOption[] = [];
  private _subcommands: SubCommand[] = [];
  private _action?: (
    args: string[],
    options: Record<string, string | boolean>,
  ) => void;

  name(n: string): this {
    this._name = n;
    return this;
  }

  description(d: string): this {
    this._description = d;
    return this;
  }

  version(v: string): this {
    this._version = v;
    return this;
  }

  option(flags: string, description: string): this {
    this._options.push({ flags, description });
    return this;
  }

  command(name: string): Command {
    const sub = new Command();
    this._subcommands.push({ name, description: "", action: () => {} });
    return sub;
  }

  descriptionForSub(name: string, desc: string): this {
    const cmd = this._subcommands.find((c) => c.name === name);
    if (cmd) cmd.description = desc;
    return this;
  }

  action(
    fn: (args: string[], options: Record<string, string | boolean>) => void,
  ): this {
    this._action = fn;
    return this;
  }

  parse(argv: string[]): void {
    const args = argv.slice(2);

    if (args.length === 0) {
      showBanner();
      this.showHelp();
      return;
    }

    if (args[0] === "--help" || args[0] === "-h") {
      showBanner();
      this.showHelp();
      return;
    }

    if (args[0] === "--version" || args[0] === "-V") {
      showBanner();
      console.log(`  Version: ${this._version}\n`);
      return;
    }

    const subName = args[0];
    const sub = this._subcommands.find((c) => c.name === subName);
    if (sub) {
      sub.action(args.slice(1), {});
      return;
    }

    if (this._action) {
      this._action(args, {});
    }
  }

  private showHelp(): void {
    const line = "  ──────────────────────────────────────────────";
    console.log(`  ${this._name} - ${this._description}\n`);
    console.log("  USAGE\n");
    console.log(`    weiyi <command> [options]\n`);

    if (this._subcommands.length > 0) {
      console.log("  COMMANDS\n");
      for (const sub of this._subcommands) {
        console.log(`    ${sub.name.padEnd(16)} ${sub.description}`);
      }
      console.log("");
    }

    if (this._options.length > 0) {
      console.log("  OPTIONS\n");
      for (const opt of this._options) {
        console.log(`    ${opt.flags.padEnd(16)} ${opt.description}`);
      }
      console.log("");
    }

    console.log(line);
    console.log(`    --version, -V        Show version`);
    console.log(`    --help, -h           Show this help\n`);
  }
}
