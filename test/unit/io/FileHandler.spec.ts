import { CodeTender, FileHandler } from '../../../src/index';
import fs from 'graceful-fs';
import path from 'path';
import fsExtra from 'fs-extra';
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

describe('FileHandler', () =>{
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
  });

  describe('cleanupIgnored()', () => {
    it('should call cleanUpFiles', async () => {
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/source/template');
      jest.spyOn(FileHandler, 'resolve').mockReturnValueOnce('/target/foo');

      const ct = new CodeTender({
        folder: 'foo',
        template: 'template',
        ignore: [ 'ignore' ],
        verbose: true,
        logger: jest.fn(),
      });
      
      const fileHandler = new FileHandler(ct);

      const mockCleanUpFiles = jest.spyOn(fileHandler, 'cleanUpFiles').mockResolvedValueOnce(undefined);
      
      await fileHandler.cleanupIgnored();

      expect(mockCleanUpFiles).toHaveBeenCalledWith([ 'ignore' ], 'ignore');
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

      expect(ct.logger.logOutput).toEqual([
        'Temporary folder not defined. Skipping delete.',
      ]);
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

      expect(ct.logger.logOutput).toEqual([
        'Temporary folder not found. Skipping delete.',
      ]);
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
      const mockResolve = jest.spyOn(path, 'resolve').mockImplementation((...paths: string[]) => { return '/foo/bar'; });

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
    it('should call mkdirp', async() => {
      const mockMkdirp = jest.fn();
      jest.spyOn(fsExtra, 'mkdirp').mockImplementation(mockMkdirp);
      mockMkdirp.mockImplementation((path, callback: (err: any) => void) => {
        callback(null);
      });

      FileHandler.ensurePathExists('/foo');

      expect(mockMkdirp.mock.calls[0][0]).toEqual('/foo');
    });

    it('should reject when err is passed', async() => {
      const mockMkdirp = jest.fn();
      jest.spyOn(fsExtra, 'mkdirp').mockImplementation(mockMkdirp);
      mockMkdirp.mockImplementation((path, callback: (err: any) => void) => {
        callback('foo');
      });

      await expect(FileHandler.ensurePathExists('/foo')).rejects.toEqual('foo');
    });
  });

  describe('copy()', () => {
    it('should call copy', async() => {
      const mockCopy = jest.spyOn(fsExtra, 'copy');
      mockCopy.mockImplementation((from, to, options, callback: (err: any) => void) => {
        callback(null);
      });

      FileHandler.copy('/from', '/to', true);

      expect(mockCopy.mock.calls[0][0]).toEqual('/from');
      expect(mockCopy.mock.calls[0][1]).toEqual('/to');
      expect(mockCopy.mock.calls[0][2]).toEqual({ overwrite: true });
    });

    it('should reject when err is passed', async() => {
      const mockCopy = jest.fn();
      jest.spyOn(fsExtra, 'copy').mockImplementation(mockCopy);
      mockCopy.mockImplementation((from, to, options, callback: (err: any) => void) => {
        callback('foo');
      });

      await expect(FileHandler.copy('/from', '/to', true)).rejects.toEqual('foo');
    });
  });

  describe('replaceInFile()', () => {
    it('should call replaceInFile', async() => {
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

  describe('rimraf()', () => {
    it('should call rimraf', async() => {
      const mockRimraf = jest.spyOn(rimraf, 'rimraf').mockResolvedValue(true);

      await FileHandler.remove('/delete/me');

      expect(mockRimraf).toHaveBeenCalledWith('/delete/me');
    });
  });
});