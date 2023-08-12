import { CodeTender, TokenProcessor } from '../../../src/index';
import * as glob from 'glob';
import path from 'path';

describe('TokenProcessor', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });


  describe('prepTokens()', () => {
    it('should convert tokens', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        tokens: [{ pattern: 'foo', replacement: 'bar', }],
        logger: jest.fn(),
      });

      const tokenProcessor = new TokenProcessor(ct);

      await tokenProcessor.prepTokens();

      expect(ct.state.process.tokenMap).toEqual({
        '/foo/g': {
          count: 0,
          files: [],
          originalPattern: 'foo',
          pattern: /foo/g,
          renamed: [],
          replacement: 'bar',
        },
      });
    });

    it('should replace variables', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        tokens: [{ pattern: 'foo', replacement: '$REPLACE_ME', }],
        variables: [{ name: 'REPLACE_ME', value: 'variable' }],
        logger: jest.fn(),
      });

      const tokenProcessor = new TokenProcessor(ct);

      await tokenProcessor.prepTokens();

      expect(ct.state.process.tokenMap).toEqual({
        '/foo/g': {
          count: 0,
          files: [],
          originalPattern: 'foo',
          pattern: /foo/g,
          renamed: [],
          replacement: 'variable',
        },
      });
    });
  });

  describe('prepNoReplace()', () => {
    it ('should build a map of files to not replace', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        noReplace: ['foo'],
        logger: jest.fn(),
        verbose: true,
      });

      const mockGlob = jest.spyOn(glob, 'glob');
      mockGlob.mockResolvedValueOnce([
        '/path/.git',
      ]);
      mockGlob.mockResolvedValueOnce([
        '/path/foo',
      ]);

      const tokenProcessor = new TokenProcessor(ct);

      await tokenProcessor.prepNoReplace();

      expect(ct.state.output.notReplacedFiles).toEqual({
        '/path/.git': true,
        '/path/foo': true,
      });
    });
  });

  describe('replaceVariable', () => {
    it('should replace variable', () => {
      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });

      const tokenProcessor = new TokenProcessor(ct);

      const result = tokenProcessor.replaceVariable('Some $VARIABLE text', 'VARIABLE', 'replaced');

      expect(result).toEqual('Some replaced text');
    });
  });
});