import { describe, expect, it } from 'vitest';
import { buildTranslateRequestBody } from './providers';

describe('buildTranslateRequestBody', () => {
  it('always includes provider metadata for no-key providers', () => {
    const body = buildTranslateRequestBody({
      text: 'hello',
      sourceLang: 'en',
      targetLang: 'zh',
      providerConfig: {
        providerType: 'ollama',
        baseUrl: 'http://localhost:11434/v1/chat/completions',
        model: 'llama3',
      },
    });

    expect(body.providerType).toBe('ollama');
    expect(body.customBaseUrl).toBe('http://localhost:11434/v1/chat/completions');
    expect(body.model).toBe('llama3');
    expect(body.customApiKey).toBeUndefined();
  });

  it('includes customApiKey when provider has key', () => {
    const body = buildTranslateRequestBody({
      text: 'hello',
      sourceLang: 'en',
      targetLang: 'zh',
      providerConfig: {
        providerType: 'openai',
        apiKey: 'sk-test-123',
        baseUrl: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4o-mini',
      },
    });

    expect(body.customApiKey).toBe('sk-test-123');
    expect(body.providerType).toBe('openai');
    expect(body.customBaseUrl).toBe('https://api.openai.com/v1/chat/completions');
    expect(body.model).toBe('gpt-4o-mini');
  });
});
