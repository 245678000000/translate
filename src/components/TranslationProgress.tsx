import { motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

interface TranslationProgressProps {
  currentPage: number;
  totalPages: number;
  currentText: string;
  onCancel: () => void;
  usingCustomKey?: boolean;
}

export function TranslationProgress({
  currentPage,
  totalPages,
  currentText,
  onCancel,
  usingCustomKey = false,
}: TranslationProgressProps) {
  const progress = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto space-y-6"
    >
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-primary">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="font-medium">正在翻译...</span>
        </div>
        <p className="text-sm text-muted-foreground">
          第 {currentPage} / {totalPages} 页
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
          当前使用：{usingCustomKey ? '你的自定义 API Key' : '系统默认 Key'}
        </p>

      <Progress value={progress} className="h-2" />

      {currentText && (
        <motion.div
          key={currentPage}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl bg-muted/50 p-5 max-h-48 overflow-y-auto"
        >
          <p className="text-xs text-muted-foreground mb-2">当前翻译预览</p>
          <p className="text-sm text-foreground leading-relaxed line-clamp-6">
            {currentText}
          </p>
        </motion.div>
      )}

      <div className="flex justify-center">
        <Button variant="outline" onClick={onCancel} className="gap-2">
          <X className="w-4 h-4" />
          取消翻译
        </Button>
      </div>
    </motion.div>
  );
}
