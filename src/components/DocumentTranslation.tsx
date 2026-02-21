import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/FileUpload';
import { TranslationProgress } from '@/components/TranslationProgress';
import { TranslationResult } from '@/components/TranslationResult';
import { LanguageDropdown } from '@/components/LanguageDropdown';
import { ArrowRight } from 'lucide-react';
import { extractPDFContent, groupIntoParagraphs, type PDFInfo } from '@/lib/pdf-utils';
import { exportTranslatedPDF, type TranslatedPage } from '@/lib/pdf-export';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { getActiveProviderConfig } from '@/lib/providers';

type DocState = 'upload' | 'translating' | 'done';

export function DocumentTranslation() {
  const [state, setState] = useState<DocState>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [pdfInfo, setPdfInfo] = useState<PDFInfo | null>(null);
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('en');
  const [currentPage, setCurrentPage] = useState(0);
  const [currentPreview, setCurrentPreview] = useState('');
  const [translatedPages, setTranslatedPages] = useState<TranslatedPage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasCustomKey] = useState(() => !!getActiveProviderConfig());
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
        const keyConfig = getActiveProviderConfig();
        const body: Record<string, string> = {
          text: page.text,
          direction: `${sourceLang}-${targetLang}`,
          sourceLang,
          targetLang,
        };
        if (keyConfig?.apiKey) {
          body.customApiKey = keyConfig.apiKey;
          if (keyConfig.baseUrl) body.customBaseUrl = keyConfig.baseUrl;
        }

        const { data, error } = await supabase.functions.invoke('translate', { body });
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
  }, [pdfInfo, sourceLang, targetLang]);

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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-6"
    >
      {state === 'upload' && (
        <>
          <FileUpload onFileSelect={handleFileSelect} selectedFile={file} />

          {pdfInfo && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <p className="text-center text-sm text-muted-foreground">
                共 {pdfInfo.numPages} 页
              </p>

              {/* Language selectors */}
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <LanguageDropdown value={sourceLang} onChange={setSourceLang} showAuto label="源语言" />
                <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
                <LanguageDropdown value={targetLang} onChange={setTargetLang} label="目标语言" />
              </div>

              <div className="flex justify-center">
                <Button
                  size="lg"
                  onClick={startTranslation}
                  disabled={isLoading}
                  className="px-10 rounded-xl text-base bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity shadow-md"
                >
                  开始翻译
                </Button>
              </div>
            </motion.div>
          )}
        </>
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
    </motion.div>
  );
}
