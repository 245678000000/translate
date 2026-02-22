import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_TEXT_LENGTH = 50000;
const DEFAULT_AZURE_API_VERSION = "2024-10-21";

type ProviderType =
  | "openai"
  | "gemini"
  | "anthropic"
  | "azure"
  | "ollama"
  | "deepseek"
  | "qwen"
  | "deeplx"
  | "microsoft"
  | "google-translate"
  | "custom";

interface TranslateRequestBody {
  text?: string;
  sourceLang?: string;
  targetLang?: string;
  customApiKey?: string;
  customBaseUrl?: string;
  providerType?: ProviderType;
  model?: string;
}

interface OpenAICompatibleOptions {
  text: string;
  sourceLang: string;
  targetLang: string;
  apiUrl: string;
  apiKey?: string;
  model: string;
  extraHeaders?: Record<string, string>;
}

const VALID_LANGS = new Set([
  "auto", "zh", "en", "ja", "ko", "fr", "de", "es", "pt", "it", "ru", "ar",
  "th", "vi", "id", "ms", "hi", "tr", "pl", "nl", "sv", "da", "fi", "no",
  "uk", "cs", "ro", "el", "hu", "bg",
]);

const langMap: Record<string, string> = {
  auto: "auto-detect the source language",
  zh: "Chinese", en: "English", ja: "Japanese", ko: "Korean",
  fr: "French", de: "German", es: "Spanish", pt: "Portuguese",
  it: "Italian", ru: "Russian", ar: "Arabic", th: "Thai",
  vi: "Vietnamese", id: "Indonesian", ms: "Malay", hi: "Hindi",
  tr: "Turkish", pl: "Polish", nl: "Dutch", sv: "Swedish",
  da: "Danish", fi: "Finnish", no: "Norwegian", uk: "Ukrainian",
  cs: "Czech", ro: "Romanian", el: "Greek", hu: "Hungarian", bg: "Bulgarian",
};

const msLangMap: Record<string, string> = {
  zh: "zh-Hans", en: "en", ja: "ja", ko: "ko", fr: "fr", de: "de",
  es: "es", pt: "pt", it: "it", ru: "ru", ar: "ar", th: "th",
  vi: "vi", id: "id", ms: "ms", hi: "hi", tr: "tr", pl: "pl",
  nl: "nl", sv: "sv", da: "da", fi: "fi", no: "nb", uk: "uk",
  cs: "cs", ro: "ro", el: "el", hu: "hu", bg: "bg",
};

const googleLangMap: Record<string, string> = {
  ...msLangMap,
  zh: "zh-CN",
  no: "no",
};

const OPENAI_COMPATIBLE_PROVIDERS = new Set<ProviderType>([
  "openai",
  "deepseek",
  "qwen",
  "ollama",
  "custom",
]);

const DEFAULT_PROVIDER_BASE_URLS: Record<ProviderType, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  anthropic: "https://api.anthropic.com/v1/messages",
  azure: "",
  ollama: "http://localhost:11434/v1/chat/completions",
  deepseek: "https://api.deepseek.com/v1/chat/completions",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  deeplx: "https://api.deeplx.org/translate",
  microsoft: "https://api.cognitive.microsofttranslator.com",
  "google-translate": "https://translation.googleapis.com",
  custom: "",
};

const DEFAULT_MODELS: Partial<Record<ProviderType, string>> = {
  openai: "gpt-4o-mini",
  gemini: "gemini-2.5-flash",
  anthropic: "claude-sonnet-4-20250514",
  azure: "gpt-4o-mini",
  ollama: "llama3",
  deepseek: "deepseek-chat",
  qwen: "qwen-turbo",
  custom: "gpt-4o-mini",
};

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function normalizeOpenAICompatibleUrl(rawUrl: string): string {
  const url = normalizeBaseUrl(rawUrl);
  if (!url) return DEFAULT_PROVIDER_BASE_URLS.openai;
  if (url.endsWith("/chat/completions")) return url;
  if (url.endsWith("/v1")) return `${url}/chat/completions`;
  if (/\/v\d+$/.test(url)) return `${url}/chat/completions`;
  return `${url}/v1/chat/completions`;
}

function normalizeAnthropicUrl(rawUrl?: string): string {
  const base = normalizeBaseUrl(rawUrl || DEFAULT_PROVIDER_BASE_URLS.anthropic);
  if (base.endsWith("/v1/messages")) return base;
  if (base.endsWith("/v1")) return `${base}/messages`;
  return `${base}/v1/messages`;
}

function normalizeGeminiBase(rawUrl?: string): string {
  return normalizeBaseUrl(rawUrl || DEFAULT_PROVIDER_BASE_URLS.gemini);
}

function normalizeDeepLXUrl(rawUrl?: string): string {
  const base = normalizeBaseUrl(rawUrl || DEFAULT_PROVIDER_BASE_URLS.deeplx);
  return base.endsWith("/translate") ? base : `${base}/translate`;
}

function resolveOpenAICompatibleUrl(providerType: ProviderType, customBaseUrl?: string): string {
  const fallback = DEFAULT_PROVIDER_BASE_URLS[providerType] || DEFAULT_PROVIDER_BASE_URLS.openai;
  return normalizeOpenAICompatibleUrl(customBaseUrl || fallback);
}

function resolveModel(providerType: ProviderType, requestedModel?: string): string {
  const model = requestedModel?.trim();
  if (model) return model;
  return DEFAULT_MODELS[providerType] || "gpt-4o-mini";
}

function sanitizeTranslatedText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1");
}

function getSystemPrompt(sourceLang: string, targetLang: string): string {
  const srcName = sourceLang ? (langMap[sourceLang] || sourceLang) : "auto-detect the source language";
  const tgtName = targetLang ? (langMap[targetLang] || targetLang) : "English";

  return `You are a professional translator. ${srcName === "auto-detect the source language" ? "Auto-detect the source language and translate" : `Translate from ${srcName}`} to ${tgtName}. Only return the plain translated text, nothing else. Do NOT use any markdown formatting such as bold (**), italic (*), headers (#), bullet points, or any other markup. Preserve paragraph structure using plain newlines only.`;
}

function getOpenAIContent(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const maybeChoices = (data as { choices?: Array<{ message?: { content?: string } }> }).choices;
  const content = maybeChoices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
}

function getGeminiContent(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const candidates = (data as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  }).candidates;

  const firstText = candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim();
  return firstText || "";
}

function getAnthropicContent(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const contentItems = (data as { content?: Array<{ type?: string; text?: string }> }).content;
  if (!contentItems) return "";

  return contentItems
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text || "")
    .join("\n")
    .trim();
}

function getDeepLXContent(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const obj = data as {
    data?: string;
    translatedText?: string;
    translation?: string;
    text?: string;
  };
  return obj.translatedText || obj.data || obj.translation || obj.text || "";
}

async function translateWithMicrosoft(
  text: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string,
  baseUrl?: string
): Promise<string> {
  const from = sourceLang === "auto" ? "" : (msLangMap[sourceLang] || sourceLang);
  const to = msLangMap[targetLang] || targetLang;

  const endpoint = normalizeBaseUrl(baseUrl || DEFAULT_PROVIDER_BASE_URLS.microsoft);
  const url = new URL("/translate", endpoint);
  url.searchParams.set("api-version", "3.0");
  url.searchParams.set("to", to);
  if (from) url.searchParams.set("from", from);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{ Text: text }]),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Microsoft Translator error:", res.status, err);
    throw new Error(`Microsoft Translator 错误 (${res.status})`);
  }

  const data = await res.json();
  return data?.[0]?.translations?.[0]?.text || "";
}

async function translateWithGoogle(
  text: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string
): Promise<string> {
  const target = googleLangMap[targetLang] || targetLang;
  const source = sourceLang === "auto" ? undefined : (googleLangMap[sourceLang] || sourceLang);

  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

  const body: Record<string, unknown> = { q: text, target, format: "text" };
  if (source) body.source = source;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Google Translate error:", res.status, err);
    throw new Error(`Google Translate 错误 (${res.status})`);
  }

  const data = await res.json();
  return data?.data?.translations?.[0]?.translatedText || "";
}

async function translateWithOpenAICompatible(options: OpenAICompatibleOptions): Promise<string> {
  const { text, sourceLang, targetLang, apiUrl, apiKey, model, extraHeaders } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders || {}),
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: getSystemPrompt(sourceLang, targetLang) },
        { role: "user", content: text },
      ],
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("请求过于频繁，请稍后再试。");
    if (response.status === 402) throw new Error("AI额度不足，请充值后再试。");
    const errText = await response.text();
    console.error("OpenAI-compatible gateway error:", response.status, errText);
    throw new Error(`翻译请求失败 (${response.status})`);
  }

  const data = await response.json();
  const textContent = getOpenAIContent(data);
  return sanitizeTranslatedText(textContent);
}

async function translateWithGemini(
  text: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string,
  model: string,
  baseUrl?: string
): Promise<string> {
  const base = normalizeGeminiBase(baseUrl);
  const url = `${base}/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      systemInstruction: { parts: [{ text: getSystemPrompt(sourceLang, targetLang) }] },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini error:", response.status, errText);
    throw new Error(`Gemini 翻译失败 (${response.status})`);
  }

  const data = await response.json();
  return sanitizeTranslatedText(getGeminiContent(data));
}

async function translateWithAnthropic(
  text: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string,
  model: string,
  baseUrl?: string
): Promise<string> {
  const url = normalizeAnthropicUrl(baseUrl);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: getSystemPrompt(sourceLang, targetLang),
      messages: [{ role: "user", content: text }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Anthropic error:", response.status, errText);
    throw new Error(`Anthropic 翻译失败 (${response.status})`);
  }

  const data = await response.json();
  return sanitizeTranslatedText(getAnthropicContent(data));
}

function buildAzureUrl(baseUrl: string, model: string): string {
  const normalized = normalizeBaseUrl(baseUrl);

  if (normalized.includes("/chat/completions")) {
    const parsed = new URL(normalized);
    if (!parsed.searchParams.has("api-version")) {
      parsed.searchParams.set("api-version", DEFAULT_AZURE_API_VERSION);
    }
    return parsed.toString();
  }

  const deployment = encodeURIComponent(model);
  const url = new URL(`${normalized}/openai/deployments/${deployment}/chat/completions`);
  url.searchParams.set("api-version", DEFAULT_AZURE_API_VERSION);
  return url.toString();
}

async function translateWithAzure(
  text: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string,
  model: string,
  baseUrl?: string
): Promise<string> {
  if (!baseUrl?.trim()) {
    throw new Error("Azure OpenAI 需要配置 Base URL");
  }

  const apiUrl = buildAzureUrl(baseUrl, model);
  return translateWithOpenAICompatible({
    text,
    sourceLang,
    targetLang,
    apiUrl,
    apiKey,
    model,
    extraHeaders: { "api-key": apiKey },
  });
}

async function translateWithDeepLX(
  text: string,
  sourceLang: string,
  targetLang: string,
  baseUrl?: string,
  apiKey?: string
): Promise<string> {
  const url = normalizeDeepLXUrl(baseUrl);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      text,
      source_lang: sourceLang === "auto" ? "auto" : sourceLang,
      target_lang: targetLang,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("DeepLX error:", response.status, errText);
    throw new Error(`DeepLX 翻译失败 (${response.status})`);
  }

  const data = await response.json();
  return getDeepLXContent(data);
}

async function translateWithLovableDefaultService(text: string, sourceLang: string, targetLang: string): Promise<string> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) {
    throw new Error("DEFAULT_TRANSLATION_SERVICE_UNAVAILABLE");
  }

  return translateWithOpenAICompatible({
    text,
    sourceLang,
    targetLang,
    apiUrl: "https://ai.gateway.lovable.dev/v1/chat/completions",
    apiKey: lovableApiKey,
    model: "google/gemini-3-flash-preview",
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      text,
      sourceLang,
      targetLang,
      customApiKey,
      customBaseUrl,
      providerType,
      model,
    } = (await req.json()) as TranslateRequestBody;

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Missing text" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof text !== "string" || text.length > MAX_TEXT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH.toLocaleString()} characters` }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (sourceLang && !VALID_LANGS.has(sourceLang)) {
      return new Response(
        JSON.stringify({ error: "Invalid source language" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (targetLang && !VALID_LANGS.has(targetLang)) {
      return new Response(
        JSON.stringify({ error: "Invalid target language" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const src = sourceLang || "auto";
    const tgt = targetLang || "en";

    let translatedText = "";

    if (!providerType && !customApiKey && !customBaseUrl) {
      translatedText = await translateWithLovableDefaultService(text, src, tgt);
    } else {
      const resolvedProvider: ProviderType = providerType || "openai";
      const resolvedModel = resolveModel(resolvedProvider, model);

      if (resolvedProvider === "microsoft") {
        if (!customApiKey) throw new Error("Microsoft Translator 需要 API Key");
        translatedText = await translateWithMicrosoft(text, src, tgt, customApiKey, customBaseUrl);
      } else if (resolvedProvider === "google-translate") {
        if (!customApiKey) throw new Error("Google Cloud Translation 需要 API Key");
        translatedText = await translateWithGoogle(text, src, tgt, customApiKey);
      } else if (resolvedProvider === "gemini") {
        if (!customApiKey) throw new Error("Gemini 需要 API Key");
        translatedText = await translateWithGemini(text, src, tgt, customApiKey, resolvedModel, customBaseUrl);
      } else if (resolvedProvider === "anthropic") {
        if (!customApiKey) throw new Error("Anthropic 需要 API Key");
        translatedText = await translateWithAnthropic(text, src, tgt, customApiKey, resolvedModel, customBaseUrl);
      } else if (resolvedProvider === "azure") {
        if (!customApiKey) throw new Error("Azure OpenAI 需要 API Key");
        translatedText = await translateWithAzure(text, src, tgt, customApiKey, resolvedModel, customBaseUrl);
      } else if (resolvedProvider === "deeplx") {
        translatedText = await translateWithDeepLX(text, src, tgt, customBaseUrl, customApiKey);
      } else if (OPENAI_COMPATIBLE_PROVIDERS.has(resolvedProvider)) {
        translatedText = await translateWithOpenAICompatible({
          text,
          sourceLang: src,
          targetLang: tgt,
          apiUrl: resolveOpenAICompatibleUrl(resolvedProvider, customBaseUrl),
          apiKey: customApiKey,
          model: resolvedModel,
        });
      } else {
        translatedText = await translateWithOpenAICompatible({
          text,
          sourceLang: src,
          targetLang: tgt,
          apiUrl: resolveOpenAICompatibleUrl("openai", customBaseUrl),
          apiKey: customApiKey,
          model: resolvedModel,
        });
      }
    }

    return new Response(
      JSON.stringify({ translatedText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const message = toErrorMessage(e, "Unknown error");
    const status = message === "DEFAULT_TRANSLATION_SERVICE_UNAVAILABLE" ? 503 : 500;
    const errorMessage = message === "DEFAULT_TRANSLATION_SERVICE_UNAVAILABLE"
      ? "默认翻译服务暂不可用，请配置自定义提供商后重试"
      : message;

    console.error("translate error:", e);

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
