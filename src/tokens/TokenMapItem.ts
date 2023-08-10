import { TokenMapFile } from './TokenMapFile';

export interface TokenMapItem {
  originalPattern: string;
  pattern?: string;
  replacement: string;
  count: number;
  files: Array<TokenMapFile>;
  renamed: Array<TokenMapFile>;
  overwrite?: boolean;
}
