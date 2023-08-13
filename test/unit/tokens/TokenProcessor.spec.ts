import { CodeTender, FileHandler, TokenProcessor } from '../../../src/index';
import fs from 'fs';
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

    it('should cancel if no noReplace', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
        
        verbose: true,
      });

      ct.state.process.noReplace = [];

      const tokenProcessor = new TokenProcessor(ct);

      await tokenProcessor.prepNoReplace();

      expect(ct.logger.logOutput).toEqual(['No globs specified to skip token replacement.']);
    });
  });

  describe('rnameAllFiles()', () => {
    it('should call processFolder', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });
      ct.state.process.processPath = '/process'

      const tokenProcessor = new TokenProcessor(ct);

      const mockProcessFolder = jest.spyOn(tokenProcessor, 'processFolder');

      mockProcessFolder.mockResolvedValueOnce(undefined);

      await tokenProcessor.renameAllFiles();

      expect(mockProcessFolder).toHaveBeenCalledWith('/process');
    });
  });

  describe('processFolder()', () => {
    it('should call processChildFolders and processItem', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });
      ct.state.process.processPath = '/process';

      const mockReaddir = jest.fn();
      jest.spyOn(fs.promises, 'readdir').mockImplementationOnce(mockReaddir);
      mockReaddir.mockResolvedValue(['bar']);
      
      const tokenProcessor = new TokenProcessor(ct);

      const mockProcessChildFolders = jest.spyOn(tokenProcessor, 'processChildFolders').mockResolvedValue(undefined);
      const mockRenameItems = jest.spyOn(tokenProcessor, 'renameItems').mockResolvedValue(undefined);

      await tokenProcessor.processFolder('foo');
      
      expect(mockProcessChildFolders).toHaveBeenCalledWith('foo', ['bar']);
      expect(mockRenameItems).toHaveBeenCalledWith('foo', ['bar']);
    });
  });

  describe('processChildFolders()', () => {
    it('should call processItem', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });

      const tokenProcessor = new TokenProcessor(ct);
      
      const mockProcessItem = jest.spyOn(tokenProcessor, 'processItem').mockResolvedValue(undefined);
      
      await tokenProcessor.processChildFolders('/foo', ['bar']);

      expect(mockProcessItem).toHaveBeenCalledWith('/foo/bar')
    });
  });

  describe('processItem()', () => {
    it('should skip noReplace files', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
        verbose: true,
      });

      ct.state.output.notReplacedFiles['foo'] = true;

      const tokenProcessor = new TokenProcessor(ct);

      await tokenProcessor.processItem('foo');

      expect(ct.logger.logOutput).toEqual(['Skipping item marked for noReplace: foo']);
    });

    it('should call processFolder for folders', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
        verbose: true,
      });

      const tokenProcessor = new TokenProcessor(ct);

      jest.spyOn(FileHandler, 'dirExists').mockResolvedValueOnce(true);

      const mockProcessFolder = jest.spyOn(tokenProcessor, 'processFolder').mockResolvedValue(undefined);

      await tokenProcessor.processItem('foo');

      expect(mockProcessFolder).toHaveBeenCalledWith('foo');
    });

    it('should call replaceInFile for each file', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        tokens: [
          {
            pattern: 'foo',
            replacement: 'bar',
          },
          {
            pattern: 'FOO',
            replacement: 'BAR',
          }
        ],
        logger: jest.fn(),
      });

      const tokenProcessor = new TokenProcessor(ct);
      
      await tokenProcessor.prepTokens();

      const mockReplaceInFile = jest.spyOn(FileHandler, 'replaceInFile')
      .mockResolvedValueOnce([{
        file: 'foo',
        hasChanged: true,
        numMatches: 1,
        numReplacements: 1,
      }])
      .mockResolvedValueOnce([{
        file: 'FOO',
        hasChanged: true,
        numMatches: 1,
        numReplacements: 1,
      }]);

      await tokenProcessor.processItem('/foo');

      expect(mockReplaceInFile).toHaveBeenCalledWith({
        files: '/foo',
        from: /foo/g,
        to: 'bar',
        countMatches: true,
      });

      expect(ct.state.process.tokenMap).toEqual({
        '/foo/g': {
          count: 1,
          files: [{
            file: '/foo',
            count: 1,
          }],
          originalPattern: 'foo',
          pattern: /foo/g,
          renamed: [],
          replacement: 'bar',
          overwrite: undefined,
        },
        '/FOO/g': {
          count: 1,
          files: [{
            file: '/foo',
            count: 1,
          }],
          originalPattern: 'FOO',
          pattern: /FOO/g,
          renamed: [],
          replacement: 'BAR',
          overwrite: undefined,
        },
      });
    });

    it('should catch and log errors', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        tokens: [
          {
            pattern: 'foo',
            replacement: 'bar',
          },
        ],
        logger: jest.fn(),
        verbose: true,
      });

      const tokenProcessor = new TokenProcessor(ct);
      
      await tokenProcessor.prepTokens();

      jest.spyOn(FileHandler, 'replaceInFile')
      .mockRejectedValueOnce(new Error('foo'));

      await tokenProcessor.processItem('/foo');

      expect(ct.logger.logOutput).toEqual([
        'Prepping tokens...',
        'Looking for variable CODETENDER_ROOT in bar...',
        'Replacing tokens in: /foo',
        'Error replacing tokens: Error: foo',
      ]);
    });
  });

  describe('renameItems()', () => {
    it('should do nothing if folder is matchees noReplace', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
        verbose: true,
      });

      ct.state.output.notReplacedFiles['/foo'] = true;

      const tokenProcessor = new TokenProcessor(ct);

      const mockRename = jest.spyOn(tokenProcessor, 'rename');

      await tokenProcessor.renameItems('/foo', ['bar']);

      expect(ct.logger.logOutput).toEqual(['Skipping folder tagged as noReplace: /foo']);

      expect(mockRename).not.toHaveBeenCalled();
    });

    it('should call rename for each item in contents', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
        verbose: true,
      });

      const tokenProcessor = new TokenProcessor(ct);

      const mockRename = jest.spyOn(tokenProcessor, 'rename')
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      await tokenProcessor.renameItems('/foo', ['bar', 'baz']);

      expect(mockRename).toHaveBeenCalledWith('/foo', 'bar');
      expect(mockRename).toHaveBeenCalledWith('/foo', 'baz');
    });
  });

  describe('rename()', () => {
    it('should do nothing if file matches noReplace', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
        verbose: true,
      });

      const tokenProcessor = new TokenProcessor(ct);

      ct.state.output.notReplacedFiles['/foo/bar'] = true;

      await tokenProcessor.rename('/foo', 'bar');

      expect(ct.logger.logOutput).toEqual(['Skipping file marked noReplace: /foo/bar']);
    });

    it('should do nothing if file is unchanged', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
        verbose: true,
      });

      const tokenProcessor = new TokenProcessor(ct);

      const mockRename = jest.spyOn(fs.promises, 'rename');

      await tokenProcessor.rename('/foo', 'bar');

      expect(mockRename).not.toHaveBeenCalled();
    });

    it('should handle conflicts', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
        verbose: true,
      });

      jest.spyOn(fs.promises, 'rename').mockResolvedValueOnce(undefined);

      ct.state.process.tokenMap = {
        '/foo/g': {
          count: 1,
          files: [{
            file: '/foo',
            count: 1,
          }],
          originalPattern: 'foo',
          pattern: /foo/g,
          renamed: [],
          replacement: 'bar',
          overwrite: false,
        }
      };

      const tokenProcessor = new TokenProcessor(ct);

      jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(true);

      const mockRename = jest.spyOn(fs.promises, 'rename').mockResolvedValue(undefined);

      await tokenProcessor.rename('/foo', 'foo');

      expect(ct.logger.logOutput).toEqual([
        'Rename Conflict: foo -> bar in folder /foo',
        '  Skipping rename of foo to bar in folder /foo',
      ]);
    });

    it('should overwrite conflicts if overwrite is true', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
        verbose: true,
      });

      jest.spyOn(fs.promises, 'rename').mockResolvedValueOnce(undefined);

      ct.state.process.tokenMap = {
        '/foo/g': {
          count: 1,
          files: [{
            file: '/foo',
            count: 1,
          }],
          originalPattern: 'foo',
          pattern: /foo/g,
          renamed: [],
          replacement: 'bar',
          overwrite: true,
        }
      };

      const tokenProcessor = new TokenProcessor(ct);

      jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(true);

      const mockRename = jest.spyOn(fs.promises, 'rename').mockResolvedValue(undefined);
      const mockUnlink = jest.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);

      await tokenProcessor.rename('/foo', 'foo');

      expect(ct.logger.logOutput).toEqual([
        'Rename Conflict: foo -> bar in folder /foo',
        '  Deleting foo and replacing with bar',
      ]);
    });

    it('should call replace for each item', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
        verbose: true,
      });

      jest.spyOn(fs.promises, 'rename').mockResolvedValueOnce(undefined);

      ct.state.process.tokenMap = {
        '/foo/g': {
          count: 1,
          files: [{
            file: '/foo',
            count: 1,
          }],
          originalPattern: 'foo',
          pattern: /foo/g,
          renamed: [],
          replacement: 'bar',
          overwrite: undefined,
        }
      };

      const tokenProcessor = new TokenProcessor(ct);

      jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(false);

      const mockRename = jest.spyOn(fs.promises, 'rename').mockResolvedValue(undefined);

      await tokenProcessor.rename('/foo', 'foo');

      expect(ct.logger.logOutput).toEqual([
        'Renaming file /foo/foo to /foo/bar',
      ]);

      expect(mockRename).toHaveBeenCalledWith('/foo/foo', '/foo/bar');
    });
  });

  describe('replaceVariables()', () => {
    it('should call replaceVariable for each variable', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });

      ct.state.process.variables = [{
        name: 'VARIABLE',
        value: 'bar',
      }];

      const tokenProcessor = new TokenProcessor(ct);

      const mapItem = {
        originalPattern: 'foo',
        pattern: /foo/g,
        replacement: '$VARIABLE',
        count: 1,
        files: [{
          file: '/foo',
          count: 1,
        }],
        renamed: [],
        overwrite: true,
      };

      tokenProcessor.replaceVariables(mapItem);

      expect(mapItem.replacement).toEqual('bar');
    });
  });

  describe('replaceVariable()', () => {
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

  describe('convertToken', () => {
    it('should convert string to RegExp', () => {
      const result = TokenProcessor.convertToken('foo');

      expect(result).toEqual(/foo/g);
    });

    it('should return RegExp unchanged', () => {
      const result = TokenProcessor.convertToken(/foo/g);

      expect(result).toEqual(/foo/g);
    });
  });

  describe('convertStringToToken', () => {
    it('should convert string to Regexp and escape special characters', () => {
      const result = TokenProcessor.convertStringToToken('foo-/\\^$*+?.()|[\]{}');
      expect(result).toEqual(/foo\-\/\\\^\$\*\+\?\.\(\)\|\[\]\{\}/g);
    });
  });
});