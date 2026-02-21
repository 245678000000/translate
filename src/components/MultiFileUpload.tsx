import { useCallback, useState, useRef } from 'react';
import {
  FileText, FileSpreadsheet, FileImage, FileCode, FileType,
  ArrowUpFromLine, X, File as FileIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';

const ACCEPTED_EXTENSIONS = [
  '.pdf', '.docx', '.doc', '.pptx', '.ppt', '.xlsx', '.xls',
  '.txt', '.md', '.rtf', '.odt', '.html', '.htm', '.epub',
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
  '.csv', '.json',
];

const ACCEPT_STRING = ACCEPTED_EXTENSIONS.join(',');
const MAX_FILES = 10;
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB

export interface UploadedFile {
  id: string;
  file: File;
  type: FileCategory;
}

type FileCategory = 'pdf' | 'word' | 'ppt' | 'excel' | 'text' | 'html' | 'epub' | 'image' | 'data';

function categorizeFile(name: string): FileCategory {
  const ext = name.toLowerCase().split('.').pop() || '';
  if (ext === 'pdf') return 'pdf';
  if (['docx', 'doc', 'rtf', 'odt'].includes(ext)) return 'word';
  if (['pptx', 'ppt'].includes(ext)) return 'ppt';
  if (['xlsx', 'xls'].includes(ext)) return 'excel';
  if (['txt', 'md'].includes(ext)) return 'text';
  if (['html', 'htm'].includes(ext)) return 'html';
  if (ext === 'epub') return 'epub';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image';
  if (['csv', 'json'].includes(ext)) return 'data';
  return 'text';
}

const FILE_ICON_CONFIG: Record<FileCategory, { icon: typeof FileText; colorClass: string; label: string }> = {
  pdf: { icon: FileText, colorClass: 'text-red-500 bg-red-500/10', label: 'PDF' },
  word: { icon: FileText, colorClass: 'text-blue-600 bg-blue-600/10', label: 'Word' },
  ppt: { icon: FileType, colorClass: 'text-orange-500 bg-orange-500/10', label: 'PPT' },
  excel: { icon: FileSpreadsheet, colorClass: 'text-green-600 bg-green-600/10', label: 'Excel' },
  text: { icon: FileCode, colorClass: 'text-amber-500 bg-amber-500/10', label: 'TXT' },
  html: { icon: FileCode, colorClass: 'text-purple-500 bg-purple-500/10', label: 'HTML' },
  epub: { icon: FileText, colorClass: 'text-teal-500 bg-teal-500/10', label: 'EPUB' },
  image: { icon: FileImage, colorClass: 'text-pink-500 bg-pink-500/10', label: '图片' },
  data: { icon: FileSpreadsheet, colorClass: 'text-cyan-500 bg-cyan-500/10', label: '数据' },
};

interface MultiFileUploadProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function MultiFileUpload({ files, onFilesChange }: MultiFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const valid = arr.filter(f => {
      const ext = '.' + f.name.toLowerCase().split('.').pop();
      return ACCEPTED_EXTENSIONS.includes(ext);
    });

    if (valid.length === 0) {
      toast.error('不支持的文件格式');
      return;
    }

    const combined = [...files.map(u => u.file), ...valid];
    if (combined.length > MAX_FILES) {
      toast.error(`最多支持 ${MAX_FILES} 个文件`);
      return;
    }

    const totalSize = combined.reduce((s, f) => s + f.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
      toast.error('文件总大小不能超过 100MB');
      return;
    }

    const newUploaded: UploadedFile[] = valid.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      type: categorizeFile(f.name),
    }));
    onFilesChange([...files, ...newUploaded]);
  }, [files, onFilesChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  };

  const removeFile = (id: string) => {
    onFilesChange(files.filter(f => f.id !== id));
  };

  const hasFiles = files.length > 0;
  const totalSize = files.reduce((s, f) => s + f.file.size, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-3"
    >
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center w-full rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300',
          hasFiles ? 'h-32' : 'h-52',
          isDragging
            ? 'border-primary bg-primary/[0.06] scale-[1.02]'
            : 'border-primary/20 bg-primary/[0.02] hover:border-primary/50 hover:bg-primary/[0.06]'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_STRING}
          multiple
          onChange={handleChange}
          className="hidden"
        />
        <div className={cn("flex flex-col items-center", hasFiles ? "gap-1.5" : "gap-3")}>
          <div className={cn(
            "rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center",
            hasFiles ? "w-10 h-10" : "w-14 h-14"
          )}>
            <ArrowUpFromLine className={cn(hasFiles ? "w-5 h-5" : "w-7 h-7", "text-primary")} />
          </div>
          <div className="text-center">
            <p className={cn("font-semibold text-foreground", hasFiles ? "text-sm" : "text-base")}>
              {hasFiles ? '继续添加文件' : '拖拽文档到此处'}
            </p>
            {!hasFiles && (
              <p className="text-sm text-muted-foreground mt-1">或点击选择文件</p>
            )}
          </div>
        </div>
      </div>

      {/* Format hint */}
      <p className="text-xs text-primary text-center font-medium">
        支持 PDF、Word、PowerPoint、Excel、TXT、MD、HTML、EPUB、图片等 20+ 格式
      </p>

      {/* File list */}
      <AnimatePresence>
        {hasFiles && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>{files.length} 个文件 · 共 {formatSize(totalSize)}</span>
              <span>最多 {MAX_FILES} 个 · 总大小 ≤ 100MB</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {files.map((uf) => {
                const iconConfig = FILE_ICON_CONFIG[uf.type];
                const Icon = iconConfig.icon;
                return (
                  <motion.div
                    key={uf.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border bg-card"
                  >
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', iconConfig.colorClass)}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{uf.file.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {iconConfig.label} · {formatSize(uf.file.size)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(uf.id); }}
                      className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Keep old single-file export for backward compat
export { categorizeFile, formatSize, ACCEPTED_EXTENSIONS };
export type { FileCategory };
