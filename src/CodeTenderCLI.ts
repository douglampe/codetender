import pkgInfo from '../package.json';
import { Command } from 'commander';

import { CodeTender } from './CodeTender';

export class CodeTenderCLI {
  public static isTest: boolean;
  public static log: (message: any) => void = console.log;

  public static async run() {
    const program = new Command();

    if (CodeTenderCLI.isTest) {
      program.exitOverride();
    }

    program.name('codetender').version(pkgInfo.version, '-i, --info', 'Display current version number');

    program
      .command('new')
      .argument('template')
      .argument('folder')
      .option('-d, --debug', 'Display debugging output')
      .option('-q, --quiet', 'Do not output to console (overrides --debug)')
      .option('-f, --file <file>', 'Replace tokens as specified in a file')
      .option('-v, --verbose', 'Display verbose debugging output')
      .description('Copies contents of template to new folder then prompts for token replacement as needed')
      .action(CodeTenderCLI.new);

    program
      .command('add')
      .argument('template')
      .argument('folder')
      .option('-d, --debug', 'Display debugging output')
      .option('-q, --quiet', 'Do not output to console (overrides --debug)')
      .option('-f, --file <file>', 'Replace tokens as specified in a file')
      .option('-o, --overwrite', 'Overwrite existing files with template contents')
      .option('-v, --verbose', 'Display verbose debugging output')
      .description('Copies contents of template to an existing folder then prompts for token replacement as needed')
      .action(CodeTenderCLI.add);

    program
      .command('replace')
      .argument('folder')
      .option('-d, --debug', 'Display debugging output')
      .option('-q, --quiet', 'Do not output to console (overrides --debug)')
      .option('-f, --file <file>', 'Replace tokens as specified in a file')
      .option('-v, --verbose', 'Display verbose debugging output')
      .description('Prompts for token replacement and replaces tokens')
      .action(CodeTenderCLI.replace);

    await program.parseAsync(process.argv);
  }

  public static async new(template: string, folder: string, opts: any, cmd: Command) {
    const options = cmd.optsWithGlobals();
    CodeTenderCLI.log(options);

    if (options && options.verbose) {
      CodeTenderCLI.log('Debug output enabled.');
      CodeTenderCLI.log('Command Line Arguments:');
      CodeTenderCLI.log('  Template: ' + template);
      CodeTenderCLI.log('  Folder: ' + folder);
      CodeTenderCLI.log('  Debug: true');
    }

    const ct = new CodeTender({
      ...options,
      template,
      folder,
    });

    await ct.new();
  }

  public static async add(template: string, folder: string, opts: any, cmd: Command) {
    const options = cmd.optsWithGlobals();

    const ct = new CodeTender({
      ...options,
      template,
      folder,
    });

    await ct.add();
  }

  public static async replace(folder: string, opts: any, cmd: Command) {
    const options = cmd.optsWithGlobals();

    const ct = new CodeTender({
      ...options,
      folder,
    });

    await ct.replace();
  }
}
