import { CodeTender, ConfigParser, FileHandler } from '../../../src/index';
import fs from 'fs';

describe('ConfigParser', () => {
  describe('readConfig()', () => {
    afterEach(() => {
      jest.resetAllMocks();
    });

    it('should call exists and readFile', async() => {
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/temp');
      const mockEsists = jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(true);
      const mockReadFile = jest.spyOn(fs.promises, 'readFile');

      mockReadFile.mockResolvedValueOnce('{}');

      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });
      const parser = new ConfigParser(ct);

      await parser.readConfig('bar.json');

      expect(mockEsists).toHaveBeenCalledTimes(1);

      expect(mockReadFile).toHaveBeenCalledWith('bar.json', { encoding: 'utf-8'});
    });

    it('should throw error on major version mismatch', async() => {
      jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(true);
      jest.spyOn(fs.promises, 'readFile').mockResolvedValueOnce('{"version": "2.1"}');

      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });
      
      const parser = new ConfigParser(ct);

      await expect(parser.readConfig('bar.json', true)).rejects.toEqual(new Error(`This version of codetender requires configuration schema version ${ct.state.config.schemaVersion}.`));
    });

    it('should log warning on older template version', async() => {
      jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(true);
      jest.spyOn(fs.promises, 'readFile').mockResolvedValueOnce('{"version": "1.0.0"}');

      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });
      const parser = new ConfigParser(ct);

      const mockLog = jest.spyOn(ct.logger, 'log');

      await parser.readConfig('bar.json', true);

      expect(mockLog).toHaveBeenCalledWith('Warning: This template specifies an older version of the codetender configuration schema (1.0.0). Some features may not be supported.');
    });

    it('should log warning on newer template version', async() => {
      jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(true);
      jest.spyOn(fs.promises, 'readFile').mockResolvedValueOnce('{"version": "1.999.0"}');

      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });
      const parser = new ConfigParser(ct);

      const mockLog = jest.spyOn(ct.logger, 'log');

      await parser.readConfig('bar.json', true);

      expect(mockLog).toHaveBeenCalledWith('Warning: This template requires a newer version of the codetender configuration schema (1.999.0). Some features may not be supported.');
    });

    it('should log warning if version missing from config', async() => {
      jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(true);
      jest.spyOn(fs.promises, 'readFile').mockResolvedValueOnce('{}');

      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });
      const parser = new ConfigParser(ct);

      const mockLog = jest.spyOn(ct.logger, 'log');

      await parser.readConfig('bar.json', true);

      expect(mockLog).toHaveBeenCalledWith('Warning: no version specified in bar.json');
    });

    it('should log error if file not found', async() => {
      jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(false);
      const mockReadFile = jest.spyOn(fs.promises, 'readFile');
      mockReadFile.mockRejectedValueOnce('Error');

      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });
      const parser = new ConfigParser(ct);

      const mockLog = jest.spyOn(ct.logger, 'log');

      await parser.readConfig('bar.json', true);

      expect(mockLog).toHaveBeenCalledWith('File not found: bar.json');
    });

    it('should not log error if file not found with checkFile false and verbose is set to false', async() => {
      jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(false);
      const mockReadFile = jest.spyOn(fs.promises, 'readFile');
      mockReadFile.mockRejectedValueOnce('Error');

      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });
      const parser = new ConfigParser(ct);

      await parser.readConfig('bar.json', false);

      expect(ct.logger.logOutput).toEqual([]);
    });

    it('should throw error if remote dest is not valid', async() => {
      jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(true);
      jest.spyOn(fs.promises, 'readFile').mockResolvedValueOnce('{"remote": [{"src": "foo","dest": "/bar/baz","tokens":[]}]}');

      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });
      const parser = new ConfigParser(ct);

      await expect(parser.readConfig('bar.json', true)).rejects.toEqual(new Error('Configuration Error: Remote destinations must be one level down from the root.'));
    });
    
    it('should parse variables', async() => {
      jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(true);
      jest.spyOn(fs.promises, 'readFile').mockResolvedValueOnce('{ "variables": [{"name": "TEST", "value": "foo"}]}');

      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });
      const parser = new ConfigParser(ct);

      await parser.readConfig('bar.json');

      expect(ct.state.process.variables).toEqual([
        {name: 'CODETENDER_ROOT', value: 'foo'},
        {name: 'TEST', value: 'foo'}]);
    });
    
    it('should parse tokens and merge values', async() => {
      jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(true);
      jest.spyOn(fs.promises, 'readFile').mockResolvedValueOnce('{ "tokens": [{"pattern": "foo", "prompt": "Replace with"}, {"pattern": "baz", "replacement": "BAZ"}]}');

      const ct = new CodeTender({
        folder: 'foo',
        tokens: [{
          pattern: 'foo',
          prompt: 'Replace this',
        }],
        logger: jest.fn(),
      });
      const parser = new ConfigParser(ct);

      await parser.readConfig('bar.json');

      expect(ct.state.process.tokens).toEqual([{pattern: 'foo', prompt: 'Replace with'}, {pattern: 'baz', replacement: 'BAZ'}]);
    });
    
    it('should parse scripts', async() => {
      jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(true);
      jest.spyOn(fs.promises, 'readFile').mockResolvedValueOnce('{ "scripts": {"before": "before.js", "after": "after.js"}}');

      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });
      const parser = new ConfigParser(ct);

      await parser.readConfig('bar.json');

      expect(ct.state.process.scripts).toEqual({before: 'before.js', after: 'after.js'});
    });
    
    it('should parse remote', async() => {
      jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(true);
      jest.spyOn(fs.promises, 'readFile').mockResolvedValueOnce('{ "remote": [{"src": "foo", "dest": "/", "tokens": [{ "pattern": "one", "replacement": "two"}]}]}');

      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });
      const parser = new ConfigParser(ct);

      await parser.readConfig('bar.json');

      expect(ct.state.source.remote).toEqual([{
        src: 'foo', 
        dest: '/',
        tokens: [{
          pattern: 'one',
          replacement: 'two',
        }],
      }]);
    });
    
    it('should parse noReplace', async() => {
      jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(true);
      jest.spyOn(fs.promises, 'readFile').mockResolvedValueOnce('{ "noReplace": ["no-replace.js"]}');

      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });
      const parser = new ConfigParser(ct);

      await parser.readConfig('bar.json');

      expect(ct.state.process.noReplace).toEqual([
        '**/.git/',
        '.codetender',
        'no-replace.js']);
    });
    
    it('should parse ignore', async() => {
      jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(true);
      jest.spyOn(fs.promises, 'readFile').mockResolvedValueOnce('{ "ignore": ["ignored.js"]}');

      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });
      const parser = new ConfigParser(ct);

      await parser.readConfig('bar.json');

      expect(ct.state.process.ignore).toEqual([
        '**/.git/',
        '.codetender',
        'ignored.js'
      ]);
    });
    
    it('should parse delete', async() => {
      jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(true);
      const mockReadFile = jest.spyOn(fs.promises, 'readFile');
      mockReadFile.mockResolvedValueOnce('{ "delete": ["delete.js"]}');

      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });
      const parser = new ConfigParser(ct);

      await parser.readConfig('bar.json');

      expect(ct.state.process.delete).toEqual([
        'delete.js'
      ]);
    });
    
    it('should parse banner', async() => {
      jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(true);
      jest.spyOn(fs.promises, 'readFile').mockResolvedValueOnce('{ "banner": ["This is a banner"]}');

      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });
      const parser = new ConfigParser(ct);

      await parser.readConfig('bar.json');

      expect(ct.state.process.banner).toEqual([
        'This is a banner'
      ]);
    });
  });

  describe('readTemplateConfig', () => {
    it('should call readfile for ".codetender"', async() => {
      jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(true);
      const mockReadFile = jest.spyOn(fs.promises, 'readFile').mockResolvedValueOnce('{}');

      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });
      const parser = new ConfigParser(ct);

      await parser.readTemplateConfig();

      expect(mockReadFile).toHaveBeenCalledWith('.codetender', { encoding: 'utf-8'});
    });
  });

  describe('readFileConfig', () => {
    it('should call readfile for file specified', async() => {
      jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(true);
      const mockReadFile = jest.spyOn(fs.promises, 'readFile').mockResolvedValueOnce('{}');;

      const ct = new CodeTender({
        folder: 'foo',
        file: 'bar.json',
        logger: jest.fn(),
      });
      const parser = new ConfigParser(ct);

      await parser.readFileConfig();

      expect(mockReadFile).toHaveBeenCalledWith('bar.json', { encoding: 'utf-8'});
    });
  });
});