import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { MultiFileUpload, type UploadedFile } from '@/components/MultiFileUpload';
import { TranslationProgress, type FileProgress, type FileTranslationStage } from '@/components/TranslationProgress';
import { LanguageDropdown } from '@/components/LanguageDropdown';
import { ArrowRight } from 'lucide-react';
import { extractPDFContent, groupIntoParagraphs, type PDFInfo } from '@/lib/pdf-utils';
import { exportTranslatedPDF, type TranslatedPage } from '@/lib/pdf-export';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { getActiveProviderConfig, getDefaultProvider } from '@/lib/providers';

type DocState = 'upload' | 'translating' | 'done';

async function extractTextFromFile(file: File): Promise<{ text: string; pages?: PDFInfo }> {
  const ext = file.name.toLowerCase().split('.').pop() || '';
  if (ext === 'pdf') {
    const info = await extractPDFContent(file);
    const text = info.pages.map(p => p.text).join('\n\n');
    return { text, pages: info };
  }
  if (['txt', 'md', 'csv', 'json', 'html', 'htm', 'rtf'].includes(ext)) {
    const text = await file.text();
    if (['html', 'htm'].includes(ext)) {
      const div = document.createElement('div');
      div.innerHTML = text;
      return { text: div.textContent || div.innerText || '' };
    }
    return { text };
  }
  if (['docx', 'pptx', 'xlsx', 'odt', 'epub'].includes(ext)) {
    try {
      const text = await file.text();
      const stripped = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (stripped.length > 20) return { text: stripped };
    } catch { /* fall through */ }
    throw new Error(`暂不支持直接解析 .${ext} 格式，请转换为 PDF 或 TXT 后重试`);
  }
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
    throw new Error('图片 OCR 识别功能即将上线，请先转换为 PDF 或 TXT');
  }
  throw new Error(`不支持的文件格式: .${ext}`);
}

export function DocumentTranslation() {
  const [state, setState] = useState<DocState>('upload');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('en');
  const [fileProgresses, setFileProgresses] = useState<FileProgress[]>([]);
  const [translatedPages, setTranslatedPages] = useState<TranslatedPage[]>([]);
  const cancelRef = useRef(false);
  const [lastPdfFile, setLastPdfFile] = useState<File | null>(null);

  const providerName = (() => {
    const p = getDefaultProvider();
    return p ? p.name : '系统默认';
  })();

  const updateFileProgress = (id: string, updates: Partial<FileProgress>) => {
    setFileProgresses(prev => prev.map(fp => fp.id === id ? { ...fp, ...updates } : fp));
  };

  const overallProgress = fileProgresses.length > 0
    ? fileProgresses.reduce((sum, fp) => sum + fp.progress, 0) / fileProgresses.length
    : 0;

  const estimatedTimeLeft = Math.max(0, ((100 - overallProgress) / 100) * files.reduce((t, f) => t + Math.ceil(f.file.size / 1024 / 50), 0));

  const startTranslation = useCallback(async () => {
    if (files.length === 0) return;
    cancelRef.current = false;

    // Init file progresses
    const initProgresses: FileProgress[] = files.map(uf => ({
      id: uf.id,
      name: uf.file.name,
      size: uf.file.size,
      category: uf.type,
      progress: 0,
      stage: 'reading' as FileTranslationStage,
    }));
    setFileProgresses(initProgresses);
    setTranslatedPages([]);
    setState('translating');

    const allResults: TranslatedPage[] = [];
    let pageOffset = 0;

    for (let fi = 0; fi < files.length; fi++) {
      if (cancelRef.current) break;
      const uf = files[fi];

      // Stage: reading
      updateFileProgress(uf.id, { stage: 'reading', progress: 5 });
      await delay(300);

      try {
        // Stage: extracting
        updateFileProgress(uf.id, { stage: 'extracting', progress: 15 });
        const { text, pages: pdfInfo } = await extractTextFromFile(uf.file);

        if (!text.trim()) {
          updateFileProgress(uf.id, { stage: 'error', progress: 0 });
          toast.error(`${uf.file.name}: 无法提取文本内容`);
          continue;
        }

        // Stage: translating
        updateFileProgress(uf.id, { stage: 'translating', progress: 30 });

        if (pdfInfo) {
          setLastPdfFile(uf.file);
          const pageCount = pdfInfo.pages.length;
          for (let i = 0; i < pageCount; i++) {
            if (cancelRef.current) break;
            const page = pdfInfo.pages[i];
            const pct = 30 + ((i + 1) / pageCount) * 50;
            updateFileProgress(uf.id, { progress: pct });

            if (!page.text.trim()) {
              allResults.push({ pageNumber: pageOffset + page.pageNumber, originalText: '', translatedText: '', pageWidth: page.width, pageHeight: page.height });
              continue;
            }

            const translated = await translateText(page.text, sourceLang, targetLang);
            const paragraphs = groupIntoParagraphs(page.textItems, page.height);
            allResults.push({
              pageNumber: pageOffset + page.pageNumber,
              originalText: page.text,
              translatedText: translated,
              pageWidth: page.width,
              pageHeight: page.height,
              paragraphs,
            });
          }
          pageOffset += pdfInfo.numPages;
        } else {
          updateFileProgress(uf.id, { progress: 50 });
          const translated = await translateText(text, sourceLang, targetLang);
          allResults.push({
            pageNumber: pageOffset + 1,
            originalText: text,
            translatedText: translated,
            pageWidth: 595,
            pageHeight: 842,
          });
          pageOffset += 1;
          setLastPdfFile(uf.file);
        }

        // Stage: generating
        updateFileProgress(uf.id, { stage: 'generating', progress: 85 });
        await delay(400);

        // Stage: done
        updateFileProgress(uf.id, { stage: 'done', progress: 100 });
      } catch (err: any) {
        if (cancelRef.current) break;
        updateFileProgress(uf.id, { stage: 'error', progress: 0 });
        toast.error(`${uf.file.name}: ${err.message || '处理失败'}`);
      }
    }

    if (!cancelRef.current) {
      setTranslatedPages(allResults);
      setState('done');
    }
  }, [files, sourceLang, targetLang]);

  const handleCancel = () => {
    cancelRef.current = true;
    setState('upload');
    setFileProgresses([]);
  };

  const handleExport = async () => {
    if (translatedPages.length === 0) return;
    toast.info('正在生成PDF...');
    const fileName = files.length === 1 ? files[0].file.name : 'translated-documents';
    await exportTranslatedPDF(translatedPages, fileName);
    toast.success('PDF已开始下载');
  };

  const handleReset = () => {
    setState('upload');
    setFiles([]);
    setTranslatedPages([]);
    setFileProgresses([]);
  };

  const estimatedTime = Math.max(15, files.reduce((t, f) => t + Math.ceil(f.file.size / 1024 / 50), 0));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-6"
    >
      {state === 'upload' && (
        <>
          <MultiFileUpload files={files} onFilesChange={setFiles} />

          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <LanguageDropdown value={sourceLang} onChange={setSourceLang} showAuto label="源语言" />
                <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
                <LanguageDropdown value={targetLang} onChange={setTargetLang} label="目标语言" />
              </div>

              <p className="text-center text-xs text-muted-foreground">
                预计处理时间：约 {estimatedTime} 秒（共 {files.length} 个文件）
              </p>

              <div className="flex justify-center">
                <Button
                  size="lg"
                  onClick={startTranslation}
                  className="px-10 rounded-xl text-base bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity shadow-md"
                >
                  开始翻译
                </Button>
              </div>
            </motion.div>
          )}
        </>
      )}

      {(state === 'translating' || state === 'done') && (
        <TranslationProgress
          files={fileProgresses}
          overallProgress={overallProgress}
          estimatedTimeLeft={estimatedTimeLeft}
          providerName={providerName}
          isComplete={state === 'done'}
          onCancel={handleCancel}
          onDownloadAll={handleExport}
          onReset={handleReset}
        />
      )}
    </motion.div>
  );
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function translateText(text: string, sourceLang: string, targetLang: string): Promise<string> {
  const keyConfig = getActiveProviderConfig();
  const body: Record<string, string> = {
    text,
    direction: `${sourceLang}-${targetLang}`,
    sourceLang,
    targetLang,
  };
  if (keyConfig?.apiKey) {
    body.customApiKey = keyConfig.apiKey;
    if (keyConfig.baseUrl) body.customBaseUrl = keyConfig.baseUrl;
    if (keyConfig.providerType) body.providerType = keyConfig.providerType;
  }

  const { data, error } = await supabase.functions.invoke('translate', { body });
  if (error) throw error;
  return data?.translatedText || '';
}
