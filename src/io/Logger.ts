import { CodeTender } from 'src/CodeTender';

export class Logger {
  public logOutput: Array<string>;

  private ct: CodeTender;
  private logger: (message: any) => void;

  constructor(ct: CodeTender) {
    this.ct = ct;

    this.logger = ct.config.logger ?? console.log; //console.log.bind(console);
    this.logOutput = [];
  }

  // Log success of the clone operation
  public logCloneSuccess() {
    if (this.ct.state.source.isLocalTemplate) {
      this.verboseLog("Successfully copied template from '" + this.ct.config.template + "' to '" + this.ct.config.folder + "'.");
    } else {
      this.verboseLog("Successfully cloned template from '" + this.ct.config.template + "' to '" + this.ct.config.folder + "'.");
    }
  }

  // Log success of token replacement
  public logTokenSuccess() {
    if (this.ct.state.process.tokens.length > 0) {
      if (Object.keys(this.ct.state.process.tokenMap).length > 0) {
        this.log('Successfully replaced the following tokens where found:');
        this.log('pattern -> replacement (content/files)');
        this.log('--------------------------------------');

        Object.keys(this.ct.state.process.tokenMap).forEach((key) => {
          const token = this.ct.state.process.tokenMap[key];
          this.log(token.originalPattern + ' -> ' + token.replacement + ' (' + token.count + '/' + token.renamed.length + ')');

          if (this.ct.config.verbose) {
            token.files.forEach((file) => {
              this.verboseLog('  ' + file.file + ' (' + file.count + ')');
            });
            token.renamed.forEach((file) => {
              this.verboseLog('  ' + file.old + ' -> ' + file.new);
            });
          }
        });
      }

      const conflictErrors = this.ct.state.output.errors.filter((e) => e.type === 'Rename Conflict');
      if (conflictErrors.length > 0) {
        this.log('Could not rename the following files or folders due to naming conflicts:');

        conflictErrors.forEach((e) => {
          this.log('  Conflict: ' + e.old + ' -> ' + e.new + ' in folder ' + e.folder);
        });
      }
    } else {
      this.log('No tokens specified.');
    }
  }

  // Log provided output only if verbose is enabled
  public verboseLog(output: string) {
    if (this.ct.config.verbose) {
      this.log(output);
    }
  }

  public log(output: any) {
    if (!this.ct.config.quiet) {
      this.logOutput.push(output);
      this.logger(output);
    }
  }

  public splash(tag: string) {
    if (!this.ct.config.noSplash) {
      this.log('');
      this.log('  _____        __    __              __       ');
      this.log(' / ___/__  ___/ /__ / /____ ___  ___/ /__ ____');
      this.log('/ /__/ _ \\/ _  / -_) __/ -_) _ \\/ _  / -_) __/');
      this.log('\\___/\\___/\\_,_/\\__/\\__/\\__/_//_/\\_,_/\\__/_/   ');
      if (tag) {
        this.log(tag);
      }
    }
  }

  /**
   * Display banner if found in config
   */
  public banner() {
    if (this.ct.config.banner) {
      this.verboseLog('Displaying banner...');

      this.log('');

      if (Array.isArray(this.ct.config.banner)) {
        this.ct.config.banner.forEach((line) => {
          this.log(line);
        });
      } else {
        this.log(this.ct.config.banner);
      }
    } else {
      this.verboseLog('No banner found.');
    }
  }

  /**
   * Display error message
   * @param {string} err Error message
   */
  public oops(err: Error, captured: boolean) {
    if (err) {
      this.log('                          __');
      this.log('  ____  ____  ____  _____/ /');
      this.log(' / __ \\/ __ \\/ __ \\/ ___/ /');
      this.log('/ /_/ / /_/ / /_/ (__  )_/');
      this.log('\\____/\\____/ .___/____(_)');
      this.log('          /_/ ');
      this.log(err.message);
    }

    if (!captured) {
      process.exit();
    }
  }
}
