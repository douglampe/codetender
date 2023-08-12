import { IQuestionReader } from '../src/index';

export function testReaderFactory(map: Record<string, string>): () => IQuestionReader {
  return () => {
    return {
      question: async (prompt: string) => {
        if (prompt in map) {
          const response = map[prompt];
          return Promise.resolve(response);
        } else {
          return Promise.reject(`Prompt '${prompt}' not found in map`);
        }
      },
    }
  };
}