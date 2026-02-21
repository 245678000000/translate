import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export const LANGUAGES = [
  { code: 'auto', label: '自动检测' },
  { code: 'zh', label: '中文' },
  { code: 'en', label: '英语' },
  { code: 'ja', label: '日语' },
  { code: 'ko', label: '韩语' },
  { code: 'fr', label: '法语' },
  { code: 'de', label: '德语' },
  { code: 'es', label: '西班牙语' },
  { code: 'pt', label: '葡萄牙语' },
  { code: 'it', label: '意大利语' },
  { code: 'ru', label: '俄语' },
  { code: 'ar', label: '阿拉伯语' },
  { code: 'th', label: '泰语' },
  { code: 'vi', label: '越南语' },
  { code: 'id', label: '印尼语' },
  { code: 'ms', label: '马来语' },
  { code: 'hi', label: '印地语' },
  { code: 'tr', label: '土耳其语' },
  { code: 'pl', label: '波兰语' },
  { code: 'nl', label: '荷兰语' },
  { code: 'sv', label: '瑞典语' },
  { code: 'da', label: '丹麦语' },
  { code: 'fi', label: '芬兰语' },
  { code: 'no', label: '挪威语' },
  { code: 'uk', label: '乌克兰语' },
  { code: 'cs', label: '捷克语' },
  { code: 'ro', label: '罗马尼亚语' },
  { code: 'el', label: '希腊语' },
  { code: 'hu', label: '匈牙利语' },
  { code: 'bg', label: '保加利亚语' },
];

interface LanguageDropdownProps {
  value: string;
  onChange: (code: string) => void;
  showAuto?: boolean;
  label?: string;
}

export function LanguageDropdown({ value, onChange, showAuto = false, label }: LanguageDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const languages = showAuto ? LANGUAGES : LANGUAGES.filter(l => l.code !== 'auto');
  const filtered = languages.filter(l => l.label.toLowerCase().includes(search.toLowerCase()));
  const selected = LANGUAGES.find(l => l.code === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); setSearch(''); }}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
          'bg-muted hover:bg-muted/80 text-foreground'
        )}
      >
        {selected?.label || label || '选择语言'}
        <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-52 bg-popover border border-border rounded-xl shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="p-2 border-b border-border">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索语言..."
                className="bg-transparent text-sm outline-none flex-1 text-foreground placeholder:text-muted-foreground"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.map((lang) => (
              <button
                key={lang.code}
                onClick={() => { onChange(lang.code); setOpen(false); }}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-muted transition-colors text-left',
                  value === lang.code && 'text-primary font-medium'
                )}
              >
                {lang.label}
                {value === lang.code && <Check className="w-4 h-4" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-4 py-3 text-sm text-muted-foreground text-center">未找到匹配语言</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
