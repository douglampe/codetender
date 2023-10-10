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

  beforeEach(() => {
    CodeTenderCLI.isTest = true;
    CodeTenderCLI.log = jest.fn();
  });

  afterEach(async () => {
    process.argv = oldArgv;
    jest.resetAllMocks();
  });

  it('should display help', async () => {
    const log: Array<string> = [];

    jest.spyOn(CodeTenderCLI, 'log').mockImplementation((message) => {
      log.push(message);
      return true;
    });

    process.argv = [];
    await expect(CodeTenderCLI.run()).rejects.toThrow('(outputHelp)');

    expect(log).toEqual([
      `Usage: codetender [options] [command]

Options:
  -?, --info                         Display current version number
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
    const log: Array<string> = [];

    jest.spyOn(CodeTenderCLI, 'log').mockImplementation((message) => {
      log.push(message);
      return true;
    });

    process.argv = ['node', 'codetender', '-?'];
    await expect(CodeTenderCLI.run()).rejects.toThrow(pkgInfo.version);
  });

  it('should call new', async () => {
    process.argv = ['node', 'codetender', 'new', '-v', 'template/path', 'output/folder'];
    await CodeTenderCLI.run();

    expect(mockConstructor).toHaveBeenCalledWith({
      template: 'template/path',
      folder: 'output/folder',
      verbose: true,
      include: [],
    });
    expect(mockCodeTender.new).toHaveBeenCalledWith();
  });

  it('should call add', async () => {
    process.argv = ['node', 'codetender', 'add', 'template/path', 'output/folder'];
    await CodeTenderCLI.run();

    expect(mockConstructor).toHaveBeenCalledWith({
      template: 'template/path',
      folder: 'output/folder',
      include: [],
    });
    expect(mockCodeTender.add).toHaveBeenCalledWith();
  });

  it('should call replace', async () => {
    process.argv = ['node', 'codetender', 'replace', 'process/folder'];
    await CodeTenderCLI.run();

    expect(mockConstructor).toHaveBeenCalledWith({
      folder: 'process/folder',
      include: [],
    });
    expect(mockCodeTender.replace).toHaveBeenCalledWith();
  });

  it.each(['new', 'add'])('should parse -i or --include for %s', async (action) => {
    process.argv = ['node', 'codetender', action, 'template/path', 'output/folder', '-i', 'file1', '-i', 'file2'];
    await CodeTenderCLI.run();

    expect(mockConstructor).toHaveBeenCalledWith({
      template: 'template/path',
      folder: 'output/folder',
      include: ['file1', 'file2'],
    });
  });

  it('should parse -i or --include for replace', async () => {
    process.argv = ['node', 'codetender', 'replace', 'process/folder', '-i', 'file1', '-i', 'file2'];
    await CodeTenderCLI.run();

    expect(mockConstructor).toHaveBeenCalledWith({
      folder: 'process/folder',
      include: ['file1', 'file2'],
    });
  });

  it.each(['new', 'add'])('should output arguments if verbose is enabled for %s', async (action) => {
    const log: Array<string> = [];

    jest.spyOn(CodeTenderCLI, 'log').mockImplementation((message) => {
      log.push(message);
      return true;
    });
    
    process.argv = ['node', 'codetender', action, 'template/path', 'output/folder', '-v'];
    await CodeTenderCLI.run();

    expect(log).toEqual([
      'Debug output enabled.',
      'Command Line Arguments:',
      '  Template: template/path',
      '  Folder: output/folder',
      '  Debug: true',
    ]);
  });

  it('should parse -i or --include for replace', async () => {
    const log: Array<string> = [];

    jest.spyOn(CodeTenderCLI, 'log').mockImplementation((message) => {
      log.push(message);
      return true;
    });
    
    process.argv = ['node', 'codetender', 'replace', 'process/folder', '-v'];
    await CodeTenderCLI.run();

    expect(log).toEqual([
      'Debug output enabled.',
      'Command Line Arguments:',
      '  Folder: process/folder',
      '  Debug: true',
    ]);
  });
});
