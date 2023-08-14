import readline from 'readline/promises';
import { ScriptsConfig } from '../scripts/ScriptsConfig';
import { Token } from '../tokens/Token';
import { Variable } from '../Variable';
import { RemoteTemplateConfig } from './RemoteTemplateConfig';
import { IQuestionReader } from 'src/io/IQuestionReader';

export interface CodeTenderConfig {
  folder: string;
  template?: string;
  file?: string;
  logger?: (message: any) => void;
  tokens?: Array<Token>;
  remote?: Array<RemoteTemplateConfig>;
  include?: Array<string>;
  noReplace?: Array<string>;
  ignore?: Array<string>;
  delete?: Array<string>;
  banner?: string | Array<string>;
  overwrite?: boolean;
  scripts?: ScriptsConfig;
  variables?: Array<Variable>;
  noSplash?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  readerFactory?: () => IQuestionReader;
}
