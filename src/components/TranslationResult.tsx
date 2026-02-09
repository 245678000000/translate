import { motion } from 'framer-motion';
import { Download, RotateCcw, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { type TranslatedPage } from '@/lib/pdf-export';

interface TranslationResultProps {
  pages: TranslatedPage[];
  onExport: () => void;
  onReset: () => void;
}

export function TranslationResult({ pages, onExport, onReset }: TranslationResultProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto space-y-6"
    >
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
          <FileText className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">翻译完成</h2>
        <p className="text-sm text-muted-foreground">共 {pages.length} 页已翻译</p>
      </div>

      <ScrollArea className="h-72 rounded-xl border bg-card p-5">
        <div className="space-y-6">
          {pages.map((page) => (
            <div key={page.pageNumber} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">第 {page.pageNumber} 页</p>
              <p className="text-sm text-foreground leading-relaxed">
                {page.translatedText}
              </p>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="flex justify-center gap-3">
        <Button onClick={onExport} className="gap-2">
          <Download className="w-4 h-4" />
          导出 PDF
        </Button>
        <Button variant="outline" onClick={onReset} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          翻译新文件
        </Button>
      </div>
    </motion.div>
  );
}
