import { useState } from 'react';
import { motion } from 'framer-motion';
import { Languages, FileText, Type } from 'lucide-react';
import { ApiKeySettings } from '@/components/ApiKeySettings';
import { TextTranslation } from '@/components/TextTranslation';
import { DocumentTranslation } from '@/components/DocumentTranslation';
import { cn } from '@/lib/utils';

type TabType = 'text' | 'document';

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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
              <Languages className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground tracking-tight hidden sm:inline">AI 翻译</span>
          </div>

          {/* Tabs */}
          <nav className="flex items-center gap-1 bg-muted/60 rounded-xl p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
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
          <ApiKeySettings onKeyChange={() => {}} />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-start justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="w-full max-w-5xl">
          <div className="card-elevated p-5 sm:p-8">
            {activeTab === 'text' ? <TextTranslation /> : <DocumentTranslation />}
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
