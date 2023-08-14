import { CodeTenderConfig, CodeTenderError, RemoteTemplateConfig, Token, TokenMapItem, Variable } from './index';

export interface CodeTenderState {
  config: {
    schemaVersion: string;
    originalConfig: CodeTenderConfig;
    configPaths: Array<string>;
  };
  source: {
    template: string;
    sourcePath: string;
    isLocalTemplate: boolean;
    remote: Array<RemoteTemplateConfig>;
  };
  target: {
    folder: string;
    targetPath: string;
  };
  process: {
    banner: Array<string>;
    processPath: string;
    tempPath: string;
    remoteRoot?: string;
    tokens: Array<Token>;
    variables: Array<Variable>;
    ignore: Array<string>;
    noReplace: Array<string>;
    scripts: {
      before: Array<string>;
      after: Array<string>;
    };
    delete: Array<string>;
    tokenMap: Record<string, TokenMapItem>;
  };
  output: {
    notReplacedFiles: Record<string, boolean>;
    errors: Array<CodeTenderError>;
  };
}
