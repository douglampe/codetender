import path from 'path';
import { CodeTender } from '../../src/index';
import { isFile, isDir, remove, fileContains } from '../Util';
import { defineReplaceTests } from './CodetenderReplace.spec';

describe('codetender new', () => {
  process.chdir(path.join(__dirname, '..'));

  beforeAll(async () => {
    await remove('output/test-new');
    const ct = new CodeTender({
      folder: 'output/test-new',
      template: 'sample/local',
      file: 'sample/local/codetender.json',
      logger: jest.fn(),
      verbose: true,
    });

    await ct.new();
  });

  afterAll(async () => {
    // await remove('output/test-new');
  });

  it('should handle .codetender configs', async () => {
    await expect(isFile('output/test-new/codetender-before.js')).resolves.toEqual(false);
    await expect(isFile('output/test-new/codetender-after.js')).resolves.toEqual(false);
    await expect(fileContains('output/test-new/test-new.txt', 'test-new')).resolves.toEqual(true);
    await expect(fileContains('output/test-new/test-new-something-else.txt', 'test-new-something-else')).resolves.toEqual(true);
  });

  it('should ignore files matching ignore patterns', async () => {
    await expect(isDir('output/test-new/ignored-folder')).resolves.toEqual(false);
    await expect(isFile('output/test-new/ignore-file.txt')).resolves.toEqual(false);
  });

  it('should run scripts', async () => {
    await expect(fileContains('output/test-new/before.txt', 'bar')).resolves.toEqual(true);
    await expect(fileContains('output/test-new/after.txt', 'foo')).resolves.toEqual(true);
  });

  defineReplaceTests('test-new');
});
