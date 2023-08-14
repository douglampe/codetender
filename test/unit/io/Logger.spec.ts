import { CodeTender, Logger } from '../../../src/index';

describe('Logger', () => {
  describe('log()', () => {
    it('should call console.log and push to output', () => {
      const mockLog = jest.fn();
      const ct = new CodeTender({
        folder: 'foo',
        logger: mockLog,
      });
      const logger = new Logger(ct);

      logger.log('foo');

      expect(mockLog).toHaveBeenCalledWith('foo');
      expect(logger.logOutput).toEqual(['foo']);
    });

    it('should not call console.log or push to output if quiet is true', () => {
      const mockLog = jest.fn();
      const ct = new CodeTender({
        folder: 'foo',
        logger: mockLog,
        quiet: true,
      });
      const logger = new Logger(ct);

      logger.log('foo');

      expect(mockLog).not.toHaveBeenCalled();
      expect(logger.logOutput).toEqual([]);
    });
  });

  describe('verboseLog()', () => {
    it('should log if verbose set to true', () => {
      const ct = new CodeTender({
        folder: 'foo',
        verbose: true,
        logger: jest.fn(),
      });
      const logger = new Logger(ct);

      const mockLog = jest.spyOn(logger, 'log');

      logger.verboseLog('foo');

      expect(mockLog).toHaveBeenCalledWith('foo');
    });

    it('should not log if verbose set to false', () => {
      const ct = new CodeTender({
        folder: 'foo',
        verbose: false,
        logger: jest.fn(),
      });
      const logger = new Logger(ct);

      const mockLog = jest.spyOn(logger, 'log');

      logger.verboseLog('foo');

      expect(mockLog).not.toHaveBeenCalled();
    });
  });

  describe('logTokenSuccess', () => {
    it('should log success of template clone', () => {
      const ct = new CodeTender({
        folder: 'foo',
        template: 'https://github.com/foo',
        verbose: true,
        logger: jest.fn(),
      });
      ct.state.source.isLocalTemplate = false;
      const logger = new Logger(ct);

      const mockLog = jest.spyOn(logger, 'log');

      logger.logCloneSuccess();

      expect(mockLog).toHaveBeenCalledWith(`Successfully cloned template from '${ct.config.template}' to '${ct.config.folder}'.`);
    });

    it('should log success of template copy', () => {
      const ct = new CodeTender({
        folder: 'foo',
        template: 'https://github.com/foo',
        verbose: true,
        logger: jest.fn(),
      });
      ct.state.source.isLocalTemplate = true;
      const logger = new Logger(ct);

      const mockLog = jest.spyOn(logger, 'log');

      logger.logCloneSuccess();

      expect(mockLog).toHaveBeenCalledWith(`Successfully copied template from '${ct.config.template}' to '${ct.config.folder}'.`);
    });

    it('should log success of token replacement', () => {
      const ct = new CodeTender({
        folder: 'foo',
        verbose: true,
        tokens: [
          {
            pattern: 'foo',
            replacement: 'bar',
          },
        ],
        logger: jest.fn(),
      });
      ct.state.process.tokenMap['foo'] = {
        originalPattern: 'foo',
        replacement: 'bar',
        pattern: /foo/g,
        count: 10,
        files: [{ file: 'bar.json', count: 10 }],
        renamed: [{ old: 'baz.json', new: 'BAZ.json' }],
      };

      const logger = new Logger(ct);

      const mockLog = jest.spyOn(logger, 'log');

      logger.logTokenSuccess();

      expect(mockLog).toHaveBeenCalledWith('Successfully replaced the following tokens where found:');
      expect(mockLog).toHaveBeenCalledWith('pattern -> replacement (content/files)');
      expect(mockLog).toHaveBeenCalledWith('--------------------------------------');
      expect(mockLog).toHaveBeenCalledWith('foo -> bar (10/1)');
      expect(mockLog).toHaveBeenCalledWith('  bar.json (10)');
      expect(mockLog).toHaveBeenCalledWith('  baz.json -> BAZ.json');
    });

    it('should log rename errors', () => {
      const ct = new CodeTender({
        folder: 'foo',
        verbose: true,
        tokens: [
          {
            pattern: 'foo',
            replacement: 'bar',
          },
        ],
        logger: jest.fn(),
      });

      const logger = new Logger(ct);

      ct.state.output.errors.push({
        type: 'Rename Conflict',
        old: 'foo',
        new: 'bar',
        folder: 'baz',
      });

      const mockLog = jest.spyOn(logger, 'log');

      logger.logTokenSuccess();

      expect(mockLog).toHaveBeenCalledWith('Could not rename the following files or folders due to naming conflicts:');
      expect(mockLog).toHaveBeenCalledWith('  Conflict: foo -> bar in folder baz');
    });

    it('should log message if no tokens specified', () => {
      const ct = new CodeTender({
        folder: 'foo',
        template: 'https://github.com/foo',
        verbose: true,
        logger: jest.fn(),
      });
      ct.state.source.isLocalTemplate = false;
      const logger = new Logger(ct);

      const mockLog = jest.spyOn(logger, 'log');

      logger.logTokenSuccess();

      expect(mockLog).toHaveBeenCalledWith('No tokens specified.');
    });
  });

  describe('splash()', () => {
    it('should log splash and message', () => {
      const ct = new CodeTender({
        folder: 'foo',
        logger: jest.fn(),
      });
      const logger = new Logger(ct);

      const mockLog = jest.spyOn(logger, 'log');

      logger.splash('Serving up code...');

      expect(mockLog).toHaveBeenCalledWith('');
      expect(mockLog).toHaveBeenCalledWith('  _____        __    __              __       ');
      expect(mockLog).toHaveBeenCalledWith(' / ___/__  ___/ /__ / /____ ___  ___/ /__ ____');
      expect(mockLog).toHaveBeenCalledWith('/ /__/ _ \\/ _  / -_) __/ -_) _ \\/ _  / -_) __/');
      expect(mockLog).toHaveBeenCalledWith('\\___/\\___/\\_,_/\\__/\\__/\\__/_//_/\\_,_/\\__/_/   ');
      expect(mockLog).toHaveBeenCalledWith('Serving up code...');
    });
  });

  describe('bnner()', () => {
    it('should display the banner if a string', () => {
      const mockLog = jest.fn();
      const ct = new CodeTender({
        folder: 'foo',
        banner: 'This is a banner',
        logger: mockLog,
        verbose: true,
      });
      const logger = new Logger(ct);

      logger.banner();

      expect(mockLog).toHaveBeenCalledWith('Displaying banner...');
      expect(mockLog).toHaveBeenCalledWith('');
      expect(mockLog).toHaveBeenCalledWith('This is a banner');
    });

    it('should display the banner if an array', () => {
      const mockLog = jest.fn();
      const ct = new CodeTender({
        folder: 'foo',
        banner: ['This is a banner'],
        logger: mockLog,
        verbose: false,
      });
      const logger = new Logger(ct);

      logger.banner();

      expect(mockLog).toHaveBeenCalledWith('');
      expect(mockLog).toHaveBeenCalledWith('This is a banner');
    });

    it('should display a message if no banner found and verbose is true', () => {
      const mockLog = jest.fn();
      const ct = new CodeTender({
        folder: 'foo',
        logger: mockLog,
        verbose: true,
      });
      const logger = new Logger(ct);

      logger.banner();

      expect(mockLog).toHaveBeenCalledWith('No banner found.');
    });
  });

  describe('oops()', () => {
    it('should display oops and message', () => {
      const mockLog = jest.fn();
      const ct = new CodeTender({
        folder: 'foo',
        banner: 'This is a banner',
        logger: mockLog,
        verbose: true,
      });
      const logger = new Logger(ct);

      logger.oops(new Error('This is an error'), true);

      expect(mockLog).toHaveBeenCalledWith('                          __');
      expect(mockLog).toHaveBeenCalledWith('  ____  ____  ____  _____/ /');
      expect(mockLog).toHaveBeenCalledWith(' / __ \\/ __ \\/ __ \\/ ___/ /');
      expect(mockLog).toHaveBeenCalledWith('/ /_/ / /_/ / /_/ (__  )_/');
      expect(mockLog).toHaveBeenCalledWith('\\____/\\____/ .___/____(_)');
      expect(mockLog).toHaveBeenCalledWith('          /_/ ');
      expect(mockLog).toHaveBeenCalledWith('This is an error');
    });

    it('should call process.exit if captured is false', () => {
      const mockLog = jest.fn();
      const ct = new CodeTender({
        folder: 'foo',
        banner: 'This is a banner',
        logger: mockLog,
        verbose: true,
      });
      const logger = new Logger(ct);

      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => undefined as never);

      logger.oops(new Error('Error'), false);

      expect(mockExit).toHaveBeenCalled();
    });
  });
});
