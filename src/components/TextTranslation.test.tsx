import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextTranslation } from './TextTranslation';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

vi.mock('@/components/ui/sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

function getSignal(options: unknown): AbortSignal | undefined {
  if (!options || typeof options !== 'object') return undefined;
  return (options as { signal?: AbortSignal }).signal;
}

describe('TextTranslation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    invokeMock.mockReset();

    invokeMock.mockImplementation((_, options) => {
      const signal = getSignal(options);
      const callCount = invokeMock.mock.calls.length;

      if (callCount === 1) {
        return new Promise((resolve, reject) => {
          if (!signal) {
            reject(new Error('Missing abort signal'));
            return;
          }

          if (signal.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
          }

          signal.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true }
          );
        });
      }

      return Promise.resolve({
        data: { translatedText: 'world' },
        error: null,
      });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes AbortSignal and aborts previous in-flight request', async () => {
    render(<TextTranslation />);

    const sourceInput = screen.getByPlaceholderText('输入要翻译的文本...');

    fireEvent.change(sourceInput, { target: { value: 'hello' } });
    await act(async () => {
      vi.advanceTimersByTime(801);
      await Promise.resolve();
    });

    expect(invokeMock).toHaveBeenCalledTimes(1);
    const firstSignal = getSignal(invokeMock.mock.calls[0][1]);
    expect(firstSignal).toBeDefined();
    expect(firstSignal?.aborted).toBe(false);

    fireEvent.change(sourceInput, { target: { value: 'hello again' } });
    await act(async () => {
      vi.advanceTimersByTime(801);
      await Promise.resolve();
    });

    expect(invokeMock).toHaveBeenCalledTimes(2);

    const secondSignal = getSignal(invokeMock.mock.calls[1][1]);
    expect(firstSignal?.aborted).toBe(true);
    expect(secondSignal).toBeDefined();
    expect(secondSignal?.aborted).toBe(false);
  });
});
