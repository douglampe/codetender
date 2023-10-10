import path from 'path';
import { CodeTender } from '../../src/index';
import { isFile, isDir, remove } from '../Util';

describe('ignore', () => {
  process.chdir(path.join(__dirname, '..'));

  beforeAll(async () => {
    await remove('output/test-ignore');
    const ct = new CodeTender({
      folder: 'output/test-ignore',
      template: 'sample/ignore',
      file: 'sample/ignore/codetender.json',
      logger: jest.fn(),
      verbose: true,
    });

    await ct.new();
  });

  afterAll(async () => {
    await remove('output/test-ignore');
  });

  it('should ignore files matching ignore patterns', async () => {
    await expect(isDir('output/test-ignore/src/ignored-folder')).resolves.toEqual(false);
    await expect(isFile('output/test-ignore/src/ignored-folder/ignored-folder-file.txt')).resolves.toEqual(false);
    await expect(isFile('output/test-ignore/other/ignore-file.txt')).resolves.toEqual(false);
    await expect(isFile('output/test-ignore/README.md')).resolves.toEqual(false);
    await expect(isFile('output/test-ignore/.codetender')).resolves.toEqual(false);
  });

  it('keep files not ignored', async () => {
    await expect(isFile('output/test-ignore/src/test.txt')).resolves.toEqual(true);
  });
});
