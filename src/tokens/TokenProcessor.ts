import { glob } from 'glob';
import path from 'path';
import fs from 'graceful-fs';
import { TokenMapItem } from './TokenMapItem';
import { CodeTender } from '../CodeTender';
import { FileHandler } from '../io/FileHandler';

export class TokenProcessor {
  private ct: CodeTender;

  public constructor(ct: CodeTender) {
    this.ct = ct;
  }

  // Convert tokens to regular expressions and create arrays for external calls
  async prepTokens() {
    this.ct.logger.verboseLog('Prepping tokens...');

    const tokens = this.ct.state.process.tokens;

    tokens.forEach((token) => {
      const mapItem = {
        pattern: TokenProcessor.convertToken(token.pattern),
        originalPattern: token.pattern,
        replacement: token.replacement,
        overwrite: token.overwrite,
        renamed: [],
        files: [],
        count: 0,
      } as TokenMapItem;
      this.replaceVariables(mapItem);
      this.ct.state.process.tokenMap[mapItem.pattern.toString()] = mapItem;
    });
  }

  public async prepNoReplace() {
    if ((this.ct.state.process.noReplace.length) < 1) {
      this.ct.logger.verboseLog('No globs specified to skip token replacement.');
    } else {
      this.ct.logger.verboseLog('Processing globs specified to skip token replacement...');

      for await (const pattern of this.ct.state.process.noReplace!) {
        this.ct.logger.verboseLog('  Checking pattern ' + pattern);

        const matches = await glob(pattern, { cwd: this.ct.state.process.processPath });
        if (matches) {
          matches.forEach((match) => {
            const skipPath = path.resolve(this.ct.state.process.processPath, match);
            this.ct.state.output.notReplacedFiles[skipPath] = true;
            this.ct.logger.verboseLog('  Match (' + pattern + ')...Skip path: ' + skipPath);
          });
        }
      }
    }
  }

  // Rename files and folders
  public async renameAllFiles() {
    this.ct.logger.log('');
    this.ct.logger.log('Renaming files and replacing tokens where found...');
    await this.processFolder(this.ct.state.process.processPath);
  }

  /**
   * Find process all child folders then rename items in this folder.
   * @param {string} folder Folder to rename files in
   */
  public async processFolder(folder: string) {
    this.ct.logger.verboseLog(`Processing folder: ${folder}`);
    const contents = await fs.promises.readdir(folder);

    await this.processChildFolders(folder, contents);
    await this.renameItems(folder, contents);
  }

  // Queue a check for every item in the folder to see if it is
  // a sub folder.
  public async processChildFolders(folder: string, contents: string[]) {
    for await (const item of contents) {
      const itemPath = path.join(folder, item);
      await this.processItem(itemPath);
    }
  }

  // Check an item to determine if it is a folder. If it is a folder,
  // process it. Otherwise ignore.
  public async processItem(itemPath: string) {
    if (this.ct.state.output.notReplacedFiles[itemPath]) {
      this.ct.logger.verboseLog('Skipping item marked for noReplace: ' + itemPath);
      return;
    }

    if (await FileHandler.dirExists(itemPath)) {
      return this.processFolder(itemPath);
    }

    this.ct.logger.verboseLog('Replacing tokens in: ' + itemPath);

    const keys = Object.keys(this.ct.state.process.tokenMap);

    for await (const key of keys) {
      const token = this.ct.state.process.tokenMap[key];

      try {
        const results = await FileHandler.replaceInFile({
          files: itemPath,
          from: token.pattern!,
          to: token.replacement,
          countMatches: true,
        });

        results.forEach((result) => {
          if (result.hasChanged) {
            token.count += result.numReplacements!;
            token.files.push({
              file: itemPath,
              count: result.numReplacements!,
            });
          }
        });
      } catch (error) {
        //TODO: Handle these errors
        this.ct.logger.verboseLog(`Error replacing tokens: ${error}`);
      }
    }
  }

  // Rename all items in the specified folder
  async renameItems(folder: string, contents: string[]) {
    // Don't replace anything in the noReplaced folders
    if (this.ct.state.output.notReplacedFiles[folder]) {
      this.ct.logger.verboseLog('Skipping folder tagged as noReplace: ' + folder);
      return;
    }

    for await (const item of contents) {
      await this.rename(folder, item);
    }
  }

  // Rename an item in the specified folder
  async rename(folder: string, item: string) {
    const oldFile = path.join(folder, item);
    const oldItem = item;
    let newItem = item;
    const tokens: Array<TokenMapItem> = [];

    if (this.ct.state.output.notReplacedFiles[oldFile]) {
      this.ct.logger.verboseLog('Skipping file marked noReplace: ' + oldFile);
      return;
    }

    Object.keys(this.ct.state.process.tokenMap).forEach((key) => {
      const token = this.ct.state.process.tokenMap[key];
      if (newItem.match(token.pattern!)) {
        newItem = newItem.replace(token.pattern!, token.replacement);
        tokens.push(token);
      }
    });

    if (newItem === oldItem) {
      return;
    }

    const newFile = path.join(folder, newItem);

    tokens.forEach((t) => {
      t.renamed.push({
        old: oldItem,
        new: newItem,
      });
    });

    // Handle conflicts
    if (await FileHandler.exists(newFile)) {
      this.ct.logger.verboseLog(`Rename Conflict: ${oldItem} -> ${newItem} in folder ${folder}`);

      // If token is flagged as overwrite, delete and rename. Otherwise skip.
      if (tokens.find((t) => t.overwrite)) {
        this.ct.logger.verboseLog('  Deleting ' + oldItem + ' and replacing with ' + newItem);
        await fs.promises.unlink(newFile);
        await fs.promises.rename(oldFile, newFile);
        return;
      }

      this.ct.logger.verboseLog('  Skipping rename of ' + oldItem + ' to ' + newItem + ' in folder ' + folder);
      this.ct.state.output.errors.push({
        type: 'Rename Conflict',
        folder,
        old: oldItem,
        new: newItem,
      });

      return;
    }

    this.ct.logger.verboseLog('Renaming file ' + oldFile + ' to ' + newFile);

    await fs.promises.rename(oldFile, newFile);
  }

  replaceVariables(mapItem: TokenMapItem) {
    this.ct.state.process.variables.forEach((variable) => {
      mapItem.replacement = this.replaceVariable(mapItem.replacement, variable.name, variable.value);
    });
  }

  replaceVariable(text: string, name: string, value: string) {
    const regex = new RegExp(`\\$${name}`, 'g');
    this.ct.logger.verboseLog(`Looking for variable ${name} in ${text}...`); // + ':' + text.match(regex));

    return text.replace(regex, value);
  }

  // Convert token string to RegExp
  static convertToken(item: string | RegExp) {
    if (typeof item === 'string') {
      return TokenProcessor.convertStringToToken(item);
    }

    return item;
  }

  // Convert a string to replace to a regex
  static convertStringToToken(tokenString: string) {
    return new RegExp(tokenString.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
  }
}
