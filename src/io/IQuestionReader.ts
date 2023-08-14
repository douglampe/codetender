export interface IQuestionReader {
  question: (prompt: string) => Promise<string>;
}
