import { CodeTender } from 'src/CodeTender';

export class ScriptHandler {
  private ct: CodeTender;

  constructor(ct: CodeTender) {
    this.ct = ct;
  }

  // Run the before script if it exists
  async runBeforeScript() {
    if (this.ct.config.scripts && this.ct.config.scripts.before) {
      this.ct.logger.verboseLog('Running before script...');

      await this.ct.runChildProcess(this.ct.config.scripts.before, this.ct.state.source.sourcePath);
    }

    this.ct.logger.verboseLog('No before script found.');
  }

  // Run the after script if present
  async runAfterScript() {
    if (this.ct.config.scripts?.after) {
      this.ct.logger.verboseLog('Running after script...');

      await this.ct.runChildProcess(this.ct.config.scripts.after, this.ct.state.source.sourcePath);
    } else {
      this.ct.logger.verboseLog('No after script found.');
    }
  }
}
