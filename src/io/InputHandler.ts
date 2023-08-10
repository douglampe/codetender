import readline from 'readline/promises';
import { CodeTender, IQuestionReader, Token, TokenProcessor } from '../index';

export class InputHandler {
  private ct: CodeTender;
  private readerFactory: () => IQuestionReader;

  constructor(ct: CodeTender) {
    this.ct = ct;
    this.readerFactory =
      ct.config.readerFactory ??
      (() =>
        readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        }));
  }

  /**
   * Read tokens to replace and values from the command line.
   */
  public async getTokens() {
    if (this.ct.state.process.tokens.length === 0) {
      this.ct.logger.verboseLog('Reading tokens from command line...');

      return this.getTokensFromCommandLine();
    }

    if (this.ct.state.process.tokens.find((t) => !t.replacement)) {
      this.ct.logger.verboseLog('Reading token values from command line...');

      return this.getTokensFromPrompts();
    }

    this.ct.logger.verboseLog('All token replacements already provided.');

    return true;
  }

  /**
   * Prompt user to provide tokens and replacement values
   */
  public async getTokensFromCommandLine() {
    this.ct.logger.log('');

    const newFrom = await this.ask('  Token to replace [done]: ');

    if (newFrom !== '') {
      const newToken: Token = {
        pattern: TokenProcessor.convertStringToToken(newFrom),
      };
      this.ct.state.process.tokens.push(newToken);
      const newTo = await this.ask('  Replace with [abort]: ');

      if (newTo === '') {
        return false;
      }

      newToken.replacement = newTo;
      await this.getTokensFromCommandLine();
    } else if (this.ct.state.process.tokens.length > 0) {
      return true;
    } else {
      return false;
    }

    return true;
  }

  /**
   * Read token values based on prompts provided in configuration.
   */
  public async getTokensFromPrompts() {
    this.ct.logger.log('');
    this.ct.logger.log('Enter a blank value at any time to abort.');
    this.ct.logger.log('');

    for await (const token of this.ct.state.process.tokens!) {
      if (token.prompt) {
        await this.getTokenFromPrompt(token);
        if (token.replacement === '') {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Read a the value for a single token from the command line.
   * @param {object} token
   */
  public async getTokenFromPrompt(token: Token) {
    token.replacement = await this.ask('  ' + token.prompt || "  Replace all instances of '' + token.pattern + '' with [abort]:");
  }

  /**
   * Read a single value from the command line
   * @param {string} prompt
   */
  public async ask(prompt: string) {
    const rl = this.readerFactory();

    return rl.question(prompt);
  }
}
