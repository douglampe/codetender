import { FileHandler, IQuestionReader } from '../src/index';
import fs from 'fs';
import path from 'path';
import { rimraf } from 'rimraf';

export function testReaderFactory(map: Record<string, string>): () => IQuestionReader {
  return () => {
    return {
      question: async (prompt: string, callback: (answer: string) => void) => {
        if (prompt in map) {
          const response = map[prompt];
          callback(response);
        } else {
          callback(`Prompt '${prompt}' not found in map`);
        }
      },
      close: () => {},
    }
  };
}

export async function remove(file: string) {
  const stat = await exists(file);

  if (stat) {
    await rimraf(file);
  }
}

// Asynchronously check if a path exists
async function exists(path: string) {
  try {
    return await fs.promises.stat(path);
  } catch {}
}

export async function makeGitFile(folder: string) {
  await FileHandler.ensurePathExists(folder);
  // Copy from source to destination:
  await FileHandler.ensurePathExists(folder + '/.git');
  await fs.promises.writeFile(folder + '/.git/foo.txt', 'foo');
}

export async function isFile(file: string) {
  const stats = await exists(path.join(__dirname, file));

  if (!stats) {
    return false;
  }

  return stats.isFile();
}

export async function isDir(file: string) {
  const stat = await exists(path.join(__dirname, file));

  if (!stat) {
    return false;
  }
  
  return stat.isDirectory();
}

export async function fileContains(file: string, expected: string) {
  if (!isFile(file)) {
    console.log('Not file');
    return false;
  }

  try {
    const contents = await fs.promises.readFile(path.join(__dirname, file), 'utf8');
    return contents === expected;
  } catch (err) {
    console.log(err);
    return false;
  }
}