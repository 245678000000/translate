import { beforeEach, describe, expect, it } from 'vitest';
import {
  getActiveProviderConfig,
  getDefaultProvider,
  saveProviders,
  type TranslationProvider,
} from './providers';

const providers: TranslationProvider[] = [
  {
    id: 'ollama-1',
    name: 'My Ollama',
    type: 'ollama',
    baseUrl: 'http://localhost:11434/v1/chat/completions',
    model: 'llama3',
    enabled: true,
    isDefault: true,
  },
];

describe('providers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('selects default provider even when apiKey is empty', () => {
    saveProviders(providers);

    const defaultProvider = getDefaultProvider();
    const activeConfig = getActiveProviderConfig();

    expect(defaultProvider?.id).toBe('ollama-1');
    expect(activeConfig).toEqual({
      providerType: 'ollama',
      apiKey: undefined,
      baseUrl: 'http://localhost:11434/v1/chat/completions',
      model: 'llama3',
    });
  });
});
