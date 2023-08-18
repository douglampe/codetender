import path from 'path';
import { CodeTender, FileHandler } from '../../src/index';
import { makeGitFile, remove, fileContains } from '../Util';

describe('codetender add', () => {
  process.chdir(path.join(__dirname, '..'));

  afterAll(async () => {
    await remove('output/test-add');
  });

  it.each([true, false])('should handle existing files with overwrite %s', async (overwrite) => {
    await FileHandler.remove(`output/test-add/${overwrite}`);

    const ct = new CodeTender({
      folder: `output/test-add/${overwrite}`,
      template: 'sample/local',
      file: 'sample/local/codetender.json',
      logger: jest.fn(),
      verbose: true,
    });

    await makeGitFile(ct.config.folder);
    await FileHandler.copy('sample/add', ct.state.target.targetPath, true);

    ct.config.overwrite = overwrite;
    await ct.add();

    await expect(
      fileContains(
        `output/test-add/${overwrite}/still-here.txt`,
        'This existing file that does not match template should be unchanged so foo should still say foo.',
      ),
    ).resolves.toEqual(true);
    if (overwrite) {
      await expect(fileContains('output/test-add/true/README.md', '# This is a sample Served template.')).resolves.toEqual(true);
    } else {
      await expect(fileContains('output/test-add/false/README.md', 'This should be replaced with -o only.')).resolves.toEqual(true);
    }
  });
});
