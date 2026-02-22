export interface TranslationProvider {
  id: string;
  name: string;
  type: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  enabled: boolean;
  isDefault: boolean;
  isSystem?: boolean;
}

export type ProviderType =
  | 'openai'
  | 'gemini'
  | 'anthropic'
  | 'azure'
  | 'ollama'
  | 'deepseek'
  | 'qwen'
  | 'microsoft'
  | 'google-translate'
  | 'custom';

export interface ProviderTypeConfig {
  label: string;
  icon: string;
  color: string;
  defaultBaseUrl: string;
  models: string[];
  fields: ('apiKey' | 'baseUrl' | 'model')[];
}

export const PROVIDER_CONFIGS: Record<ProviderType, ProviderTypeConfig> = {
  openai: {
    label: 'OpenAI',
    icon: 'O',
    color: 'hsl(170 60% 45%)',
    defaultBaseUrl: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    fields: ['apiKey', 'baseUrl', 'model'],
  },
  gemini: {
    label: 'Gemini',
    icon: 'G',
    color: 'hsl(220 80% 56%)',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    fields: ['apiKey', 'model'],
  },
  anthropic: {
    label: 'Anthropic',
    icon: 'A',
    color: 'hsl(25 90% 55%)',
    defaultBaseUrl: 'https://api.anthropic.com/v1/messages',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'],
    fields: ['apiKey', 'baseUrl', 'model'],
  },
  azure: {
    label: 'Azure OpenAI',
    icon: 'Az',
    color: 'hsl(200 80% 50%)',
    defaultBaseUrl: '',
    models: ['gpt-4o', 'gpt-4o-mini'],
    fields: ['apiKey', 'baseUrl', 'model'],
  },
  ollama: {
    label: 'Ollama',
    icon: '🦙',
    color: 'hsl(0 0% 40%)',
    defaultBaseUrl: 'http://localhost:11434/v1/chat/completions',
    models: ['llama3', 'mistral', 'qwen2'],
    fields: ['baseUrl', 'model'],
  },
  deepseek: {
    label: 'DeepSeek',
    icon: 'D',
    color: 'hsl(210 70% 50%)',
    defaultBaseUrl: 'https://api.deepseek.com/v1/chat/completions',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    fields: ['apiKey', 'baseUrl', 'model'],
  },
  qwen: {
    label: '通义千问',
    icon: '千',
    color: 'hsl(260 60% 55%)',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
    fields: ['apiKey', 'baseUrl', 'model'],
  },
  microsoft: {
    label: 'Microsoft Translator',
    icon: 'M',
    color: 'hsl(200 80% 45%)',
    defaultBaseUrl: 'https://api.cognitive.microsofttranslator.com',
    models: [],
    fields: ['apiKey', 'baseUrl'],
  },
  'google-translate': {
    label: 'Google Cloud Translation',
    icon: 'G',
    color: 'hsl(140 60% 45%)',
    defaultBaseUrl: 'https://translation.googleapis.com',
    models: [],
    fields: ['apiKey'],
  },
  custom: {
    label: '自定义兼容API',
    icon: '⚙',
    color: 'hsl(0 0% 50%)',
    defaultBaseUrl: '',
    models: [],
    fields: ['apiKey', 'baseUrl', 'model'],
  },
};

const STORAGE_KEY = 'pdf-translate-providers';

export function getProviders(): TranslationProvider[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const providers = JSON.parse(raw) as TranslationProvider[];
    // Filter out legacy system providers
    return providers.filter(p => !p.isSystem);
  } catch {
    return [];
  }
}

export function saveProviders(providers: TranslationProvider[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(providers.filter(p => !p.isSystem)));
}

export function getDefaultProvider(): TranslationProvider | null {
  const providers = getProviders();
  const defaultP = providers.find(p => p.isDefault && p.enabled);
  if (defaultP && defaultP.apiKey) return defaultP;
  return null;
}

// Backward-compatible: used by TextTranslation & DocumentTranslation
export function getActiveProviderConfig(): { apiKey?: string; baseUrl?: string; providerType?: string } | null {
  const p = getDefaultProvider();
  if (!p) return null;
  return { apiKey: p.apiKey, baseUrl: p.baseUrl, providerType: p.type };
}
