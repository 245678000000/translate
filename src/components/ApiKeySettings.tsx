import { useState, useEffect, useCallback } from 'react';
import { Settings, Plus, Pencil, Trash2, Star, Check, X, ChevronDown, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import {
  type TranslationProvider,
  type ProviderType,
  PROVIDER_CONFIGS,
  getProviders,
  saveProviders,
  getActiveProviderConfig,
} from '@/lib/providers';
import { supabase } from '@/integrations/supabase/client';

// Re-export for backward compatibility
export type ApiKeyConfig = { apiKey: string; baseUrl?: string };
export function getStoredApiKey(): ApiKeyConfig | null {
  return getActiveProviderConfig() as ApiKeyConfig | null;
}

type View = 'list' | 'add' | 'edit';

export function ApiKeySettings({ onKeyChange }: { onKeyChange?: (hasKey: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('list');
  const [providers, setProviders] = useState<TranslationProvider[]>([]);
  const [editingProvider, setEditingProvider] = useState<TranslationProvider | null>(null);
  const hasCustom = providers.some(p => !p.isSystem && p.enabled && p.apiKey);

  useEffect(() => {
    setProviders(getProviders());
  }, [open]);

  const persist = useCallback((updated: TranslationProvider[]) => {
    const filtered = updated.filter(p => !p.isSystem);
    setProviders(filtered);
    saveProviders(filtered);
    onKeyChange?.(filtered.some(p => p.isDefault && p.enabled && p.apiKey));
  }, [onKeyChange]);

  const handleDelete = (id: string) => {
    const updated = providers.filter(p => p.id !== id);
    persist(updated);
    toast.success('已删除');
  };

  const handleSetDefault = (id: string) => {
    const updated = providers.map(p => ({ ...p, isDefault: p.id === id }));
    persist(updated);
    toast.success('已设为默认');
  };

  const handleSaveProvider = (provider: TranslationProvider) => {
    let updated: TranslationProvider[];
    const existing = providers.find(p => p.id === provider.id);
    if (existing) {
      updated = providers.map(p => p.id === provider.id ? provider : p);
    } else {
      updated = [...providers, provider];
    }
    persist(updated);
    setView('list');
    setEditingProvider(null);
    toast.success('已保存');
  };

  const openAdd = () => {
    setEditingProvider(null);
    setView('add');
  };

  const openEdit = (p: TranslationProvider) => {
    setEditingProvider(p);
    setView('edit');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setView('list'); setEditingProvider(null); } }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Settings className="w-5 h-5" />
          {hasCustom && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] sm:max-h-[90vh] overflow-y-auto [&>button:last-child]:hidden sm:p-6">
        {view === 'list' && (
          <ProviderList
            providers={providers}
            onAdd={openAdd}
            onEdit={openEdit}
            onDelete={handleDelete}
            onSetDefault={handleSetDefault}
            onClose={() => setOpen(false)}
          />
        )}
        {(view === 'add' || view === 'edit') && (
          <ProviderForm
            provider={editingProvider}
            onSave={handleSaveProvider}
            onCancel={() => { setView('list'); setEditingProvider(null); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ────── Provider List ────── */
function ProviderList({
  providers,
  onAdd,
  onEdit,
  onDelete,
  onSetDefault,
  onClose,
}: {
  providers: TranslationProvider[];
  onAdd: () => void;
  onEdit: (p: TranslationProvider) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  onClose: () => void;
}) {
  const userProviders = providers.filter(p => !p.isSystem);
  const isEmpty = userProviders.length === 0;

  return (
    <>
      <DialogHeader className="pr-0 pb-4 border-b border-border">
        <div className="flex items-start sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-1">
            <DialogTitle className="text-xl font-semibold">翻译服务提供商</DialogTitle>
            <DialogDescription className="text-sm">
              管理你的翻译服务提供商，翻译时将优先使用默认提供商
            </DialogDescription>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Button size="sm" onClick={onAdd} className="gap-1.5 bg-gradient-to-r from-primary to-accent hover:opacity-90">
              <Plus className="w-4 h-4" />
              添加
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 sm:w-7 sm:h-7 rounded-full flex items-center justify-center bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200 hover:scale-110 z-50"
            >
              <X className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </button>
          </div>
        </div>
      </DialogHeader>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-10 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <span className="text-3xl">🌐</span>
          </div>
          <div className="text-center space-y-1.5">
            <p className="font-semibold text-foreground">暂无翻译服务提供商</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              添加自己的 API Key 后，翻译将更稳定、更便宜、更安全
            </p>
          </div>
          <Button onClick={onAdd} className="gap-1.5 bg-gradient-to-r from-primary to-accent hover:opacity-90 mt-2">
            <Plus className="w-4 h-4" />
            添加提供商
          </Button>
        </div>
      ) : (
        <div className="space-y-3 pt-4">
          {userProviders.map((p) => {
            const config = PROVIDER_CONFIGS[p.type] || PROVIDER_CONFIGS.custom;
            return (
              <div
                key={p.id}
                className={cn(
                  'flex items-center gap-3 p-4 rounded-2xl border transition-colors',
                  p.isDefault ? 'border-primary/30 bg-primary/[0.04]' : 'border-border'
                )}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ backgroundColor: `${config.color}20`, color: config.color }}
                >
                  {config.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground truncate">{p.name}</span>
                    {p.isDefault && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        默认
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {config.label}{p.model ? ` · ${p.model}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!p.isDefault && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onSetDefault(p.id)} title="设为默认">
                      <Star className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(p)} title="编辑">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(p.id)} title="删除">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground pt-2">
        未设置自定义提供商时，将使用系统默认服务进行翻译
      </p>
    </>
  );
}

/* ────── Provider Form (Add/Edit) — Unified DeepLX style ────── */
function ProviderForm({
  provider,
  onSave,
  onCancel,
}: {
  provider: TranslationProvider | null;
  onSave: (p: TranslationProvider) => void;
  onCancel: () => void;
}) {
  const isEdit = !!provider;
  const [type, setType] = useState<ProviderType>(provider?.type || 'openai');
  const [name, setName] = useState(provider?.name || '');
  const [apiKey, setApiKey] = useState(provider?.apiKey || '');
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl || '');
  const [model, setModel] = useState(provider?.model || '');
  const [customModel, setCustomModel] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);

  // Advanced fields
  const [maxRps, setMaxRps] = useState(provider?.maxRequestsPerSecond ?? 5);
  const [maxTextLen, setMaxTextLen] = useState(provider?.maxTextLength ?? 5000);
  const [maxParas, setMaxParas] = useState(provider?.maxParagraphs ?? 50);
  const [richText, setRichText] = useState(provider?.enableRichText ?? false);

  const config = PROVIDER_CONFIGS[type];
  const hasAdvanced = config.advancedFields && config.advancedFields.length > 0;

  useEffect(() => {
    if (!isEdit) {
      setName(config.label);
      setBaseUrl(config.defaultBaseUrl);
      setModel(config.models[0] || '');
      setCustomModel(false);
    }
  }, [type, isEdit, config]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('translate', {
        body: {
          text: 'Hello',
          sourceLang: 'en',
          targetLang: 'zh',
          customApiKey: apiKey || undefined,
          customBaseUrl: baseUrl || undefined,
        },
      });
      if (error) throw error;
      if (data?.translatedText) {
        setTestResult('success');
        toast.success('服务可用 ✅');
      } else {
        throw new Error('无响应');
      }
    } catch (err: any) {
      setTestResult('error');
      toast.error(`测试失败: ${err.message || '未知错误'}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (!name.trim()) { toast.error('请输入服务名称'); return; }
    if (config.fields.includes('apiKey') && !apiKey.trim()) { toast.error('请输入 API Key'); return; }

    onSave({
      id: provider?.id || crypto.randomUUID(),
      name: name.trim(),
      type,
      apiKey: apiKey.trim() || undefined,
      baseUrl: baseUrl.trim() || undefined,
      model: model.trim() || undefined,
      enabled: true,
      isDefault: provider?.isDefault || false,
      ...(hasAdvanced ? {
        maxRequestsPerSecond: maxRps,
        maxTextLength: maxTextLen,
        maxParagraphs: maxParas,
        enableRichText: richText,
      } : {}),
    });
  };

  const providerTypes = Object.entries(PROVIDER_CONFIGS) as [ProviderType, typeof config][];
  const displayName = name || config.label;

  return (
    <div className="space-y-5">
      <DialogTitle className="sr-only">{isEdit ? '编辑' : '添加'}提供商</DialogTitle>
      <DialogDescription className="sr-only">配置翻译服务提供商</DialogDescription>

      {/* ── Header: Icon + Title + Test button ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold shrink-0"
            style={{ backgroundColor: `${config.color}18`, color: config.color }}
          >
            {config.icon}
          </div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">{displayName}</h2>
        </div>
        <button
          onClick={handleTest}
          disabled={testing || (!apiKey && config.fields.includes('apiKey'))}
          className={cn(
            'text-sm font-medium transition-colors disabled:opacity-40',
            testResult === 'success' ? 'text-primary' : 'text-primary hover:text-primary/80'
          )}
        >
          {testing ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              测试中...
            </span>
          ) : testResult === 'success' ? (
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              服务可用
            </span>
          ) : (
            '点此测试服务'
          )}
        </button>
      </div>

      {/* Sub-heading */}
      <p className="text-sm text-muted-foreground -mt-2 pl-[4.25rem]">{config.label}</p>

      {/* ── Provider Type selector (add mode only) ── */}
      {!isEdit && (
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">提供商类型：</label>
          <div className="relative">
            <button
              onClick={() => setTypeOpen(!typeOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-input bg-background text-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: `${config.color}20`, color: config.color }}
                >
                  {config.icon}
                </span>
                {config.label}
              </div>
              <ChevronDown className={cn('w-4 h-4 transition-transform', typeOpen && 'rotate-180')} />
            </button>
            {typeOpen && (
              <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
                <div className="max-h-56 overflow-y-auto py-1">
                  {providerTypes.map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => { setType(key); setTypeOpen(false); }}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-muted transition-colors',
                        type === key && 'bg-primary/5 text-primary'
                      )}
                    >
                      <span
                        className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}
                      >
                        {cfg.icon}
                      </span>
                      {cfg.label}
                      {type === key && <Check className="w-4 h-4 ml-auto" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Fields — label on its own line, DeepLX style ── */}
      <div className="space-y-1.5">
        <label className="text-sm text-muted-foreground">自定义翻译服务名称：</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：我的 OpenAI" />
      </div>

      {config.fields.includes('baseUrl') && (
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">API URL:</label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={config.defaultBaseUrl || 'https://api.example.com/v1/chat/completions'}
          />
          {baseUrl.trim() && (
            <p className="text-xs text-muted-foreground truncate">
              预览: {(() => {
                const url = baseUrl.trim().replace(/\/+$/, '');
                if (type === 'deeplx' || type === 'microsoft' || type === 'google-translate') return url;
                if (url.endsWith('/chat/completions')) return url;
                if (url.endsWith('/v1')) return `${url}/chat/completions`;
                if (url.match(/\/v\d+$/)) return `${url}/chat/completions`;
                return `${url}/v1/chat/completions`;
              })()}
            </p>
          )}
        </div>
      )}

      {config.fields.includes('apiKey') && (
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">APIKEY:</label>
          <div className="relative">
            <Input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-XXXXXXXXXXXXXXXXXXXXXXXX"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {config.fields.includes('model') && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm text-muted-foreground">模型：</label>
            {config.models.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={customModel} onChange={(e) => setCustomModel(e.target.checked)} className="rounded" />
                自定义模型名
              </label>
            )}
          </div>
          {customModel || config.models.length === 0 ? (
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="输入模型名称" />
          ) : (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {config.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* ── Advanced fields (DeepLX etc.) ── */}
      {hasAdvanced && (
        <div className="space-y-4 pt-3 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">高级参数</p>

          {config.advancedFields!.includes('maxRequestsPerSecond') && (
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">每秒最大请求数：</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={maxRps}
                onChange={(e) => setMaxRps(Number(e.target.value))}
              />
            </div>
          )}

          {config.advancedFields!.includes('maxTextLength') && (
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">每次请求最大文本长度：</label>
              <Input
                type="number"
                min={100}
                max={50000}
                value={maxTextLen}
                onChange={(e) => setMaxTextLen(Number(e.target.value))}
              />
            </div>
          )}

          {config.advancedFields!.includes('maxParagraphs') && (
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">每次请求最大段落数：</label>
              <Input
                type="number"
                min={1}
                max={500}
                value={maxParas}
                onChange={(e) => setMaxParas(Number(e.target.value))}
              />
            </div>
          )}

          {config.advancedFields!.includes('enableRichText') && (
            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground">启用富文本翻译：</label>
              <button
                type="button"
                role="switch"
                aria-checked={richText}
                onClick={() => setRichText(!richText)}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                  richText ? 'bg-primary' : 'bg-muted'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform',
                    richText ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Action buttons ── */}
      <div className="flex justify-end gap-2 pt-3 border-t border-border">
        <Button variant="outline" onClick={onCancel}>取消</Button>
        <Button onClick={handleSave} className="bg-gradient-to-r from-primary to-accent hover:opacity-90">保存</Button>
      </div>
    </div>
  );
}
