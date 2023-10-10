import { CodeTender, FileHandler } from '../../../src/index';
import fs from 'graceful-fs';
import path from 'path';
import fsExtra from 'fs-extra';
import * as fg from 'fast-glob';
import * as replaceInFile from 'replace-in-file';
import * as rimraf from 'rimraf';

jest.mock('fs-extra', () => {
  return {
    ...jest.requireActual('fs-extra'),
    copy: jest.fn(),
    mkdirp: jest.fn(),
  };
});

jest.mock('replace-in-file');
jest.mock('rimraf');

jest.mock('fast-glob', () => {
  return {
    __esModule: true,
    ...jest.requireActual('fast-glob')
  };
});

describe('FileHandler', () => {
  
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('createTempFolder()', () => {
    it('should call mkdtemp and set state', async () => {
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/source/template');
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/target/foo');
      jest.spyOn(FileHandler, 'ensurePathExists').mockResolvedValueOnce(undefined);
      const mockMktemp = jest.spyOn(fs.promises, 'mkdtemp').mockResolvedValueOnce('/temp');

      const ct = new CodeTender({
        folder: 'foo',
        template: 'template',
        verbose: true,
        logger: jest.fn(),
      });

      const fileHandler = new FileHandler(ct);

      await fileHandler.createTempFolder();

      expect(mockMktemp).toHaveBeenCalledWith('/target/foo');
    });
  });

  describe('copyFromTemp()', () => {
    it('should call copy and remove', async () => {
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/source/template');
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/target/foo');
      const mockRemove = jest.spyOn(FileHandler, 'remove').mockResolvedValueOnce(true);

      const ct = new CodeTender({
        folder: 'foo',
        template: 'template',
        verbose: true,
        logger: jest.fn(),
      });

      const fileHandler = new FileHandler(ct);

      const mockCopy = jest.spyOn(fileHandler, 'copyFromFs').mockResolvedValueOnce(undefined);

      await fileHandler.copyFromTemp();

      expect(mockCopy).toHaveBeenCalledWith('/source/template', '/target/foo');
    });
  });

  describe('copyFromFs()', () => {
    it('should call ensurePathExists and copy', async () => {
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/source/template');
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/target/foo');
      const mockEnsurePathExists = jest.spyOn(FileHandler, 'ensurePathExists').mockResolvedValueOnce(undefined);
      const mockCopy = jest.spyOn(FileHandler, 'copy').mockResolvedValueOnce(undefined);

      const ct = new CodeTender({
        folder: 'foo',
        template: 'template',
        verbose: true,
        logger: jest.fn(),
      });

      const fileHandler = new FileHandler(ct);

      await fileHandler.copyFromFs('from', 'to');

      expect(mockEnsurePathExists).toHaveBeenCalledWith('to');

      expect(mockCopy).toHaveBeenCalledWith('from', 'to', false);
    });

    it('should call copyIncludedOnly if include specified', async () => {
      const mockEnsurePathExists = jest.spyOn(FileHandler, 'ensurePathExists');
      mockEnsurePathExists.mockResolvedValueOnce(undefined);
      mockEnsurePathExists.mockResolvedValueOnce(undefined);
      mockEnsurePathExists.mockResolvedValueOnce(undefined);
      const mockCopy = jest.spyOn(FileHandler, 'copy');
      mockCopy.mockResolvedValueOnce(undefined);
      mockCopy.mockResolvedValueOnce(undefined);

      const ct = new CodeTender({
        folder: 'foo',
        template: 'template',
        include: ['foo.txt'],
        verbose: true,
        logger: jest.fn(),
      });
      ct.state.source.hasConfig = true;

      const fileHandler = new FileHandler(ct);

      await fileHandler.copyFromFs('from', 'to', true);

      expect(mockEnsurePathExists).toHaveBeenCalledWith('to');

      expect(mockCopy).toHaveBeenCalledWith('from/.codetender', 'to/.codetender', false);
      expect(mockCopy).toHaveBeenCalledWith('from/foo.txt', 'to/foo.txt', false);
    });
  });

  describe('cleanupIgnored()', () => {
    it('should call cleanUpFiles', async () => {
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/source/template');
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/target/foo');

      const ct = new CodeTender({
        folder: 'foo',
        template: 'template',
        ignore: ['ignore'],
        verbose: true,
        logger: jest.fn(),
      });

      const fileHandler = new FileHandler(ct);

      const mockCleanUpFiles = jest.spyOn(fileHandler, 'cleanUpFiles').mockResolvedValueOnce(undefined);

      await fileHandler.cleanupIgnored();

      expect(mockCleanUpFiles).toHaveBeenCalledWith(['ignore', '**/.git/', '.codetender'], 'ignore');
    });
  });

  describe('deleteGlobs()', () => {
    it('should call remove for each glob', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        verbose: true,
        logger: jest.fn(),
      });
      
      const fileHandler = new FileHandler(ct);
      
      const mockRemove = jest.spyOn(FileHandler, 'remove');
      mockRemove.mockResolvedValueOnce(true);
      mockRemove.mockResolvedValueOnce(true);
      
      const mockGlob = jest.fn();

      jest.spyOn(fg, 'glob').mockImplementation(mockGlob);
  
      mockGlob.mockResolvedValueOnce([
        { path: 'foo.txt', dirent: { isDirectory: jest.fn().mockReturnValueOnce(false) } },
        { path: 'bar', dirent: { isDirectory: jest.fn().mockReturnValueOnce(true) } },
      ]);
      
      await fileHandler.deleteGlobs(['foo'], 'here');

      expect(mockGlob).toHaveBeenCalled();

      expect(mockRemove).toHaveBeenCalledWith('here/foo.txt', false);
      expect(mockRemove).toHaveBeenCalledWith('here/bar', true);
    });
  });

  describe('deleteTemp()', () => {
    it('should exit if temp path is not defined', async () => {
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/source/template');
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/target/foo');

      const ct = new CodeTender({
        folder: 'foo',
        template: 'template',
        verbose: true,
        logger: jest.fn(),
      });

      const fileHandler = new FileHandler(ct);

      await fileHandler.deleteTemp();

      expect(ct.logger.logOutput).toEqual(['Temporary folder not defined. Skipping delete.']);
    });

    it('should exit if temp path does not exist', async () => {
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/source/template');
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/target/foo');
      jest.spyOn(FileHandler, 'dirExists').mockResolvedValueOnce(false);

      const ct = new CodeTender({
        folder: 'foo',
        template: 'template',
        verbose: true,
        logger: jest.fn(),
      });
      ct.state.process.tempPath = '/temp';

      const fileHandler = new FileHandler(ct);

      await fileHandler.deleteTemp();

      expect(ct.logger.logOutput).toEqual(['Temporary folder not found. Skipping delete.']);
    });

    it('should call remove', async () => {
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/source/template');
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/target/foo');
      jest.spyOn(FileHandler, 'dirExists').mockResolvedValueOnce(true);
      const mockRemove = jest.spyOn(FileHandler, 'remove').mockResolvedValueOnce(true);

      const ct = new CodeTender({
        folder: 'foo',
        template: 'template',
        verbose: true,
        logger: jest.fn(),
      });
      ct.state.process.tempPath = '/temp';

      const fileHandler = new FileHandler(ct);

      await fileHandler.deleteTemp();

      expect(mockRemove).toHaveBeenCalledWith('/temp');
    });
  });

  describe('resolve()', () => {
    it('should call path.resolve', () => {
      const mockResolve = jest.spyOn(path, 'resolve').mockImplementation((...paths: string[]) => {
        return '/foo/bar';
      });

      FileHandler.resolve('bar');

      expect(mockResolve).toHaveBeenCalledWith('bar');
    });
  });

  describe('dirExists()', () => {
    it('should call return true for a directory', async () => {
      await expect(FileHandler.dirExists(__dirname)).resolves.toBeTruthy();
    });

    it('should call return false for a file', async () => {
      await expect(FileHandler.dirExists(__filename)).resolves.toBeFalsy();
    });

    it('should call return false for an invalid path', async () => {
      await expect(FileHandler.dirExists('/this/is/invalid')).resolves.toBeFalsy();
    });
  });

  describe('exists()', () => {
    it('should call return true for a valid file path', async () => {
      await expect(FileHandler.exists(__filename)).resolves.toBeTruthy();
    });

    it('should call return false for an invalid path', async () => {
      await expect(FileHandler.exists('/this/is/invalid')).resolves.toBeFalsy();
    });
  });

  describe('ensurePathExists()', () => {
    it('should call mkdirp', async () => {
      const mockMkdirp = jest.fn();
      jest.spyOn(fsExtra, 'mkdirp').mockImplementation(mockMkdirp);
      mockMkdirp.mockImplementation((path, callback: (err: any) => void) => {
        callback(null);
      });

      FileHandler.ensurePathExists('/foo');

      expect(mockMkdirp.mock.calls[0][0]).toEqual('/foo');
    });

    it('should reject when err is passed', async () => {
      const mockMkdirp = jest.fn();
      jest.spyOn(fsExtra, 'mkdirp').mockImplementation(mockMkdirp);
      mockMkdirp.mockImplementation((path, callback: (err: any) => void) => {
        callback('foo');
      });

      await expect(FileHandler.ensurePathExists('/foo')).rejects.toEqual('foo');
    });
  });

  describe('copy()', () => {
    it('should call copy', async () => {
      const mockCopy = jest.spyOn(fsExtra, 'copy');
      mockCopy.mockImplementation((from, to, options, callback: (err: any) => void) => {
        callback(null);
      });

      FileHandler.copy('/from', '/to', true);

      expect(mockCopy.mock.calls[0][0]).toEqual('/from');
      expect(mockCopy.mock.calls[0][1]).toEqual('/to');
      expect(mockCopy.mock.calls[0][2]).toEqual({ overwrite: true });
    });

    it('should reject when err is passed', async () => {
      const mockCopy = jest.fn();
      jest.spyOn(fsExtra, 'copy').mockImplementation(mockCopy);
      mockCopy.mockImplementation((from, to, options, callback: (err: any) => void) => {
        callback('foo');
      });

      await expect(FileHandler.copy('/from', '/to', true)).rejects.toEqual('foo');
    });
  });

  describe('replaceInFile()', () => {
    it('should call replaceInFile', async () => {
      const mockReplaceInFile = jest.spyOn(replaceInFile, 'replaceInFile').mockResolvedValue(undefined as never);

      await FileHandler.replaceInFile({
        files: 'files',
        from: 'foo',
        to: 'bar',
      });

      expect(mockReplaceInFile).toHaveBeenCalledWith({
        files: 'files',
        from: 'foo',
        to: 'bar',
      });
    });
  });

  describe('remove()', () => {
    it('should call rimraf for directory', async () => {
      const mockRimraf = jest.spyOn(rimraf, 'rimraf').mockResolvedValue(true);

      jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(true);

      await FileHandler.remove('/delete/me', true);

      expect(mockRimraf).toHaveBeenCalledWith('/delete/me', { preserveRoot: false });
    });

    it('should call unlink for file', async () => {
      const mockUnlink = jest.spyOn(fsExtra.promises, 'unlink').mockResolvedValue(undefined);

      jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(true);

      await FileHandler.remove('/delete/me.txt', false);

      expect(mockUnlink).toHaveBeenCalledWith('/delete/me.txt');
    });

    it('should return false if file does not exist', async () => {
      jest.spyOn(FileHandler, 'exists').mockResolvedValueOnce(false);

      const result = await FileHandler.remove('/delete/me.txt', false);

      expect(result).toEqual(false);
    });
  });
});
