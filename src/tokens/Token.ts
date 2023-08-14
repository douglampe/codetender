export interface Token {
  pattern: string | RegExp;
  prompt?: string;
  replacement?: string;
  overwrite?: boolean;
}
