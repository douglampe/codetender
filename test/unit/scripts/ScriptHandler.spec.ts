import { CodeTender, ScriptHandler } from '../../../src/index';

describe('ScriptHandler', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('runBeforeScript()', () => {
    it.each(['before.js', ['before.js']])('should call runChildProcess for %s', async (before) => {
      const ct = new CodeTender({
        folder: 'foo',
        scripts: {
          before,
        },
        verbose: true,
        logger: jest.fn(),
      });
      ct.state.process.processPath = '/temp';

      const mockRunChildProcess = jest.spyOn(ct, 'runChildProcess').mockReturnValueOnce(undefined as never);

      const scriptHandler = new ScriptHandler(ct);

      await scriptHandler.runBeforeScript();

      expect(mockRunChildProcess).toHaveBeenCalledWith('before.js', '/temp');
    });

    it('should do nothing if no script for', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        verbose: true,
        logger: jest.fn(),
      });
      ct.state.process.processPath = '/temp';

      const mockRunChildProcess = jest.spyOn(ct, 'runChildProcess').mockReturnValueOnce(undefined as never);

      const scriptHandler = new ScriptHandler(ct);

      await scriptHandler.runBeforeScript();

      expect(mockRunChildProcess).not.toHaveBeenCalled();

      expect(ct.logger.logOutput).toEqual(['No before script found.']);
    });
  });

  describe('runAfterScript()', () => {
    it.each(['after.js', ['after.js']])('should call runChildProcess', async (after) => {
      const ct = new CodeTender({
        folder: 'foo',
        scripts: {
          after,
        },
        verbose: true,
        logger: jest.fn(),
      });
      ct.state.process.processPath = '/temp';

      const mockRunChildProcess = jest.spyOn(ct, 'runChildProcess').mockReturnValueOnce(undefined as never);

      const scriptHandler = new ScriptHandler(ct);

      await scriptHandler.runAfterScript();

      expect(mockRunChildProcess).toHaveBeenCalledWith('after.js', '/temp');
    });

    it('should do nothing if no script', async () => {
      const ct = new CodeTender({
        folder: 'foo',
        verbose: true,
        logger: jest.fn(),
      });
      ct.state.process.processPath = '/temp';

      const mockRunChildProcess = jest.spyOn(ct, 'runChildProcess').mockReturnValueOnce(undefined as never);

      const scriptHandler = new ScriptHandler(ct);

      await scriptHandler.runAfterScript();

      expect(mockRunChildProcess).not.toHaveBeenCalled();

      expect(ct.logger.logOutput).toEqual(['No after script found.']);
    });
  });
});
