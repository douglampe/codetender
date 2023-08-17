import { IQuestionReader, RemoteTemplateConfig, ScriptsConfig, Token, Variable } from '../index';

export interface CodeTenderConfig {
  template?: string;
  folder: string;
  file?: string;
  tokens?: Array<Token>;
  remote?: Array<RemoteTemplateConfig>;
  noReplace?: Array<string>;
  ignore?: Array<string>;
  delete?: Array<string>;
  overwrite?: boolean;
  scripts?: ScriptsConfig;
  variables?: Array<Variable>;
  noSplash?: boolean;
  banner?: string | Array<string>;
  verbose?: boolean;
  quiet?: boolean;
  logger?: (message: any) => void;
  readerFactory?: () => IQuestionReader;
}
