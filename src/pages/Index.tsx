import { lazy, Suspense, useState } from 'react';
import { motion } from 'framer-motion';
import { Languages, FileText, Type } from 'lucide-react';
import { ApiKeySettings } from '@/components/ApiKeySettings';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TextTranslation } from '@/components/TextTranslation';
import { cn } from '@/lib/utils';

type TabType = 'text' | 'document';

const DocumentTranslation = lazy(async () => {
  const module = await import('@/components/DocumentTranslation');
  return { default: module.DocumentTranslation };
});

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabType>('text');

  const tabs = [
    { id: 'text' as const, label: '文本翻译', icon: Type },
    { id: 'document' as const, label: '文档翻译', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-mesh-gradient flex flex-col">
      {/* Header */}
      <header className="glass-header border-b border-border/50 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
              <Languages className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
            </div>
            <span className="text-base sm:text-lg font-bold text-foreground tracking-tight hidden sm:inline">AI 翻译</span>
          </div>

          {/* Tabs */}
          <nav className="flex items-center gap-0.5 sm:gap-1 bg-muted/60 rounded-xl p-0.5 sm:p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors min-h-[40px]',
                  activeTab === tab.id
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-card rounded-lg shadow-sm"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <tab.icon className="w-4 h-4 relative z-10" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Settings */}
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <ThemeToggle />
            <ApiKeySettings onKeyChange={() => {}} />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-start justify-center px-3 sm:px-6 py-4 sm:py-12">
        <div className="w-full max-w-5xl">
          <div className="card-elevated p-3 sm:p-5 md:p-8">
            {activeTab === 'text' ? (
              <TextTranslation />
            ) : (
              <Suspense fallback={<div className="py-12 text-center text-sm text-muted-foreground">加载文档翻译模块中...</div>}>
                <DocumentTranslation />
              </Suspense>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6">
        <p className="text-center text-xs text-muted-foreground tracking-wide">
          Powered by AI · 支持 30+ 语言互译
        </p>
      </footer>
    </div>
  );
};

export default Index;
