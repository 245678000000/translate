import { useState, useEffect } from 'react';
import { Settings, Check, Trash2 } from 'lucide-react';
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

const STORAGE_KEY = 'pdf-translate-api-key';

export interface ApiKeyConfig {
  apiKey: string;
  baseUrl?: string;
}

export function getStoredApiKey(): ApiKeyConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.apiKey) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function ApiKeySettings({ onKeyChange }: { onKeyChange?: (hasKey: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const config = getStoredApiKey();
    if (config) {
      setApiKey(config.apiKey);
      setBaseUrl(config.baseUrl || '');
      setSaved(true);
    }
  }, []);

  const handleSave = () => {
    if (!apiKey.trim()) {
      toast.error('请输入 API Key');
      return;
    }
    const config: ApiKeyConfig = { apiKey: apiKey.trim() };
    if (baseUrl.trim()) config.baseUrl = baseUrl.trim();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    setSaved(true);
    onKeyChange?.(true);
    toast.success('API Key 已保存');
    setOpen(false);
  };

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKey('');
    setBaseUrl('');
    setSaved(false);
    onKeyChange?.(false);
    toast.success('API Key 已清除');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Settings className="w-5 h-5" />
          {saved && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>API Key 设置</DialogTitle>
          <DialogDescription>
            请输入你自己的 API Key，翻译将优先使用你的 Key（更安全、更便宜）
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {saved && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Check className="w-4 h-4" />
              <span>已设置</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="sk-XXXXXXXXXXXXXXXXXXXXXXXX"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="base-url">API Base URL（可选）</Label>
            <Input
              id="base-url"
              type="url"
              placeholder="https://api.openai.com/v1/chat/completions"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            支持 OpenAI / Groq / DeepSeek / 通义千问 / Claude 等（推荐 OpenAI）
          </p>

          <div className="flex items-center justify-between pt-2">
            <div>
              {saved && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleClear}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  清除 Key
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSave}>保存</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
