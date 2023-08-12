import { CodeTender, FileHandler, IQuestionReader } from '../../src/index';
import fs from 'fs';
import cp, { ChildProcess, ExecOptions, ExecException } from 'child_process';
import pkgInfo from '../../package.json';

function testReaderFactory(map: Record<string, string>): () => IQuestionReader {
  return () => {
    return {
      question: async (prompt: string) => {
        if (prompt in map) {
          const response = map[prompt];
          return Promise.resolve(response);
        } else {
          return Promise.reject(`Prompt '${prompt}' not found in map`);
        }
      },
    }
  };
}

describe('CodeTender', () => {  
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor()', () => {
    it('should prepare state with defaults', () => {
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/target');

      const ct = new CodeTender({
        folder: 'folder',
      });

      expect(ct.state).toEqual({
        config: {
          schemaVersion: '1.1.0',
          originalConfig: {
            folder: 'folder',
          },
          configPaths: [],
        },
        source: {
          template: '',
          sourcePath: '',
          isLocalTemplate: false,
          remote: [],
        },
        target: {
          folder: 'folder',
          targetPath: '/target',
        },
        process: {
          banner: [],
          processPath: '',
          tempPath: '',
          tokens: [],
          variables: [
            {
              name: 'CODETENDER_ROOT',
              value: 'folder',
            },
          ],
          ignore: ['**/.git/', '.codetender'],
          noReplace: ['**/.git/', '.codetender'],
          scripts: {},
          delete: [],
          tokenMap: {},
        },
        output: {
          notReplacedFiles: {},
          errors: [],
        },
      });
    });

    it('should prepare state with config values', () => {
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/temp');
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/target');
      const mockLogger = jest.fn();

      const ct = new CodeTender({
        template: 'foo',
        folder: 'folder',
        noReplace: ['do-not-replace'],
        ignore: ['ignore'],
        variables: [{ name: 'foo', value: 'bar'}],
        tokens: [],
        logger: mockLogger,
      });

      expect(ct.state).toEqual({
        config: {
          schemaVersion: '1.1.0',
          originalConfig: {
            template: 'foo',
            folder: 'folder',
            noReplace: ['do-not-replace'],
            ignore: ['ignore'],
            variables: [{ name: 'foo', value: 'bar'}],
            tokens: [],
            logger: mockLogger,
          },
          configPaths: [],
        },
        source: {
          template: 'foo',
          sourcePath: '/temp',
          isLocalTemplate: false,
          remote: [],
        },
        target: {
          folder: 'folder',
          targetPath: '/target',
        },
        process: {
          banner: [],
          processPath: '',
          tempPath: '',
          tokens: [],
          variables: [
            {
              name: 'foo',
              value: 'bar',
            },
            {
              name: 'CODETENDER_ROOT',
              value: 'folder',
            },
          ],
          ignore: ['ignore', '**/.git/', '.codetender'],
          noReplace: ['do-not-replace', '**/.git/', '.codetender'],
          scripts: {},
          delete: [],
          tokenMap: {},
        },
        output: {
          notReplacedFiles: {},
          errors: [],
        },
      });
    });
  });

  describe('copyOrClone()', () => {
    it('should call ensurePathExists and copy if template path exists', async () => {
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/temp');
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/target');
      jest.spyOn(FileHandler, 'dirExists').mockResolvedValue(true);
      jest.spyOn(FileHandler, 'remove').mockResolvedValue(true);
      jest.spyOn(FileHandler, 'ensurePathExists').mockResolvedValue(undefined);
      
      const mockCopy = jest.spyOn(FileHandler, 'copy').mockResolvedValue(undefined);
      
      const ct = new CodeTender({ 
        folder: 'foo', 
        template: 'bar', 
        logger: jest.fn(), 
        verbose: true, 
      });

      ct.state.source.sourcePath = '/temp/folder';

      await ct.copyOrClone();
    
      expect(ct.state.source.isLocalTemplate).toBeTruthy();
      expect(ct.logger.logOutput).toEqual([
        'Copying or cloning template...',
        'Template is local',
        `Copying from local template folder: bar into temporary folder: /temp/folder`,
        '  Creating folder: /temp/folder',
        '  Copying from: bar to: /temp/folder',
      ]);
      expect(mockCopy).toHaveBeenCalledWith('bar', '/temp/folder', false);
    });

    it('should clone if template path does not exist', async () => {
      jest.spyOn(FileHandler, 'dirExists').mockResolvedValue(false);
      const mockLog = jest.fn();
      
      const ct = new CodeTender({ 
        folder: 'foo', 
        template: 'bar', 
        logger: mockLog, 
        verbose: true, 
      });

      ct.state.source.sourcePath = '/temp/folder';
      
      jest.spyOn(ct, 'runChildProcess').mockResolvedValue(undefined);
      
      await ct.copyOrClone();

      expect(ct.logger.logOutput).toEqual([
        'Copying or cloning template...',
        'Template appears to be remote',
        'Added https prefix to template: https://github.com/bar',
        'Added git extension to template: https://github.com/bar.git',
        'Cloning from repo: https://github.com/bar.git into temporary folder: /temp/folder',
      ]);
    });
  });

  describe('cloneRemoteTemplates()', () => {
    it('should throw error if more than one remote root is set', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        remote: [
          { src: 'foo', dest:'/', tokens: [] },
          { src: 'bar', dest:'/', tokens: [] },
        ],
        logger: jest.fn(),
      });

      await expect(ct.cloneRemoteTemplates()).rejects.toEqual(new Error('More than one remote root template was specified. Aborting.'));
    });

    it('should call gitClone for each remote and return true', async() => {
      const ct = new CodeTender({
        folder: 'foo',
        remote: [
          { src: 'foo', dest:'/', tokens: [] },
          { src: 'bar', dest:'/bar', tokens: [] },
        ],
        logger: jest.fn(),
      });
      const mockClone = jest.spyOn(ct, 'gitClone').mockResolvedValue(undefined);
      ct.state.process.processPath = '/process';
      ct.state.source.sourcePath = '/source'

      const result = await ct.cloneRemoteTemplates();

      expect(mockClone).toHaveBeenCalledWith('foo', '/process/__CT_REMOTE_ROOT__');
      expect(mockClone).toHaveBeenCalledWith('bar', '/source/bar');

      expect(result).toBeTruthy();
    });

    it('should log and return false if no remotes found', async() => {
      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
        verbose: true,
      });
      const mockClone = jest.spyOn(ct, 'gitClone').mockResolvedValue(undefined);

      const result = await ct.cloneRemoteTemplates();

      expect(ct.logger.logOutput).toEqual(['No remote templates found.']);

      expect(result).toBeFalsy();
    });
  });

  describe('gitClone', () => {
    it('should call runChildProcess', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
        verbose: true,
      });

      const mockRunChildProcess = jest.spyOn(ct, 'runChildProcess').mockResolvedValueOnce(undefined);

      await ct.gitClone('foo', 'bar');

      expect(mockRunChildProcess).toHaveBeenCalledWith('git clone foo bar', '.');
    });
  });

  describe('runChildProcess()', () => {
    it('should call exec', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
        verbose: true,
      });

      const mockExec = jest.fn();
      jest.spyOn(cp, 'exec')
      .mockImplementation(function(
        this: ChildProcess,
        command: string,
        options: any,
        callback?: (error: ExecException | null, stdout: string, stderr: string) => void
      ): ChildProcess {
        mockExec(command);
        if (callback) {
          callback(null, '', '');
        }
        return this;
      });

      await ct.runChildProcess('foo', '.');
    });

    it('should call exec and handle error', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
        verbose: true,
      });

      const mockExec = jest.fn();
      jest.spyOn(cp, 'exec')
      .mockImplementation(function(
        this: ChildProcess,
        command: string,
        options: any,
        callback?: (error: ExecException | null, stdout: string, stderr: string) => void
      ): ChildProcess {
        mockExec(command);
        if (callback) {
          callback(new Error('foo'), '', '');
        }
        return this;
      });

      await expect(ct.runChildProcess('foo', '.')).rejects.toEqual(new Error('foo'));
    });
  });

  describe('getVersion()', () => {
    it('should return the package version', async () => {
      
      expect(CodeTender.getVersion()).toEqual(pkgInfo.version);
    });
  });

  describe('replace()', () => {
    it('should throw error if folder does not exist', async () => {
      const mockLogger = jest.fn();
      jest.spyOn(FileHandler, 'dirExists').mockResolvedValueOnce(false);
      
      const ct = new CodeTender({
        folder: 'foo',
        logger: mockLogger,
      });

      await expect(ct.replace()).rejects.toEqual(new Error('Folder foo does not exist.'));
    });

    it('should catch, log, and rethrow errors', async () => {
      jest.spyOn(FileHandler, 'dirExists').mockResolvedValueOnce(true);
      
      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });
      jest.spyOn(ct.logger, 'splash').mockImplementationOnce(() => { throw new Error('Forced error'); });

      await expect(ct.replace()).rejects.toBeTruthy();

      expect(ct.logger.logOutput).toEqual([
        '                          __',
      '  ____  ____  ____  _____/ /',
      ' / __ \\/ __ \\/ __ \\/ ___/ /',
      '/ /_/ / /_/ / /_/ (__  )_/',
      '\\____/\\____/ .___/____(_)',
      '          /_/ ',
      'Forced error',
      ]);
    });

    it('should abort if requested by empty input', async () => {
      // Always succeed when making sure path exists:
      jest.spyOn(FileHandler, 'ensurePathExists').mockResolvedValue(undefined);
      // Always succeed when copying files:
      jest.spyOn(FileHandler, 'copy').mockResolvedValue(undefined);
      // Always succeed when removing files:
      jest.spyOn(FileHandler, 'remove').mockResolvedValue(true);

      const mockResolve = jest.spyOn(FileHandler, 'resolve');
      const mockDirExists = jest.spyOn(FileHandler, 'dirExists')
      const mockMkdtemp = jest.spyOn(fs.promises, 'mkdtemp')
      const mockReadFile = jest.spyOn(fs.promises, 'readFile')
      const mockExists = jest.spyOn(FileHandler, 'exists');

      // Resolve temp path
      mockResolve.mockReturnValueOnce('/temp');

      // Resolve target path
      mockResolve.mockReturnValueOnce('/target/foo');

      // Return true for check if target folder exists:
      mockDirExists.mockResolvedValueOnce(true);

      // Set temp folder to /temp:
      mockMkdtemp.mockResolvedValueOnce('/temp');
      
      // Return true for check if local template exists:
      mockDirExists.mockResolvedValueOnce(true);

      // Return true for check if config file exists:
      mockExists.mockResolvedValueOnce(true);
      
      // Return contents of .codetender:
      mockReadFile.mockResolvedValueOnce('{ "version": "1.1" }');

      // Return true for check if temp folder exists:
      mockDirExists.mockResolvedValueOnce(true);
      
      const ct = new CodeTender({ 
        folder: 'foo', 
        template: 'bar',
        ignore: ['ignored*'],
        noReplace: ['noReplace*'],
        verbose: true,
        logger: jest.fn(),
        readerFactory: testReaderFactory({'  Token to replace [done]: ': ''}),
      });

      // Always succeed when running child process:
      jest.spyOn(ct, 'runChildProcess').mockResolvedValue(undefined);

      await ct.replace();

      expect(ct.state.source.sourcePath).toEqual('/temp');

      expect(ct.logger.logOutput).toEqual([
        '',
        '  _____        __    __              __       ',
        ' / ___/__  ___/ /__ / /____ ___  ___/ /__ ____',
        '/ /__/ _ \\/ _  / -_) __/ -_) _ \\/ _  / -_) __/',
        '\\___/\\___/\\_,_/\\__/\\__/\\__/_//_/\\_,_/\\__/_/   ',
        'Replacing in place...',
        'Reading tokens from command line...',
        '',
        'Abort requested. Exiting...',
      ]);
    });
  });

  describe('new()', () => {
    it('should throw error if destination folder already exists', async () => {
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/temp');
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/target');
      const mockLogger = jest.fn();
      jest.spyOn(FileHandler, 'dirExists').mockResolvedValueOnce(true);

      const ct = new CodeTender({
        folder: 'foo',
        logger: mockLogger,
      });

      await expect(ct.new()).rejects.toEqual(new Error('Folder foo already exists.'));
    });

    it('should catch, log, and rethrow errors', async () => {
      jest.spyOn(FileHandler, 'dirExists').mockResolvedValueOnce(false);
      
      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });
      jest.spyOn(ct.logger, 'splash').mockImplementationOnce(() => { throw new Error('Forced error'); });

      await expect(ct.new()).rejects.toBeTruthy();

      expect(ct.logger.logOutput).toEqual([
        '                          __',
      '  ____  ____  ____  _____/ /',
      ' / __ \\/ __ \\/ __ \\/ ___/ /',
      '/ /_/ / /_/ / /_/ (__  )_/',
      '\\____/\\____/ .___/____(_)',
      '          /_/ ',
      'Forced error',
      ]);
    });

    it('should abort if requested by empty input', async () => {
      // Always succeed when making sure path exists:
      jest.spyOn(FileHandler, 'ensurePathExists').mockResolvedValue(undefined);
      // Always succeed when copying files:
      jest.spyOn(FileHandler, 'copy').mockResolvedValue(undefined);
      // Always succeed when removing files:
      jest.spyOn(FileHandler, 'remove').mockResolvedValue(true);

      const mockResolve = jest.spyOn(FileHandler, 'resolve');
      const mockDirExists = jest.spyOn(FileHandler, 'dirExists')
      const mockMkdtemp = jest.spyOn(fs.promises, 'mkdtemp')
      const mockReadFile = jest.spyOn(fs.promises, 'readFile')
      const mockExists = jest.spyOn(FileHandler, 'exists');

      // Resolve temp path
      mockResolve.mockReturnValueOnce('/temp');

      // Resolve target path
      mockResolve.mockReturnValueOnce('/target/foo');

      // Return false for check if target folder exists:
      mockDirExists.mockResolvedValueOnce(false);

      // Set temp folder to /temp:
      mockMkdtemp.mockResolvedValueOnce('/temp');
      
      // Return true for check if local template exists:
      mockDirExists.mockResolvedValueOnce(true);

      // Return true for check if config file exists:
      mockExists.mockResolvedValueOnce(true);
      
      // Return contents of .codetender:
      mockReadFile.mockResolvedValueOnce('{ "version": "1.1" }');

      // Return true for check if temp folder exists:
      mockDirExists.mockResolvedValueOnce(true);
      
      const ct = new CodeTender({ 
        folder: 'foo', 
        template: 'bar',
        ignore: ['ignored*'],
        noReplace: ['noReplace*'],
        verbose: true,
        logger: jest.fn(),
        readerFactory: testReaderFactory({'  Token to replace [done]: ': ''}),
      });

      // Always succeed when running child process:
      jest.spyOn(ct, 'runChildProcess').mockResolvedValue(undefined);

      await ct.new();

      expect(ct.state.source.sourcePath).toEqual('/temp/__CT_TEMPLATE_ROOT__');

      expect(ct.logger.logOutput).toEqual([
        '',
        '  _____        __    __              __       ',
        ' / ___/__  ___/ /__ / /____ ___  ___/ /__ ____',
        '/ /__/ _ \\/ _  / -_) __/ -_) _ \\/ _  / -_) __/',
        '\\___/\\___/\\_,_/\\__/\\__/\\__/_//_/\\_,_/\\__/_/   ',
        'Serving up code...',
        'Creating temporary folder...',
        'Copying or cloning template...',
        'Template is local',
        'Copying from local template folder: bar into temporary folder: /temp/__CT_TEMPLATE_ROOT__',
        '  Creating folder: /temp/__CT_TEMPLATE_ROOT__',
        '  Copying from: bar to: /temp/__CT_TEMPLATE_ROOT__',
        'Successfully copied template from \'bar\' to \'foo\'.',
        'Looking for .codetender config...',
        'File version: 1.1.0',
        'Code version: 1.1.0',
        'No remote templates found.',
        'Cleaning up ignored files...',
        'Removing files from cloned repository matching ignore config...',
        '  Removing: /temp/__CT_TEMPLATE_ROOT__/ignored*',
        'Reading tokens from command line...',
        '',
        'Abort requested. Exiting...',
        'Cleaning up temporary folder: /temp',
        'Deleted temporary folder: /temp',
      ]);
    });

    it('should complete all steps and log output', async () => {
      // Always succeed when making sure path exists:
      jest.spyOn(FileHandler, 'ensurePathExists').mockResolvedValue(undefined);
      // Always succeed when copying files:
      jest.spyOn(FileHandler, 'copy').mockResolvedValue(undefined);
      // Always succeed when removing files:
      jest.spyOn(FileHandler, 'remove').mockResolvedValue(true);

      const mockResolve = jest.spyOn(FileHandler, 'resolve');
      const mockDirExists = jest.spyOn(FileHandler, 'dirExists')
      const mockMkdtemp = jest.spyOn(fs.promises, 'mkdtemp')
      const mockReadFile = jest.spyOn(fs.promises, 'readFile')
      const mockExists = jest.spyOn(FileHandler, 'exists');
      const mockReaddir = jest.spyOn(fs.promises, 'readdir');

      // Resolve temp path
      mockResolve.mockReturnValueOnce('/temp');

      // Resolve target path
      mockResolve.mockReturnValueOnce('/target/foo');

      // Return false for check if target folder exists:
      mockDirExists.mockResolvedValueOnce(false);

      // Set temp folder to /temp:
      mockMkdtemp.mockResolvedValueOnce('/temp');
      
      // Return true for check if local template exists:
      mockDirExists.mockResolvedValueOnce(true);

      // Return true for check if config file exists:
      mockExists.mockResolvedValueOnce(true);
      
      // Return contents of .codetender:
      mockReadFile.mockResolvedValueOnce('{ "version": "1.1" }');

      // Return true for check if config.json exists:
      mockExists.mockResolvedValueOnce(true);

      // Return contents of config.json:
      mockReadFile.mockResolvedValueOnce('{ "version": "1.1" }');

      // Return true for check if remote template local copy exists:
      mockDirExists.mockResolvedValueOnce(true);
      
      // Return empty result when replacing remote tokens:
      mockReaddir.mockResolvedValueOnce([]);
      
      // Return empty result when replacing tokens:
      mockReaddir.mockResolvedValueOnce([]);

      // Return true for check if temp folder exists:
      mockDirExists.mockResolvedValueOnce(true);
      
      const ct = new CodeTender({ 
        folder: 'foo', 
        template: 'bar',
        remote: [
          { src: 'foo/bar', dest: '/', tokens: [ { pattern: 'foo', replacement: 'bar' }]},
        ],
        tokens: [{ pattern: 'foo', prompt: 'Replace foo with:' }],
        ignore: ['ignored*'],
        noReplace: ['noReplace*'],
        file: 'config.json',
        verbose: true,
        logger: jest.fn(),
        readerFactory: testReaderFactory({'  Replace foo with:': 'bar'}),
      });

      // Always succeed when running child process:
      jest.spyOn(ct, 'runChildProcess').mockResolvedValue(undefined);

      await ct.new();

      expect(ct.logger.logOutput).toEqual([
        '',
        '  _____        __    __              __       ',
        ' / ___/__  ___/ /__ / /____ ___  ___/ /__ ____',
        '/ /__/ _ \\/ _  / -_) __/ -_) _ \\/ _  / -_) __/',
        '\\___/\\___/\\_,_/\\__/\\__/\\__/_//_/\\_,_/\\__/_/   ',
        'Serving up code...',
        'Creating temporary folder...',
        'Copying or cloning template...',
        'Template is local',
        'Copying from local template folder: bar into temporary folder: /temp/__CT_TEMPLATE_ROOT__',
        '  Creating folder: /temp/__CT_TEMPLATE_ROOT__',
        '  Copying from: bar to: /temp/__CT_TEMPLATE_ROOT__',
        'Successfully copied template from \'bar\' to \'foo\'.',
        'Looking for .codetender config...',
        'File version: 1.1.0',
        'Code version: 1.1.0',
        'Checking for specified config file: config.json...',
        'File version: 1.1.0',
        'Code version: 1.1.0',
        'Remote templates found.',
        'Cloning from repo: foo/bar into temporary folder: /temp/__CT_TEMPLATE_ROOT__/__CT_REMOTE_ROOT__',
        'Processing remote templates...',
        '',
        'Processing remote template in folder: /',
        '  Creating folder: /temp/__CT_TEMPLATE_ROOT__',
        '  Copying from: /temp/__CT_TEMPLATE_ROOT__/__CT_REMOTE_ROOT__ to: /temp/__CT_TEMPLATE_ROOT__',
        'Cleaning up ignored files...',
        'Removing files from cloned repository matching ignore config...',
        '  Removing: /temp/__CT_TEMPLATE_ROOT__/ignored*',
        'Reading token values from command line...',
        '',
        'Enter a blank value at any time to abort.',
        '',
        'Prepping tokens...',
        'Looking for variable CODETENDER_ROOT in bar...',
        'No globs specified to skip token replacement.',
        'No before script found.',
        '',
        'Renaming files and replacing tokens where found...',
        'Processing folder: /temp/__CT_TEMPLATE_ROOT__',
        'No after script found.',
        'Cleaning up deleted files...',
        'No patterns defined for delete config.',
        'Copying from temporary folder /temp to target folder /target/foo',
        '  Creating folder: /target/foo',
        '  Copying from: /temp/__CT_TEMPLATE_ROOT__ to: /target/foo',
        'Successfully replaced the following tokens where found:',
        'pattern -> replacement (content/files)',
        '--------------------------------------',
        'foo -> bar (0/0)',
        'No banner found.',
        'Cleaning up temporary folder: /temp',
        'Deleted temporary folder: /temp',
      ]);
    });
  });

  describe('add()', () => {
    it('should throw error if destination folder does not exists', async () => {
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/temp');
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/target');
      const mockLogger = jest.fn();
      jest.spyOn(FileHandler, 'dirExists').mockResolvedValueOnce(false);

      const ct = new CodeTender({
        folder: 'foo',
        logger: mockLogger,
      });

      await expect(ct.add()).rejects.toEqual(new Error('Folder foo does not exist.'));
    });

    it('should catch, log, and rethrow errors', async () => {
      jest.spyOn(FileHandler, 'dirExists').mockResolvedValueOnce(true);
      
      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });
      jest.spyOn(ct.logger, 'splash').mockImplementationOnce(() => { throw new Error('Forced error'); });

      await expect(ct.add()).rejects.toBeTruthy();

      expect(ct.logger.logOutput).toEqual([
        '                          __',
      '  ____  ____  ____  _____/ /',
      ' / __ \\/ __ \\/ __ \\/ ___/ /',
      '/ /_/ / /_/ / /_/ (__  )_/',
      '\\____/\\____/ .___/____(_)',
      '          /_/ ',
      'Forced error',
      ]);
    });

    it('should abort if requested by empty input', async () => {
      // Always succeed when making sure path exists:
      jest.spyOn(FileHandler, 'ensurePathExists').mockResolvedValue(undefined);
      // Always succeed when copying files:
      jest.spyOn(FileHandler, 'copy').mockResolvedValue(undefined);
      // Always succeed when removing files:
      jest.spyOn(FileHandler, 'remove').mockResolvedValue(true);

      const mockResolve = jest.spyOn(FileHandler, 'resolve');
      const mockDirExists = jest.spyOn(FileHandler, 'dirExists')
      const mockMkdtemp = jest.spyOn(fs.promises, 'mkdtemp')
      const mockReadFile = jest.spyOn(fs.promises, 'readFile')
      const mockExists = jest.spyOn(FileHandler, 'exists');

      // Resolve temp path
      mockResolve.mockReturnValueOnce('/temp');

      // Resolve target path
      mockResolve.mockReturnValueOnce('/target/foo');

      // Return true for check if target folder exists:
      mockDirExists.mockResolvedValueOnce(true);

      // Set temp folder to /temp:
      mockMkdtemp.mockResolvedValueOnce('/temp');
      
      // Return true for check if local template exists:
      mockDirExists.mockResolvedValueOnce(true);

      // Return true for check if config file exists:
      mockExists.mockResolvedValueOnce(true);
      
      // Return contents of .codetender:
      mockReadFile.mockResolvedValueOnce('{ "version": "1.1" }');

      // Return true for check if temp folder exists:
      mockDirExists.mockResolvedValueOnce(true);
      
      const ct = new CodeTender({ 
        folder: 'foo', 
        template: 'bar',
        ignore: ['ignored*'],
        noReplace: ['noReplace*'],
        verbose: true,
        logger: jest.fn(),
        readerFactory: testReaderFactory({'  Token to replace [done]: ': ''}),
      });

      // Always succeed when running child process:
      jest.spyOn(ct, 'runChildProcess').mockResolvedValue(undefined);

      await ct.add();

      expect(ct.state.source.sourcePath).toEqual('/temp/__CT_TEMPLATE_ROOT__');

      expect(ct.logger.logOutput).toEqual([
        '',
        '  _____        __    __              __       ',
        ' / ___/__  ___/ /__ / /____ ___  ___/ /__ ____',
        '/ /__/ _ \\/ _  / -_) __/ -_) _ \\/ _  / -_) __/',
        '\\___/\\___/\\_,_/\\__/\\__/\\__/_//_/\\_,_/\\__/_/   ',
        'Serving up more code...',
        'Creating temporary folder...',
        'Copying or cloning template...',
        'Template is local',
        'Copying from local template folder: bar into temporary folder: /temp/__CT_TEMPLATE_ROOT__',
        '  Creating folder: /temp/__CT_TEMPLATE_ROOT__',
        '  Copying from: bar to: /temp/__CT_TEMPLATE_ROOT__',
        'Successfully copied template from \'bar\' to \'foo\'.',
        'Looking for .codetender config...',
        'File version: 1.1.0',
        'Code version: 1.1.0',
        'No remote templates found.',
        'Cleaning up ignored files...',
        'Removing files from cloned repository matching ignore config...',
        '  Removing: /temp/__CT_TEMPLATE_ROOT__/ignored*',
        'Reading tokens from command line...',
        '',
        'Abort requested. Exiting...',
        'Cleaning up temporary folder: /temp',
        'Deleted temporary folder: /temp',
      ]);
    });

    it('should complete all steps and log output', async () => {
      // Always succeed when making sure path exists:
      jest.spyOn(FileHandler, 'ensurePathExists').mockResolvedValue(undefined);
      // Always succeed when copying files:
      jest.spyOn(FileHandler, 'copy').mockResolvedValue(undefined);
      // Always succeed when removing files:
      jest.spyOn(FileHandler, 'remove').mockResolvedValue(true);

      const mockResolve = jest.spyOn(FileHandler, 'resolve');
      const mockDirExists = jest.spyOn(FileHandler, 'dirExists')
      const mockMkdtemp = jest.spyOn(fs.promises, 'mkdtemp')
      const mockReadFile = jest.spyOn(fs.promises, 'readFile')
      const mockExists = jest.spyOn(FileHandler, 'exists');
      const mockReaddir = jest.spyOn(fs.promises, 'readdir');

      // Resolve temp path
      mockResolve.mockReturnValueOnce('/temp');

      // Resolve target path
      mockResolve.mockReturnValueOnce('/target/foo');

      // Return true for check if target folder exists:
      mockDirExists.mockResolvedValueOnce(true);

      // Set temp folder to /temp:
      mockMkdtemp.mockResolvedValueOnce('/temp');
      
      // Return true for check if local template exists:
      mockDirExists.mockResolvedValueOnce(true);

      // Return true for check if config file exists:
      mockExists.mockResolvedValueOnce(true);
      
      // Return contents of .codetender:
      mockReadFile.mockResolvedValueOnce('{ "version": "1.1" }');

      // Return true for check if config.json exists:
      mockExists.mockResolvedValueOnce(true);

      // Return contents of config.json:
      mockReadFile.mockResolvedValueOnce('{ "version": "1.1" }');

      // Return true for check if remote template local copy exists:
      mockDirExists.mockResolvedValueOnce(true);
      
      // Return empty result when replacing remote tokens:
      mockReaddir.mockResolvedValueOnce([]);
      
      // Return empty result when replacing tokens:
      mockReaddir.mockResolvedValueOnce([]);

      // Return true for check if temp folder exists:
      mockDirExists.mockResolvedValueOnce(true);
      
      const ct = new CodeTender({ 
        folder: 'foo', 
        template: 'bar',
        remote: [
          { src: 'foo/bar', dest: '/', tokens: [ { pattern: 'foo', replacement: 'bar' }]},
        ],
        tokens: [{ pattern: 'foo', prompt: 'Replace foo with:' }],
        ignore: ['ignored*'],
        noReplace: ['noReplace*'],
        file: 'config.json',
        verbose: true,
        logger: jest.fn(),
        readerFactory: testReaderFactory({'  Replace foo with:': 'bar'}),
      });

      // Always succeed when running child process:
      jest.spyOn(ct, 'runChildProcess').mockResolvedValue(undefined);

      await ct.add();

      expect(ct.logger.logOutput).toEqual([
        '',
        '  _____        __    __              __       ',
        ' / ___/__  ___/ /__ / /____ ___  ___/ /__ ____',
        '/ /__/ _ \\/ _  / -_) __/ -_) _ \\/ _  / -_) __/',
        '\\___/\\___/\\_,_/\\__/\\__/\\__/_//_/\\_,_/\\__/_/   ',
        'Serving up more code...',
        'Creating temporary folder...',
        'Copying or cloning template...',
        'Template is local',
        'Copying from local template folder: bar into temporary folder: /temp/__CT_TEMPLATE_ROOT__',
        '  Creating folder: /temp/__CT_TEMPLATE_ROOT__',
        '  Copying from: bar to: /temp/__CT_TEMPLATE_ROOT__',
        'Successfully copied template from \'bar\' to \'foo\'.',
        'Looking for .codetender config...',
        'File version: 1.1.0',
        'Code version: 1.1.0',
        'Checking for specified config file: config.json...',
        'File version: 1.1.0',
        'Code version: 1.1.0',
        'Remote templates found.',
        'Cloning from repo: foo/bar into temporary folder: /temp/__CT_TEMPLATE_ROOT__/__CT_REMOTE_ROOT__',
        'Processing remote templates...',
        '',
        'Processing remote template in folder: /',
        '  Creating folder: /temp/__CT_TEMPLATE_ROOT__',
        '  Copying from: /temp/__CT_TEMPLATE_ROOT__/__CT_REMOTE_ROOT__ to: /temp/__CT_TEMPLATE_ROOT__',
        'Cleaning up ignored files...',
        'Removing files from cloned repository matching ignore config...',
        '  Removing: /temp/__CT_TEMPLATE_ROOT__/ignored*',
        'Reading token values from command line...',
        '',
        'Enter a blank value at any time to abort.',
        '',
        'Prepping tokens...',
        'Looking for variable CODETENDER_ROOT in bar...',
        'No globs specified to skip token replacement.',
        'No before script found.',
        '',
        'Renaming files and replacing tokens where found...',
        'Processing folder: /temp/__CT_TEMPLATE_ROOT__',
        'No after script found.',
        'Cleaning up deleted files...',
        'No patterns defined for delete config.',
        'Copying from temporary folder /temp to target folder /target/foo',
        '  Creating folder: /target/foo',
        '  Copying from: /temp/__CT_TEMPLATE_ROOT__ to: /target/foo',
        'Successfully replaced the following tokens where found:',
        'pattern -> replacement (content/files)',
        '--------------------------------------',
        'foo -> bar (0/0)',
        'No banner found.',
        'Cleaning up temporary folder: /temp',
        'Deleted temporary folder: /temp',
      ]);
    });
  });
});
