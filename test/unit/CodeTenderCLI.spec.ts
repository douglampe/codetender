import pkgInfo from '../../package.json';

import { CodeTenderCLI } from '../../src/CodeTenderCLI';
import { CodeTenderConfig } from '../../src/config/CodeTenderConfig';

const mockCodeTender = {
  new: jest.fn(),
  add: jest.fn(),
  replace: jest.fn(),
};

const mockConstructor = jest.fn();

jest.mock('../../src/CodeTender', () => {
  return {
    CodeTender: function (config: CodeTenderConfig) {
      mockConstructor(config);
      return mockCodeTender;
    },
  };
});

describe('CodeTenderCLI', () => {
  const oldArgv = process.argv;

  afterEach(() => {
    process.argv = oldArgv;
    jest.resetAllMocks();
  });

  CodeTenderCLI.log = jest.fn();

  it('should display help', async () => {
    const log: Array<any> = [];

    jest.spyOn(process.stdout, 'write').mockImplementation((data, _cb) => {
      log.push(data);
      return true;
    });

    jest.spyOn(process.stderr, 'write').mockImplementation((data, _cb) => {
      log.push(data);
      return true;
    });

    CodeTenderCLI.isTest = true;

    process.argv = [];
    await expect(CodeTenderCLI.run()).rejects.toThrow('(outputHelp)');

    expect(log).toEqual([
      `Usage: codetender [options] [command]

Options:
  -i, --info                         Display current version number
  -h, --help                         display help for command

Commands:
  new [options] <template> <folder>  Copies contents of template to new folder then prompts for token replacement as needed
  add [options] <template> <folder>  Copies contents of template to an existing folder then prompts for token replacement as needed
  replace [options] <folder>         Prompts for token replacement and replaces tokens
  help [command]                     display help for command
`,
    ]);
  });

  it('should display version', async () => {
    const log: Array<any> = [];

    jest.spyOn(process.stdout, 'write').mockImplementation((data, _cb) => {
      log.push(data);
      return true;
    });

    jest.spyOn(process.stderr, 'write').mockImplementation((data, _cb) => {
      log.push(data);
      return true;
    });

    CodeTenderCLI.isTest = true;

    process.argv = ['node', 'codetender', '-i'];
    expect(CodeTenderCLI.run()).rejects.toThrow(pkgInfo.version);
  });

  it('should call new', async () => {
    CodeTenderCLI.isTest = true;

    const params: any = {};

    process.argv = ['node', 'codetender', 'new', '-v', 'template/path', 'output/folder'];
    await CodeTenderCLI.run();

    expect(mockConstructor).toHaveBeenCalledWith({
      template: 'template/path',
      folder: 'output/folder',
      verbose: true,
    });
    expect(mockCodeTender.new).toHaveBeenCalledWith();
  });

  it('should call add', async () => {
    CodeTenderCLI.isTest = true;

    const params: any = {};

    process.argv = ['node', 'codetender', 'add', 'template/path', 'output/folder'];
    await CodeTenderCLI.run();

    expect(mockConstructor).toHaveBeenCalledWith({
      template: 'template/path',
      folder: 'output/folder',
    });
    expect(mockCodeTender.add).toHaveBeenCalledWith();
  });

  it('should call replace', async () => {
    CodeTenderCLI.isTest = true;

    const params: any = {};

    process.argv = ['node', 'codetender', 'replace', 'process/folder'];
    await CodeTenderCLI.run();

    expect(mockConstructor).toHaveBeenCalledWith({
      folder: 'process/folder',
    });
    expect(mockCodeTender.replace).toHaveBeenCalledWith();
  });
});
