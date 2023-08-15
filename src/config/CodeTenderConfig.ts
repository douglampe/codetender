import { IQuestionReader, RemoteTemplateConfig, ScriptsConfig, Token, Variable } from '../index';

export interface CodeTenderConfig {
  folder: string;
  template?: string;
  file?: string;
  logger?: (message: any) => void;
  tokens?: Array<Token>;
  remote?: Array<RemoteTemplateConfig>;
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
