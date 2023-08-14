import path from 'path';
import { CodeTender, FileHandler } from '../../src/index';
import { isFile, isDir, makeGitFile, remove, fileContains } from '../Util';

describe('codetender replace', () => {
  process.chdir(path.join(__dirname, '..'));

  let ct: CodeTender;

  beforeAll(async () => {
    await FileHandler.remove('output/test-replace');
    ct = new CodeTender({
      folder: 'output/test-replace',
      template: 'sample/local',
      file: 'sample/local/codetender.json',
      tokens: [
        {
          pattern: 'CodeTender',
          prompt: 'This should be ignored based on -f',
        },
        {
          pattern: 'foo',
          replacement: 'bar',
        },
        {
          pattern: 'sub',
          replacement: 'folder',
        },
      ],
      logger: jest.fn(),
    });

    await makeGitFile(ct.config.folder);
    await FileHandler.copy(ct.state.source.sourcePath, ct.state.target.targetPath, true);

    await ct.replace();
  });

  afterAll(async () => {
    await remove('output/test-replace');
  });

  defineReplaceTests('test-replace');
});

export function defineReplaceTests(folder: string) {
  it('should rename files and folders', async () => {
    await expect(isFile(`output/${folder}/bar.js`)).resolves.toEqual(true);
    await expect(isDir(`output/${folder}/folder`)).resolves.toEqual(true);
    await expect(isDir(`output/${folder}/folder/deep-path/deep-bar-folder-Served-bar`)).resolves.toEqual(true);
  });

  it('should replace content', async () => {
    await expect(fileContains(`output/${folder}/folder/bar-something.txt`, 'This is a Served file in a folder to be renamed.')).resolves.toEqual(true);
    await expect(fileContains(`output/${folder}/README.md`, '# This is a sample Served template.')).resolves.toEqual(true);
  });

  it('should ignore noReplace patterns', async () => {
    await expect(isDir(`output/${folder}/noReplace-folder/sub`)).resolves.toEqual(true);
    await expect(fileContains(`output/${folder}/no-replace-file.txt`, 'foo')).resolves.toEqual(true);
    await expect(fileContains(`output/${folder}/noReplace-folder/sub/foo.txt`, 'foo')).resolves.toEqual(true);
    await expect(fileContains(`output/${folder}/foo/README.md`, '# This folder should still be called foo due to noReplace')).resolves.toEqual(true);
  });

  it('should delete files matching delete patterns', async () => {
    await expect(isFile(`output/${folder}/delete-file.txt`)).resolves.toEqual(false);
    await expect(isDir(`output/${folder}/delete-folder`)).resolves.toEqual(false);
  });
}
