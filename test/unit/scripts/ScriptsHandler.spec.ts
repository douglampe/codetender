import { CodeTender, ScriptHandler } from '../../../src/index';

describe('ScriptHandler', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('runBeforeScript()', () => {
    it('should call runChildProcess', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        scripts: {
          before: 'before.js',
        },
        verbose: true,
        logger: jest.fn(),
      });
      ct.state.source.sourcePath = '/source';

      const mockRunChildProcess = jest.spyOn(ct, 'runChildProcess').mockReturnValueOnce(undefined as never);

      const scriptHandler = new ScriptHandler(ct);

      await scriptHandler.runBeforeScript();

      expect(mockRunChildProcess).toHaveBeenCalledWith('before.js', '/source');
    });

    it('should do nothing if no script', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        verbose: true,
        logger: jest.fn(),
      });
      ct.state.source.sourcePath = '/source';

      const mockRunChildProcess = jest.spyOn(ct, 'runChildProcess').mockReturnValueOnce(undefined as never);

      const scriptHandler = new ScriptHandler(ct);

      await scriptHandler.runBeforeScript();

      expect(mockRunChildProcess).not.toHaveBeenCalled();

      expect(ct.logger.logOutput).toEqual(['No before script found.']);
    });
  });

  describe('runAfterScript()', () => {
    it('should call runChildProcess', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        scripts: {
          after: 'after.js',
        },
        verbose: true,
        logger: jest.fn(),
      });
      ct.state.source.sourcePath = '/source';

      const mockRunChildProcess = jest.spyOn(ct, 'runChildProcess').mockReturnValueOnce(undefined as never);

      const scriptHandler = new ScriptHandler(ct);

      await scriptHandler.runAfterScript();

      expect(mockRunChildProcess).toHaveBeenCalledWith('after.js', '/source');
    });

    it('should do nothing if no script', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        verbose: true,
        logger: jest.fn(),
      });
      ct.state.source.sourcePath = '/source';

      const mockRunChildProcess = jest.spyOn(ct, 'runChildProcess').mockReturnValueOnce(undefined as never);

      const scriptHandler = new ScriptHandler(ct);

      await scriptHandler.runAfterScript();

      expect(mockRunChildProcess).not.toHaveBeenCalled();

      expect(ct.logger.logOutput).toEqual(['No after script found.']);
    });
  });
});