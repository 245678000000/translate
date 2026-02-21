import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { MultiFileUpload, type UploadedFile } from '@/components/MultiFileUpload';
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

async function extractTextFromFile(file: File): Promise<{ text: string; pages?: PDFInfo }> {
  const ext = file.name.toLowerCase().split('.').pop() || '';

  // PDF — use existing pdf.js extraction
  if (ext === 'pdf') {
    const info = await extractPDFContent(file);
    const text = info.pages.map(p => p.text).join('\n\n');
    return { text, pages: info };
  }

  // Plain text formats
  if (['txt', 'md', 'csv', 'json', 'html', 'htm', 'rtf'].includes(ext)) {
    const text = await file.text();
    // Strip HTML tags for .html/.htm
    if (['html', 'htm'].includes(ext)) {
      const div = document.createElement('div');
      div.innerHTML = text;
      return { text: div.textContent || div.innerText || '' };
    }
    return { text };
  }

  // For binary office formats (docx/pptx/xlsx/epub/odt) — read as text fallback
  // In a production app these would use server-side parsing; for now extract what we can
  if (['docx', 'pptx', 'xlsx', 'odt', 'epub'].includes(ext)) {
    try {
      // Try reading as text (works for some XML-based formats)
      const text = await file.text();
      // Extract text content from XML
      const stripped = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (stripped.length > 20) return { text: stripped };
    } catch { /* fall through */ }
    throw new Error(`暂不支持直接解析 .${ext} 格式，请转换为 PDF 或 TXT 后重试`);
  }

  // Images — placeholder for OCR (would need server-side OCR)
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
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPreview, setCurrentPreview] = useState('');
  const [translatedPages, setTranslatedPages] = useState<TranslatedPage[]>([]);
  const [activeFileName, setActiveFileName] = useState('');
  const [hasCustomKey] = useState(() => !!getActiveProviderConfig());
  const cancelRef = useRef(false);
  const [lastPdfFile, setLastPdfFile] = useState<File | null>(null);

  const startTranslation = useCallback(async () => {
    if (files.length === 0) return;
    setState('translating');
    cancelRef.current = false;
    setTranslatedPages([]);

    const allResults: TranslatedPage[] = [];
    let pageOffset = 0;

    // Calculate total "pages" (1 per file for non-PDF, actual pages for PDF)
    let total = 0;
    for (const uf of files) {
      total += uf.type === 'pdf' ? 1 : 1; // We'll update for PDFs during extraction
    }
    setTotalPages(files.length);

    for (let fi = 0; fi < files.length; fi++) {
      if (cancelRef.current) break;
      const uf = files[fi];
      setActiveFileName(uf.file.name);
      setCurrentPage(fi + 1);

      try {
        const { text, pages: pdfInfo } = await extractTextFromFile(uf.file);

        if (!text.trim()) {
          toast.error(`${uf.file.name}: 无法提取文本内容`);
          continue;
        }

        if (pdfInfo) {
          // PDF: translate page by page
          setTotalPages(prev => prev - 1 + pdfInfo.numPages);
          setLastPdfFile(uf.file);

          for (let i = 0; i < pdfInfo.pages.length; i++) {
            if (cancelRef.current) break;
            const page = pdfInfo.pages[i];
            setCurrentPage(fi + 1 + i);

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
            setCurrentPreview(translated);
          }
          pageOffset += pdfInfo.numPages;
        } else {
          // Non-PDF: translate as single block
          const translated = await translateText(text, sourceLang, targetLang);
          allResults.push({
            pageNumber: pageOffset + 1,
            originalText: text,
            translatedText: translated,
            pageWidth: 595,
            pageHeight: 842,
          });
          setCurrentPreview(translated);
          pageOffset += 1;
          setLastPdfFile(uf.file);
        }
      } catch (err: any) {
        if (cancelRef.current) break;
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
    setCurrentPage(0);
    setCurrentPreview('');
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
    setCurrentPage(0);
    setCurrentPreview('');
    setActiveFileName('');
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
              {/* Language selectors */}
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <LanguageDropdown value={sourceLang} onChange={setSourceLang} showAuto label="源语言" />
                <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
                <LanguageDropdown value={targetLang} onChange={setTargetLang} label="目标语言" />
              </div>

              {/* Time estimate */}
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

      {state === 'translating' && (
        <div className="space-y-2">
          {activeFileName && (
            <p className="text-center text-xs text-muted-foreground">
              正在处理：{activeFileName}
            </p>
          )}
          <TranslationProgress
            currentPage={currentPage}
            totalPages={totalPages}
            currentText={currentPreview}
            onCancel={handleCancel}
            usingCustomKey={hasCustomKey}
          />
        </div>
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
  }

  const { data, error } = await supabase.functions.invoke('translate', { body });
  if (error) throw error;
  return data?.translatedText || '';
}
