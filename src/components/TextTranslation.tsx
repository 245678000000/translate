import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRightLeft, Copy, Check, Trash2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { getStoredApiKey } from '@/components/ApiKeySettings';
import { LanguageDropdown, LANGUAGES } from '@/components/LanguageDropdown';

export function TextTranslation() {
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();

  const translate = useCallback(async (text: string) => {
    if (!text.trim()) {
      setTranslatedText('');
      return;
    }

    setIsTranslating(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const keyConfig = getStoredApiKey();
      const body: Record<string, string> = {
        text,
        direction: `${sourceLang}-${targetLang}`,
        sourceLang,
        targetLang,
      };
      if (keyConfig) {
        body.customApiKey = keyConfig.apiKey;
        if (keyConfig.baseUrl) body.customBaseUrl = keyConfig.baseUrl;
      }

      const { data, error } = await supabase.functions.invoke('translate', { body });
      if (error) throw error;
      setTranslatedText(data?.translatedText || '');
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast.error(`翻译失败: ${err.message || '未知错误'}`);
      }
    } finally {
      setIsTranslating(false);
    }
  }, [sourceLang, targetLang]);

  const handleInputChange = (text: string) => {
    setSourceText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setTranslatedText('');
      return;
    }
    debounceRef.current = setTimeout(() => translate(text), 800);
  };

  const handleSwap = () => {
    if (sourceLang === 'auto') return;
    const tmpLang = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(tmpLang);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  };

  const handleCopy = async () => {
    if (!translatedText) return;
    await navigator.clipboard.writeText(translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTranslateClick = () => {
    if (sourceText.trim()) translate(sourceText);
  };

  const insertExample = () => {
    const example = '人工智能正在深刻改变我们的工作和生活方式。从自动驾驶到智能翻译，AI技术的应用无处不在。';
    setSourceText(example);
    setSourceLang('zh');
    setTargetLang('en');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => translate(example), 300);
  };

  // Re-translate when language changes (if there's text)
  useEffect(() => {
    if (sourceText.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => translate(sourceText), 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceLang, targetLang]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full"
    >
      {/* Language bar */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <LanguageDropdown
          value={sourceLang}
          onChange={setSourceLang}
          showAuto
          label="源语言"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSwap}
          disabled={sourceLang === 'auto'}
          className="rounded-full hover:bg-primary/10 shrink-0"
        >
          <ArrowRightLeft className="w-5 h-5" />
        </Button>
        <LanguageDropdown
          value={targetLang}
          onChange={setTargetLang}
          label="目标语言"
        />
      </div>

      {/* Dual pane */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-0 rounded-2xl border border-border overflow-hidden bg-card">
        {/* Source */}
        <div className="relative md:border-r border-b md:border-b-0 border-border">
          <Textarea
            value={sourceText}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="输入要翻译的文本..."
            className="min-h-[240px] sm:min-h-[300px] border-0 rounded-none resize-none focus-visible:ring-0 text-base p-5 bg-transparent"
          />
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
            <div className="flex gap-1">
              {!sourceText && (
                <Button variant="ghost" size="sm" onClick={insertExample} className="text-xs text-muted-foreground gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  插入示例
                </Button>
              )}
              {sourceText && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => { setSourceText(''); setTranslatedText(''); }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{sourceText.length}</span>
          </div>
        </div>

        {/* Target */}
        <div className="relative bg-muted/30">
          <Textarea
            value={translatedText}
            readOnly
            placeholder={isTranslating ? '翻译中...' : '译文将在此显示...'}
            className="min-h-[240px] sm:min-h-[300px] border-0 rounded-none resize-none focus-visible:ring-0 text-base p-5 bg-transparent"
          />
          <div className="absolute bottom-3 right-4 flex gap-1">
            {translatedText && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={handleCopy}>
                {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
              </Button>
            )}
          </div>
          {isTranslating && (
            <div className="absolute top-4 right-4">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Translate button */}
      <div className="flex justify-end mt-4">
        <Button
          onClick={handleTranslateClick}
          disabled={!sourceText.trim() || isTranslating}
          className="px-8 rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity shadow-md"
        >
          翻译
        </Button>
      </div>
    </motion.div>
  );
}
