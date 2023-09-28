import readline from 'readline';
import { CodeTender, InputHandler, Token } from '../../../src/index';
import { testReaderFactory } from '../../Util';

describe('InputHandler', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor()', () => {
    it('should use readline as the default readerFactory', async () => {
      const mockCreateInterface = jest.fn();
      jest.spyOn(readline, 'createInterface').mockImplementation(mockCreateInterface);
      mockCreateInterface.mockReturnValue({
        question: (_prompt: string, callback: (answer: string) => void) => {
          callback('bar');
        }
      });

      const ct = new CodeTender({
        folder: 'foo',
      });

      const inputHandler = new InputHandler(ct);

      await inputHandler.ask('foo');

      expect(mockCreateInterface).toHaveBeenCalled();
    });
  });

  describe('getTokens()', () => {
    it('should call getTokensFromCommandLine if no tkens in state', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        verbose: true,
        logger: jest.fn(),
      });

      const inputHandler = new InputHandler(ct);

      const mockGetTokensFromCommandLine = jest.spyOn(inputHandler, 'getTokensFromCommandLine');
      mockGetTokensFromCommandLine.mockResolvedValue(true);

      await inputHandler.getTokens();

      expect(mockGetTokensFromCommandLine).toHaveBeenCalled();
    });

    it('should call getTokensFromPrompts if tokens exist without replacement', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        tokens: [{ pattern: 'foo', prompt: 'What is foo?' }],
        verbose: true,
        logger: jest.fn(),
      });

      const inputHandler = new InputHandler(ct);

      const mockGetTokensFromPrompts = jest.spyOn(inputHandler, 'getTokensFromPrompts');
      mockGetTokensFromPrompts.mockResolvedValue(true);

      await inputHandler.getTokens();

      expect(mockGetTokensFromPrompts).toHaveBeenCalled();
    });

    it('should exit if all tokens have replacements', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        tokens: [{ pattern: 'foo', replacement: 'bar' }],
        verbose: true,
        logger: jest.fn(),
      });

      const inputHandler = new InputHandler(ct);

      await inputHandler.getTokens();

      expect(ct.logger.logOutput).toEqual(['All token replacements already provided.']);
    });
  });

  describe('getTokensFromCommandLine()', () => {
    it('should call convertStringToToken', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        verbose: true,
        logger: jest.fn(),
      });

      const inputHandler = new InputHandler(ct);

      const mockAsk = jest.spyOn(inputHandler, 'ask');
      mockAsk.mockResolvedValueOnce('foo');
      mockAsk.mockResolvedValueOnce('bar');
      mockAsk.mockResolvedValueOnce('');

      await inputHandler.getTokensFromCommandLine();

      expect(ct.state.process.tokens).toEqual([{ pattern: /foo/g, replacement: 'bar' }]);
    });

    it('should abort on empty replacement', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        verbose: true,
        logger: jest.fn(),
      });

      const inputHandler = new InputHandler(ct);

      const mockAsk = jest.spyOn(inputHandler, 'ask');
      mockAsk.mockResolvedValueOnce('foo');
      mockAsk.mockResolvedValueOnce('');

      await inputHandler.getTokensFromCommandLine();

      expect(ct.state.process.tokens).toEqual([]);
    });
  });

  describe('getTokensFromPrompts()', () => {
    it('should call getTokenFromPrompt', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        tokens: [{ pattern: 'foo', prompt: 'What is foo?' }],
        verbose: true,
        logger: jest.fn(),
      });

      const inputHandler = new InputHandler(ct);

      const mockAsk = jest.spyOn(inputHandler, 'ask');
      mockAsk.mockResolvedValueOnce('bar');

      await inputHandler.getTokensFromPrompts();

      expect(ct.state.process.tokens).toEqual([
        {
          pattern: 'foo',
          prompt: 'What is foo?',
          replacement: 'bar',
        },
      ]);
    });

    it('should call abort on blank value', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        tokens: [{ pattern: 'foo', prompt: 'What is foo?' }],
        verbose: true,
        logger: jest.fn(),
      });

      const inputHandler = new InputHandler(ct);

      const mockAsk = jest.spyOn(inputHandler, 'ask');
      mockAsk.mockResolvedValueOnce('');

      const result = await inputHandler.getTokensFromPrompts();

      expect(ct.state.process.tokens).toEqual([{ pattern: 'foo', prompt: 'What is foo?' }]);

      expect(result).toEqual(false);
    });
  });

  describe('getTokenFromPrompt()', () => {
    it('should call ask and set replacement', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        verbose: true,
        logger: jest.fn(),
      });

      const inputHandler = new InputHandler(ct);
      const token = {
        pattern: 'foo',
        prompt: 'foo',
      } as Token;

      jest.spyOn(inputHandler, 'ask').mockResolvedValueOnce('bar');

      await inputHandler.getTokenFromPrompt(token);

      expect(token.replacement).toEqual('bar');
    });

    it('should use default prompt', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        verbose: true,
        logger: jest.fn(),
      });

      const inputHandler = new InputHandler(ct);
      const token = {
        pattern: 'foo',
      } as Token;

      const mockAsk = jest.spyOn(inputHandler, 'ask').mockResolvedValueOnce('bar');

      await inputHandler.getTokenFromPrompt(token);

      expect(token.replacement).toEqual('bar');

      expect(mockAsk).toHaveBeenCalledWith("    Replace all instances of 'foo' with [abort]:");
    });
  });

  describe('ask()', () => {
    it('should call readerFactory.question()', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        verbose: true,
        logger: jest.fn(),
        readerFactory: testReaderFactory({ foo: 'bar' }),
      });

      const inputHandler = new InputHandler(ct);

      const result = await inputHandler.ask('foo');

      expect(result).toEqual('bar');
    });
  });
});
