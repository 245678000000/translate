import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Languages } from 'lucide-react';
import { ApiKeySettings, getStoredApiKey } from '@/components/ApiKeySettings';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/FileUpload';
import { LanguageSelector, type TranslationDirection } from '@/components/LanguageSelector';
import { TranslationProgress } from '@/components/TranslationProgress';
import { TranslationResult } from '@/components/TranslationResult';
import { extractPDFContent, groupIntoParagraphs, type PDFInfo } from '@/lib/pdf-utils';
import { exportTranslatedPDF, type TranslatedPage } from '@/lib/pdf-export';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';

type AppState = 'upload' | 'translating' | 'done';

const Index = () => {
  const [state, setState] = useState<AppState>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [pdfInfo, setPdfInfo] = useState<PDFInfo | null>(null);
  const [direction, setDirection] = useState<TranslationDirection>('zh-en');
  const [currentPage, setCurrentPage] = useState(0);
  const [currentPreview, setCurrentPreview] = useState('');
  const [translatedPages, setTranslatedPages] = useState<TranslatedPage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasCustomKey, setHasCustomKey] = useState(() => !!getStoredApiKey());
  const cancelRef = useRef(false);

  const handleFileSelect = useCallback(async (f: File) => {
    setFile(f);
    setIsLoading(true);
    try {
      const info = await extractPDFContent(f);
      setPdfInfo(info);
      if (info.numPages === 0 || info.pages.every(p => !p.text.trim())) {
        toast.error('无法提取PDF文本内容，请确认PDF包含可选择的文字。');
        setFile(null);
        setPdfInfo(null);
      }
    } catch {
      toast.error('PDF解析失败，请检查文件是否损坏。');
      setFile(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startTranslation = useCallback(async () => {
    if (!pdfInfo) return;
    setState('translating');
    cancelRef.current = false;
    setTranslatedPages([]);
    const results: TranslatedPage[] = [];

    for (let i = 0; i < pdfInfo.pages.length; i++) {
      if (cancelRef.current) break;
      const page = pdfInfo.pages[i];
      setCurrentPage(i + 1);

      if (!page.text.trim()) {
        results.push({ pageNumber: page.pageNumber, originalText: '', translatedText: '', pageWidth: page.width, pageHeight: page.height });
        continue;
      }

      try {
        const keyConfig = getStoredApiKey();
        const body: Record<string, string> = { text: page.text, direction };
        if (keyConfig) {
          body.customApiKey = keyConfig.apiKey;
          if (keyConfig.baseUrl) body.customBaseUrl = keyConfig.baseUrl;
        }

        const { data, error } = await supabase.functions.invoke('translate', {
          body,
        });

        if (error) throw error;

        const translated = data?.translatedText || '';
        const paragraphs = groupIntoParagraphs(page.textItems, page.height);
        results.push({
          pageNumber: page.pageNumber,
          originalText: page.text,
          translatedText: translated,
          pageWidth: page.width,
          pageHeight: page.height,
          paragraphs,
        });
        setCurrentPreview(translated);
      } catch (err: any) {
        if (cancelRef.current) break;
        toast.error(`第 ${page.pageNumber} 页翻译失败: ${err.message || '未知错误'}`);
        results.push({
          pageNumber: page.pageNumber,
          originalText: page.text,
          translatedText: `[翻译失败] ${page.text}`,
          pageWidth: page.width,
          pageHeight: page.height,
        });
      }
    }

    if (!cancelRef.current) {
      setTranslatedPages(results);
      setState('done');
    }
  }, [pdfInfo, direction]);

  const handleCancel = () => {
    cancelRef.current = true;
    setState('upload');
    setCurrentPage(0);
    setCurrentPreview('');
  };

  const handleExport = async () => {
    if (translatedPages.length === 0 || !file) return;
    toast.info('正在生成PDF...');
    await exportTranslatedPDF(translatedPages, file.name);
    toast.success('PDF已开始下载');
  };

  const handleReset = () => {
    setState('upload');
    setFile(null);
    setPdfInfo(null);
    setTranslatedPages([]);
    setCurrentPage(0);
    setCurrentPreview('');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Languages className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">AI PDF 翻译</h1>
          </div>
          <ApiKeySettings onKeyChange={setHasCustomKey} />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          {state === 'upload' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-foreground tracking-tight">
                  智能PDF翻译
                </h2>
                <p className="text-muted-foreground">
                  上传PDF文件，AI自动翻译并导出为新的PDF
                </p>
              </div>

              <FileUpload onFileSelect={handleFileSelect} selectedFile={file} />

              {pdfInfo && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <p className="text-center text-sm text-muted-foreground">
                    共 {pdfInfo.numPages} 页
                  </p>
                  <LanguageSelector
                    direction={direction}
                    onToggle={() =>
                      setDirection((d) => (d === 'zh-en' ? 'en-zh' : 'zh-en'))
                    }
                  />
                  <div className="flex justify-center">
                    <Button
                      size="lg"
                      onClick={startTranslation}
                      disabled={isLoading}
                      className="px-10 rounded-xl text-base"
                    >
                      开始翻译
                    </Button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {state === 'translating' && (
            <TranslationProgress
              currentPage={currentPage}
              totalPages={pdfInfo?.numPages || 0}
              currentText={currentPreview}
              onCancel={handleCancel}
              usingCustomKey={hasCustomKey}
            />
          )}

          {state === 'done' && (
            <TranslationResult
              pages={translatedPages}
              onExport={handleExport}
              onReset={handleReset}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <p className="text-center text-xs text-muted-foreground">
          Powered by AI · 支持中英文互译
        </p>
      </footer>
    </div>
  );
};

export default Index;
