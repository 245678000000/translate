import { ArrowRightLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

export type TranslationDirection = 'zh-en' | 'en-zh';

interface LanguageSelectorProps {
  direction: TranslationDirection;
  onToggle: () => void;
}

export function LanguageSelector({ direction, onToggle }: LanguageSelectorProps) {
  const from = direction === 'zh-en' ? '中文' : 'English';
  const to = direction === 'zh-en' ? 'English' : '中文';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="flex items-center justify-center gap-4"
    >
      <div className="px-5 py-2.5 rounded-xl bg-muted font-medium text-sm min-w-[100px] text-center">
        {from}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
      >
        <ArrowRightLeft className="w-5 h-5" />
      </Button>
      <div className="px-5 py-2.5 rounded-xl bg-muted font-medium text-sm min-w-[100px] text-center">
        {to}
      </div>
    </motion.div>
  );
}
