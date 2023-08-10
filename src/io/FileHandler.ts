import path from 'path';
import { rimraf } from 'rimraf';
import * as fsExtra from 'fs-extra';
import fs from 'fs';
import { CodeTender } from 'src/CodeTender';
import { ReplaceInFileConfig, replaceInFile } from 'replace-in-file';

const TEMPLATE_ROOT = '__CT_TEMPLATE_ROOT__';

export class FileHandler {
  private ct: CodeTender;

  constructor(ct: CodeTender) {
    this.ct = ct;
  }

  async createTempFolder() {
    this.ct.logger.verboseLog('Creating temporary folder...');

    await FileHandler.ensurePathExists(this.ct.state.target.targetPath);

    this.ct.state.process.tempPath = await fs.promises.mkdtemp(this.ct.state.target.targetPath);
    this.ct.state.source.sourcePath = path.join(this.ct.state.process.tempPath, TEMPLATE_ROOT);
    this.ct.state.process.processPath = this.ct.state.source.sourcePath;
  }

  async copyFromTemp() {
    this.ct.logger.verboseLog('Copying from temporary folder ' + this.ct.state.process.tempPath + ' to target folder ' + this.ct.state.target.targetPath);

    await this.copyFromFs(this.ct.state.source.sourcePath, this.ct.state.target.targetPath);
    await FileHandler.remove(this.ct.state.source.sourcePath);
  }

  // Copy template from local file system
  async copyFromFs(from: string, to: string) {
    // Create destination folder if it doesn't exist:
    this.ct.logger.verboseLog(`  Creating folder: ${to}`);
    await FileHandler.ensurePathExists(to);
    // Copy from source to destination:
    this.ct.logger.verboseLog(`  Copying from: ${from} to: ${to}`);

    FileHandler.copy(from, to, this.ct.config.overwrite ?? false);
  }

  // Clean up ignored files after git clone
  cleanupIgnored() {
    this.ct.logger.verboseLog('Cleaning up ignored files...');

    return this.cleanUpFiles(this.ct.config.ignore!, 'ignore');
  }

  cleanUpDelete() {
    this.ct.logger.verboseLog('Cleaning up deleted files...');

    return this.cleanUpFiles(this.ct.config.delete!, 'delete');
  }

  // Clean up files matching patterns provided
  async cleanUpFiles(patterns: string[], key: string) {
    if (!patterns || patterns.length < 1) {
      this.ct.logger.verboseLog('No patterns defined for ' + key + ' config.');
      return;
    }

    this.ct.logger.verboseLog('Removing files from cloned repository matching ' + key + ' config...');

    for await (const pattern of patterns) {
      this.ct.logger.verboseLog('  Removing: ' + path.join(this.ct.state.process.processPath, pattern));

      await FileHandler.remove(path.join(this.ct.state.process.processPath, pattern));
    }
  }

  async deleteTemp() {
    this.ct.logger.verboseLog(`Cleaning up temporary folder: ${this.ct.state.process.tempPath}`);

    if (!this.ct.state.process.tempPath) {
      this.ct.logger.verboseLog('Temporary folder not defined. Skipping delete.');
      return;
    }

    if (!(await FileHandler.dirExists(this.ct.state.process.tempPath))) {
      this.ct.logger.verboseLog('Temporary folder not found. Skipping delete.');
      return;
    }

    await FileHandler.remove(this.ct.state.process.tempPath);

    this.ct.logger.log(`Deleted temporary folder: ${this.ct.state.process.tempPath}`);
  }

  // Wrap path.resolve for mocking without breaking imports
  public static resolve(...paths: string[]) {
    return path.resolve(...paths);
  }

  // Asynchronously check if a path exists
  public static async dirExists(path: string) {
    const stats = await fs.promises.stat(path);

    if (stats) {
      return stats.isDirectory();
    }

    return false;
  }

  // Asynchronously check if a path exists
  public static async exists(path: string): Promise<boolean> {
    try {
      return (await fs.promises.stat(path)) !== undefined;
    } catch {
      return false;
    }
  }

  public static async ensurePathExists(path: string): Promise<void> {
    await fsExtra.mkdirp(path);
  }

  public static async copy(from: string, to: string, overwrite: boolean) {
    return new Promise<void>((resolve, reject) => {
      fsExtra.copy(from, to, { overwrite }, (err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  public static async replaceInFile(config: ReplaceInFileConfig) {
    return replaceInFile(config);
  }

  public static async remove(path: string): Promise<boolean> {
    return rimraf(path);    
  }
}
