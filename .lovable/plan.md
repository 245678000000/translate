

# 智能PDF翻译 - API Key 设置功能

## 概述
在现有界面中添加 API Key 设置功能，让用户可以使用自己的 API Key 进行翻译，同时保留系统默认 Key 作为备选。

## 新增/修改的文件

### 1. 新建 `src/components/ApiKeySettings.tsx`
- 齿轮图标设置按钮组件 + 模态框（使用现有 Dialog 组件）
- 模态框内容：
  - 说明文字
  - API Key 输入框（密码类型，placeholder: `sk-XXXXXXXXXXXXXXXXXXXXXXXX`）
  - API Base URL 输入框（可选，默认 OpenAI）
  - 支持模型说明文字
  - 保存/取消按钮
  - 已保存时显示绿色"已设置"提示 + 红色"清除 Key"按钮
- 使用 localStorage 存储 key（key: `pdf-translate-api-key`）
- 提供 hook 或工具函数读取已保存的 key

### 2. 修改 `src/pages/Index.tsx`
- 在 header 右侧添加 ApiKeySettings 组件
- 读取 localStorage 中的 API Key
- 翻译时将 customApiKey 传递给 edge function
- 将 `hasCustomKey` 状态传递给 TranslationProgress

### 3. 修改 `src/components/TranslationProgress.tsx`
- 新增 `usingCustomKey` prop
- 在进度条上方显示提示文字：
  - 有自定义 Key："当前使用：你的自定义 API Key"
  - 无自定义 Key："当前使用：系统默认 Key"

### 4. 修改 `supabase/functions/translate/index.ts`
- 接收可选的 `customApiKey` 和 `customBaseUrl` 参数
- 如果提供了 customApiKey，使用用户的 key 调用 OpenAI 兼容 API
- 如果未提供，继续使用 Lovable AI Gateway（保持原有逻辑）
- 用户自定义 key 默认调用 `https://api.openai.com/v1/chat/completions`，使用 `gpt-4o-mini` 模型

## 技术细节

### localStorage 结构
```text
key: "pdf-translate-api-key"
value: JSON string { apiKey: string, baseUrl?: string }
```

### Edge Function 请求体变更
```text
原有: { text, direction }
新增: { text, direction, customApiKey?, customBaseUrl? }
```

### 安全注意事项
- API Key 仅存储在用户浏览器 localStorage 中
- 通过 HTTPS 传输到 edge function，不持久化到服务器
- Edge function 中不记录用户的 API Key

