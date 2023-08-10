import { Token } from '../tokens/Token';

export interface RemoteTemplateConfig {
  src: string;
  dest: string;
  tokens: Array<Token>;
}
