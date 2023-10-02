export interface IQuestionReader {
  question: (prompt: string, callback: (answer: string) => void) => void;
  close: () => void;
}
