import { CodeTender } from 'src/CodeTender';

export class ScriptHandler {
  private ct: CodeTender;

  constructor(ct: CodeTender) {
    this.ct = ct;
  }

  // Run the before script if it exists
  async runBeforeScript() {
    if (this.ct.state.process.scripts.before.length > 0) {
      this.ct.logger.verboseLog('Running before script...');

      await Promise.all(this.ct.state.process.scripts.before.map((s) => this.ct.runChildProcess(s, this.ct.state.process.processPath)));

      return;
    }

    this.ct.logger.verboseLog('No before script found.');
  }

  // Run the after script if present
  async runAfterScript() {
    if (this.ct.state.process.scripts.after.length > 0) {
      this.ct.logger.verboseLog('Running after script...');

      await Promise.all(this.ct.state.process.scripts.after.map((s) => this.ct.runChildProcess(s, this.ct.state.process.processPath)));
      return;
    } else {
      this.ct.logger.verboseLog('No after script found.');
    }
  }
}
