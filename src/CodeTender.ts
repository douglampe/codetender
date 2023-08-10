import path from 'path';
import pkgInfo from '../package.json';

import { exec } from 'child_process';

import { 
  CodeTenderConfig,
  CodeTenderState,
  ConfigParser,
  FileHandler,
  InputHandler,
  Logger,
  TokenProcessor,
  ScriptHandler,
} from './index';

const REMOTE_ROOT = '__CT_REMOTE_ROOT__';
const SCHEMA_VERSION = '1.1.0';

export class CodeTender {
  private inputHandler: InputHandler;
  private fileHandler: FileHandler;
  private configParser: ConfigParser;
  private tokenProcessor: TokenProcessor;
  private scriptHandler: ScriptHandler;

  public config: CodeTenderConfig;
  public state: CodeTenderState;
  public logger: Logger;

  public constructor(config: CodeTenderConfig) {
    this.config = config;

    this.state = {
      config: {
        schemaVersion: SCHEMA_VERSION,
        originalConfig: config,
        configPaths: [],
      },
      source: {
        template: config.template ?? '',
        sourcePath: config.template ? FileHandler.resolve(config.template) : '',
        isLocalTemplate: false,
        remote: [],
      },
      target: {
        folder: config.folder,
        targetPath: FileHandler.resolve(config.folder),
      },
      process: {
        banner: [],
        processPath: '',
        tempPath: '',
        tokens: [],
        variables: [],
        ignore: [],
        noReplace: [],
        scripts: {
        },
        delete: [],
        tokenMap: {},
      },
      output: {
        notReplacedFiles: {},
        errors: [],
      },
    };

    if (config.tokens) {
      this.state.process.tokens = this.state.process.tokens.concat(config.tokens);
    }

    if (config.variables) {
      this.state.process.variables = this.state.process.variables.concat(config.variables);
    }

    if (config.ignore) {
      this.state.process.ignore = this.state.process.ignore.concat(config.ignore);
    }

    if (config.noReplace) {
      this.state.process.noReplace = this.state.process.noReplace.concat(config.noReplace);
    }

    // Always ignore .git folder
    if (this.state.process.noReplace.indexOf('**/.git/') === -1) {
      this.state.process.noReplace.push('**/.git/');
    }

    if (this.state.process.ignore.indexOf('**/.git/') === -1) {
      this.state.process.ignore.push('**/.git/');
    }

    // Always ignore the .codetender file
    if (this.state.process.noReplace.indexOf('.codetender') === -1) {
      this.state.process.noReplace.push('.codetender');
    }

    if (this.state.process.ignore.indexOf('.codetender') === -1) {
      this.state.process.ignore.push('.codetender');
    }

    // Add root folder as variable
    this.state.process.variables.push({
      name: 'CODETENDER_ROOT',
      value: this.state.target.folder,
    });

    this.logger = new Logger(this);
    this.configParser = new ConfigParser(this);
    this.inputHandler = new InputHandler(this);
    this.fileHandler = new FileHandler(this);
    this.tokenProcessor = new TokenProcessor(this);
    this.scriptHandler = new ScriptHandler(this);
  }

  public async new() {
    if (await FileHandler.dirExists(this.state.target.folder)) {
      this.logger.log(
        'Folder ' +
        this.config.folder +
        " already exists. Please specify a valid name for a new folder or use 'codetender replace' to replace tokens in existing files.",
        );
      throw new Error('Folder ' + this.config.folder + ' already exists.');
    }
    
    try {
      this.logger.splash('Serving up code...');
      await this.fileHandler.createTempFolder();
      await this.copyOrClone();
      this.logger.logCloneSuccess();
      await this.configParser.readTemplateConfig();
      await this.configParser.readFileConfig();
      if (await this.cloneRemoteTemplates()) {
        await this.processRemoteTemplates();
      }
      await this.fileHandler.cleanupIgnored();
      
      if (!(await this.inputHandler.getTokens())) {
        this.logger.verboseLog('Abort requested. Exiting...');
        return;
      }
      
      await this.tokenProcessor.prepTokens();
      await this.scriptHandler.runBeforeScript();
      await this.tokenProcessor.renameAllFiles();
      await this.scriptHandler.runAfterScript();
      await this.fileHandler.cleanUpDelete();
      await this.fileHandler.copyFromTemp();
      this.logger.logTokenSuccess();
      this.logger.banner();
    } catch (err) {
      this.logger.oops(err, true);
      throw err;
    } finally {
      await this.fileHandler.deleteTemp();
    }
  }

  public async add() {}

  public async replace() {
    this.state.process.processPath = this.state.target.targetPath;

    if (!(await FileHandler.dirExists(this.state.target.targetPath))) {
      this.logger.log(
        `Folder ${this.config.folder} does not exist. Please specify a valid folder or use 'codetender new' to copy and process a template.`
      );
      throw new Error(`Folder ${this.config.folder} does not exist.`);
    }

    this.logger.splash('Replacing in place...');

    try {
      await this.configParser.readFileConfig();

      if (!(await this.inputHandler.getTokens())) {
        return;
      }

      await this.tokenProcessor.prepTokens();
      await this.tokenProcessor.renameAllFiles();
      await this.fileHandler.cleanUpDelete();
      this.logger.logTokenSuccess();
    } catch (err) {
      this.logger.oops(err, true);
    }
  }

  /**
   * Clone remote templates
   */
  async cloneRemoteTemplates(): Promise<boolean> {
    if (this.config.remote?.length ?? 0 > 0) {
      this.logger.verboseLog('Remote templates found.');

      const rootTemplates = this.config.remote?.filter((r) => r.dest === '/');

      if ((rootTemplates?.length ?? 0) > 1) {
        throw new Error('More than one remote root template was specified. Aborting.');
      }

      for await (const i of this.config.remote ?? []) {
        if (i.dest === '/') {
          this.state.process.remoteRoot = path.join(this.state.process.processPath, REMOTE_ROOT);
          await this.gitClone(i.src, this.state.process.remoteRoot);
        } else {
          await this.gitClone(i.src, path.join(this.state.source.sourcePath, i.dest));
        }
      }
      return true;
    } else {
      this.logger.verboseLog('No remote templates found.');
      return false;
    }
  }

  /**
   * Process token replacement in remote templates
   */
  async processRemoteTemplates() {
    if (this.config.remote?.length ?? 0 > 0) {
      this.logger.verboseLog('Processing remote templates...');

      for await (const r of this.config.remote ?? []) {
        if (r.tokens && r.tokens.length > 0) {
          const ct = new CodeTender({
            logger: this.config.logger,
            folder: r.dest === '/' ? this.state.process.remoteRoot! : path.join(this.state.source.sourcePath, r.dest),
            tokens: r.tokens,
            noReplace: this.config.remote?.filter((r2) => r.dest === '/' && r2.dest !== '/').map((r2) => r2.dest + '/'),
            verbose: this.config.verbose,
            quiet: this.config.quiet,
            noSplash: true,
          });
          this.logger.log('');
          this.logger.log('Processing remote template in folder: ' + r.dest);
          await ct.replace();
        }
      }

      if (this.state.process.remoteRoot) {
        await this.fileHandler.copyFromFs(this.state.process.remoteRoot, this.state.process.processPath);
        await FileHandler.remove(this.state.process.remoteRoot);
      }
    }
  }

  public async copyOrClone() {
    this.logger.verboseLog('Copying or cloning template...');
    
    if (await FileHandler.dirExists(this.state.source.template!)) {
      this.logger.verboseLog('Template is local');
      this.state.source.isLocalTemplate = true;
      this.logger.log(`Copying from local template folder: ${this.state.source.template} into temporary folder: ${this.state.source.sourcePath}`);

      return this.fileHandler.copyFromFs(this.state.source.template!, this.state.source.sourcePath);
    }

    this.logger.verboseLog('Template appears to be remote');

    if (!this.state.source.template.match(/http.+/g)) {
      this.state.source.template = 'https://github.com/' + this.state.source.template;
      this.logger.verboseLog('Added https prefix to template: ' + this.state.source.template);
    }

    if (!this.state.source.template!.match(/.+\.git/g)) {
      this.state.source.template += '.git';
      this.logger.verboseLog('Added git extension to template: ' + this.state.source.template);
    }

    return this.gitClone(this.state.source.template!, this.state.source.sourcePath);
  }

  /**
   * Clone git repository and detach
   * @param {string} repo URL of git repository
   * @param {string} folder folder to clone into
   */
  async gitClone(repo: string, folder: string) {
    this.logger.log('Cloning from repo: ' + repo + ' into temporary folder: ' + folder);

    await this.runChildProcess('git clone ' + repo + ' ' + folder, '.');
  }

  // Run a child process
  async runChildProcess(command: string, cwd: string) {
    this.logger.verboseLog('  Running command: ' + command);

    return new Promise<void>((resolve, reject) => {
      exec(command, { cwd: cwd || this.state.process.processPath }, (err, stdout, stderr) => {
        if (err) {
          reject(stderr);
        } else {
          resolve();
        }
      });
    });
  }

  async exit(failed: boolean = false) {
    return process.exit(failed ? 1 : 0);
  }

  public static getVersion() {
    return pkgInfo.version;
  }
}
