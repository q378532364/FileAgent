export interface CommandOption {
  flags: string;
  description: string;
}

export interface SubCommand {
  name: string;
  description: string;
  action: (args: string[], options: Record<string, string | boolean>) => void;
}


export class Command {
  public _name = "";
  public _description = "";
  public _version = "";
  public _options: CommandOption[] = [];
  public _subcommands: Command[] = [];
  public _action?: (
    args: string[],
    options: Record<string, string | boolean>,
  ) => void | Promise<void>;

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
    const sub = new Command().name(name);
    this._subcommands.push(sub);
    return sub;
  }

  descriptionForSub(name: string, desc: string): this {
    const cmd = this._subcommands.find((c) => c._name === name);
    if (cmd) cmd.description(desc);
    return this;
  }

  action(
    fn: (args: string[], options: Record<string, string | boolean>) => void | Promise<void>,
  ): this {
    this._action = fn;
    return this;
  }

  async parse(argv: string[]): Promise<void> {
    const args = argv.slice(2);

    if (args.length === 0) {
      if (this._action) {
        await this._action([], {});
        return;
      }
     
      this.showHelp();
      return;
    }

    if (args[0] === "--help" || args[0] === "-h") {
     
      this.showHelp();
      return;
    }

    if (args[0] === "--version" || args[0] === "-V") {
     
      console.log(`  Version: ${this._version}\n`);
      return;
    }

    const subName = args[0];
    const sub = this._subcommands.find((c) => c._name === subName);
    if (sub) {
      await sub.parse(['', '', ...args.slice(1)]);
      return;
    }

    if (this._action) {
      await this._action(args, {});
    } else {
      console.error(`未知命令: ${subName}`);
      this.showHelp();
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
        console.log(`    ${sub._name.padEnd(16)} ${sub._description}`);
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
