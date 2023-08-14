import path from 'path';
import semver from 'semver';
import fs from 'graceful-fs';

import { CodeTender, FileHandler, RemoteTemplateConfig, Token } from '../index';

export class ConfigParser {
  private configPaths: Array<string>;
  private ct: CodeTender;

  constructor(ct: CodeTender) {
    this.ct = ct;
    this.configPaths = [];
  }

  /**
   * Read configuration from the .codetender file from the root folder of the template.
   */
  public async readTemplateConfig() {
    this.ct.logger.verboseLog('Looking for .codetender config...');

    await this.readConfig(path.join(this.ct.state.source.sourcePath, '.codetender'));
  }

  /**
   * Read configuration from the file specified in the config.
   */
  public async readFileConfig() {
    if (this.ct.config.file) {
      this.ct.logger.verboseLog(`Checking for specified config file: ${this.ct.config.file}...`);
      await this.readConfig(this.ct.config.file, true);
    }
  }

  /**
   * Read configuration from the file specified.
   */
  public async readConfig(file: string, checkFile: boolean = false) {
    const exists = await FileHandler.exists(file);

    if (!exists) {
      if (checkFile) {
        this.ct.logger.log(`File not found: ${file}`);
      } else {
        this.ct.logger.verboseLog(`File not found: ${file}`);
      }
      return;
    }

    const data = await fs.promises.readFile(file, { encoding: 'utf-8' });

    this.configPaths.push(file);
    const fileConfig = JSON.parse(data);

    if (fileConfig.remote && fileConfig.remote.find((r: RemoteTemplateConfig) => r.dest !== '/' && r.dest.match(/[\\/]/g))) {
      throw new Error('Configuration Error: Remote destinations must be one level down from the root.');
    }

    // Check config version
    if (fileConfig.version) {
      const fileVersion = semver.coerce(fileConfig.version);
      const codeVersion = semver.parse(this.ct.state.config.schemaVersion);

      if (codeVersion?.major !== fileVersion?.major) {
        throw new Error('This version of codetender requires configuration schema version ' + codeVersion?.version + '.');
      } else if (semver.gt(fileVersion!, codeVersion!)) {
        this.ct.logger.log(
          'Warning: This template requires a newer version of the codetender configuration schema (' +
            fileConfig.version +
            '). Some features may not be supported.',
        );
      } else if (semver.lt(fileVersion!, codeVersion!)) {
        this.ct.logger.log(
          'Warning: This template specifies an older version of the codetender configuration schema (' +
            fileConfig.version +
            '). Some features may not be supported.',
        );
      }

      this.ct.logger.verboseLog('File version: ' + fileVersion);
      this.ct.logger.verboseLog('Code version: ' + codeVersion);
    } else {
      this.ct.logger.log('Warning: no version specified in ' + file);
    }

    // Merge variables
    if (fileConfig.variables) {
      this.ct.state.process.variables.push(...fileConfig.variables);
    }

    // Merge tokens
    if (fileConfig.tokens) {
      fileConfig.tokens.forEach((fileToken: Token) => {
        const token = this.ct.state.process.tokens.find((t) => t.pattern === fileToken.pattern);
        if (token) {
          Object.assign(token, fileToken);
        } else {
          this.ct.state.process.tokens.push(fileToken);
        }
      });
    }

    // Merge scripts
    if (fileConfig.scripts) {
      if (fileConfig.scripts.before) {
        if (typeof fileConfig.scripts.before === 'string') {
          this.ct.state.process.scripts.before.push(fileConfig.scripts.before);
        } else {
          this.ct.state.process.scripts.before.push(...fileConfig.scripts.before);
        }
      }

      if (fileConfig.scripts.after) {
        if (typeof fileConfig.scripts.after === 'string') {
          this.ct.state.process.scripts.after.push(fileConfig.scripts.after);
        } else {
          this.ct.state.process.scripts.after.push(...fileConfig.scripts.after);
        }
      }
    }

    // Append remote
    if (fileConfig.remote) {
      this.ct.state.source.remote.push(...fileConfig.remote);
    }

    // Append noReplace
    if (fileConfig.noReplace) {
      this.ct.state.process.noReplace.push(...fileConfig.noReplace);
    }

    // Append ignore
    if (fileConfig.ignore) {
      this.ct.state.process.ignore.push(...fileConfig.ignore);
    }

    // Append delete
    if (fileConfig.delete) {
      this.ct.state.process.delete.push(...fileConfig.delete);
    }

    // Append banner
    if (fileConfig.banner) {
      if (typeof fileConfig.banner === 'string') {
        this.ct.state.process.banner.push(fileConfig.banner);
      } else {
        this.ct.state.process.banner.push(...fileConfig.banner);
      }
    }
  }
}
