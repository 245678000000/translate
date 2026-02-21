import { useCallback, useState } from 'react';
import { Upload, FileText, ArrowUpFromLine } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
}

export function FileUpload({ onFileSelect, selectedFile }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file?.type === 'application/pdf') {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <label
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'relative flex flex-col items-center justify-center w-full h-60 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300',
          isDragging
            ? 'border-primary bg-primary/[0.06] scale-[1.03]'
            : selectedFile
            ? 'border-primary/40 bg-primary/[0.04]'
            : 'border-primary/20 bg-primary/[0.02] hover:border-primary/50 hover:bg-primary/[0.06] hover:scale-[1.01]'
        )}
      >
        <input
          type="file"
          accept=".pdf"
          onChange={handleChange}
          className="hidden"
        />
        <AnimatePresence mode="wait">
          {selectedFile ? (
            <motion.div
              key="selected"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · 点击重新选择
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center">
                <ArrowUpFromLine className="w-8 h-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">拖拽PDF文件到此处</p>
                <p className="text-sm text-muted-foreground mt-1.5">或点击选择文件</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </label>
    </motion.div>
  );
}
