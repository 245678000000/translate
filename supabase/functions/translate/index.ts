import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

// Microsoft uses BCP-47 codes
const msLangMap: Record<string, string> = {
  zh: "zh-Hans", en: "en", ja: "ja", ko: "ko", fr: "fr", de: "de",
  es: "es", pt: "pt", it: "it", ru: "ru", ar: "ar", th: "th",
  vi: "vi", id: "id", ms: "ms", hi: "hi", tr: "tr", pl: "pl",
  nl: "nl", sv: "sv", da: "da", fi: "fi", no: "nb", uk: "uk",
  cs: "cs", ro: "ro", el: "el", hu: "hu", bg: "bg",
};

// Google also uses BCP-47
const googleLangMap: Record<string, string> = {
  ...msLangMap,
  zh: "zh-CN",
  no: "no",
};

async function translateWithMicrosoft(
  text: string, sourceLang: string, targetLang: string,
  apiKey: string, baseUrl: string
): Promise<string> {
  const from = sourceLang === "auto" ? "" : (msLangMap[sourceLang] || sourceLang);
  const to = msLangMap[targetLang] || targetLang;

  const url = new URL("/translate", baseUrl);
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
  text: string, sourceLang: string, targetLang: string,
  apiKey: string
): Promise<string> {
  const target = googleLangMap[targetLang] || targetLang;
  const source = sourceLang === "auto" ? undefined : (googleLangMap[sourceLang] || sourceLang);

  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

  const body: Record<string, unknown> = { q: text, target };
  if (source) body.source = source;
  body.format = "text";

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

async function translateWithLLM(
  text: string, sourceLang: string, targetLang: string,
  apiUrl: string, authHeader: string, model: string
): Promise<string> {
  const srcName = sourceLang ? (langMap[sourceLang] || sourceLang) : "auto-detect the source language";
  const tgtName = targetLang ? (langMap[targetLang] || targetLang) : "English";

  const systemPrompt = `You are a professional translator. ${srcName === "auto-detect the source language" ? "Auto-detect the source language and translate" : `Translate from ${srcName}`} to ${tgtName}. Only return the plain translated text, nothing else. Do NOT use any markdown formatting such as bold (**), italic (*), headers (#), bullet points, or any other markup. Preserve paragraph structure using plain newlines only.`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("请求过于频繁，请稍后再试。");
    if (response.status === 402) throw new Error("AI额度不足，请充值后再试。");
    const errText = await response.text();
    console.error("AI gateway error:", response.status, errText);
    throw new Error("AI translation failed");
  }

  const data = await response.json();
  let translatedText = data.choices?.[0]?.message?.content?.trim() || "";
  translatedText = translatedText
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1");

  return translatedText;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      text, sourceLang, targetLang,
      customApiKey, customBaseUrl,
      providerType, // 'microsoft' | 'google-translate' | 'openai' | etc.
    } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Missing text" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let translatedText: string;

    if (providerType === "microsoft" && customApiKey) {
      const baseUrl = customBaseUrl || "https://api.cognitive.microsofttranslator.com";
      translatedText = await translateWithMicrosoft(text, sourceLang || "auto", targetLang || "en", customApiKey, baseUrl);
    } else if (providerType === "google-translate" && customApiKey) {
      translatedText = await translateWithGoogle(text, sourceLang || "auto", targetLang || "en", customApiKey);
    } else if (customApiKey) {
      // Custom LLM provider
      const apiUrl = customBaseUrl || "https://api.openai.com/v1/chat/completions";
      translatedText = await translateWithLLM(text, sourceLang || "auto", targetLang || "en", apiUrl, `Bearer ${customApiKey}`, "gpt-4o-mini");
    } else {
      // Fallback: Lovable AI
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
      translatedText = await translateWithLLM(
        text, sourceLang || "auto", targetLang || "en",
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        `Bearer ${LOVABLE_API_KEY}`,
        "google/gemini-3-flash-preview"
      );
    }

    return new Response(
      JSON.stringify({ translatedText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("translate error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
