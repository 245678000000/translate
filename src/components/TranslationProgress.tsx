import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, X, CheckCircle2, FileText, FileSpreadsheet, FileImage, FileCode, FileType, Download, RotateCcw, Package } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type FileTranslationStage = 'reading' | 'extracting' | 'translating' | 'generating' | 'done' | 'error';

export interface FileProgress {
  id: string;
  name: string;
  size: number;
  category: string;
  progress: number; // 0-100
  stage: FileTranslationStage;
}

interface TranslationProgressProps {
  files: FileProgress[];
  overallProgress: number;
  estimatedTimeLeft: number; // seconds
  providerName?: string;
  isComplete: boolean;
  onCancel: () => void;
  onDownloadAll?: () => void;
  onDownloadFile?: (id: string) => void;
  onReset?: () => void;
}

const STAGE_LABELS: Record<FileTranslationStage, string> = {
  reading: '正在读取文件...',
  extracting: '正在提取文本和格式...',
  translating: '正在AI翻译...',
  generating: '正在生成新文档...',
  done: '已完成 ✓',
  error: '处理失败',
};

const STAGE_PROGRESS: Record<FileTranslationStage, number> = {
  reading: 10,
  extracting: 25,
  translating: 60,
  generating: 85,
  done: 100,
  error: 0,
};

type FileCategory = 'pdf' | 'word' | 'ppt' | 'excel' | 'text' | 'html' | 'epub' | 'image' | 'data';

const ICON_MAP: Record<string, { icon: typeof FileText; colorClass: string }> = {
  pdf: { icon: FileText, colorClass: 'text-red-500 bg-red-500/10' },
  word: { icon: FileText, colorClass: 'text-blue-600 bg-blue-600/10' },
  ppt: { icon: FileType, colorClass: 'text-orange-500 bg-orange-500/10' },
  excel: { icon: FileSpreadsheet, colorClass: 'text-green-600 bg-green-600/10' },
  text: { icon: FileCode, colorClass: 'text-amber-500 bg-amber-500/10' },
  html: { icon: FileCode, colorClass: 'text-purple-500 bg-purple-500/10' },
  epub: { icon: FileText, colorClass: 'text-teal-500 bg-teal-500/10' },
  image: { icon: FileImage, colorClass: 'text-pink-500 bg-pink-500/10' },
  data: { icon: FileSpreadsheet, colorClass: 'text-cyan-500 bg-cyan-500/10' },
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(seconds: number) {
  if (seconds <= 0) return '即将完成';
  if (seconds < 60) return `约 ${Math.ceil(seconds)} 秒`;
  const mins = Math.ceil(seconds / 60);
  return `约 ${mins} 分钟`;
}

export function TranslationProgress({
  files,
  overallProgress,
  estimatedTimeLeft,
  providerName,
  isComplete,
  onCancel,
  onDownloadAll,
  onDownloadFile,
  onReset,
}: TranslationProgressProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-2xl mx-auto space-y-4 sm:space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-center flex-1">
          <AnimatePresence mode="wait">
            {isComplete ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 sm:w-9 sm:h-9 text-green-500" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-foreground">翻译完成！</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  共 {files.length} 个文件已翻译完毕
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="progress"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-7 h-7 text-primary animate-spin" />
                </div>
                <h2 className="text-lg font-bold text-foreground">正在翻译文档...</h2>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {providerName && (
          <span className="absolute right-0 top-0 text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
            使用 {providerName}
          </span>
        )}
      </div>

      {/* Overall progress */}
      {!isComplete && (
        <motion.div className="space-y-2" layout>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              总进度 {Math.round(overallProgress)}%
            </span>
            <span className="text-muted-foreground text-xs">
              {formatTime(estimatedTimeLeft)}
            </span>
          </div>
          <div className="relative h-4 sm:h-3 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-blue-400"
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          </div>
        </motion.div>
      )}

      {/* File list */}
      <div className="space-y-2 max-h-[50vh] sm:max-h-[40vh] overflow-y-auto pr-1">
        {files.map((file, i) => {
          const iconConfig = ICON_MAP[file.category] || ICON_MAP.text;
          const Icon = iconConfig.icon;
          const isDone = file.stage === 'done';
          const isError = file.stage === 'error';
          const isActive = !isDone && !isError && file.progress > 0;

          return (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl border transition-all duration-300',
                isDone
                  ? 'border-green-500/20 bg-green-500/[0.03]'
                  : isError
                    ? 'border-destructive/20 bg-destructive/[0.03]'
                    : isActive
                      ? 'border-primary/20 bg-primary/[0.03]'
                      : 'border-border bg-card'
              )}
            >
              {/* File icon */}
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', iconConfig.colorClass)}>
                <Icon className="w-5 h-5" />
              </div>

              {/* File info + progress */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  <span className="text-xs text-muted-foreground shrink-0">{formatSize(file.size)}</span>
                </div>

                {/* Thin progress bar */}
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className={cn(
                      'h-full rounded-full transition-colors duration-300',
                      isDone ? 'bg-green-500' : isError ? 'bg-destructive' : 'bg-primary'
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${file.progress}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                </div>

                {/* Stage label */}
                <div className="flex items-center justify-between">
                  <span className={cn(
                    'text-xs',
                    isDone ? 'text-green-600 dark:text-green-400 font-medium' :
                    isError ? 'text-destructive font-medium' :
                    'text-muted-foreground'
                  )}>
                    {STAGE_LABELS[file.stage]}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {Math.round(file.progress)}%
                  </span>
                </div>
              </div>

              {/* Download button when done */}
              {isDone && isComplete && onDownloadFile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => onDownloadFile(file.id)}
                  title="下载"
                >
                  <Download className="w-4 h-4" />
                </Button>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3 pt-2">
        {isComplete ? (
          <>
            {onDownloadAll && (
              <Button onClick={onDownloadAll} className="gap-2 bg-gradient-to-r from-primary to-blue-400 hover:opacity-90 w-full sm:w-auto min-h-[44px]">
                <Package className="w-4 h-4" />
                下载全部
              </Button>
            )}
            {onReset && (
              <Button variant="outline" onClick={onReset} className="gap-2 w-full sm:w-auto min-h-[44px]">
                <RotateCcw className="w-4 h-4" />
                返回首页
              </Button>
            )}
          </>
        ) : (
          <Button variant="outline" onClick={onCancel} className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive w-full sm:w-auto min-h-[44px]">
            <X className="w-4 h-4" />
            取消翻译
          </Button>
        )}
      </div>
    </motion.div>
  );
}
