import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, direction, customApiKey, customBaseUrl, sourceLang, targetLang } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Missing text" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const srcName = sourceLang ? (langMap[sourceLang] || sourceLang) : "auto-detect the source language";
    const tgtName = targetLang ? (langMap[targetLang] || targetLang) : "English";

    const systemPrompt = `You are a professional translator. ${srcName === "auto-detect the source language" ? "Auto-detect the source language and translate" : `Translate from ${srcName}`} to ${tgtName}. Only return the plain translated text, nothing else. Do NOT use any markdown formatting such as bold (**), italic (*), headers (#), bullet points, or any other markup. Preserve paragraph structure using plain newlines only.`;

    let apiUrl: string;
    let authHeader: string;
    let model: string;

    if (customApiKey) {
      apiUrl = customBaseUrl || "https://api.openai.com/v1/chat/completions";
      authHeader = `Bearer ${customApiKey}`;
      model = "gpt-4o-mini";
    } else {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        throw new Error("LOVABLE_API_KEY is not configured");
      }
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      authHeader = `Bearer ${LOVABLE_API_KEY}`;
      model = "google/gemini-3-flash-preview";
    }

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
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "请求过于频繁，请稍后再试。" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI额度不足，请充值后再试。" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI translation failed");
    }

    const data = await response.json();
    let translatedText =
      data.choices?.[0]?.message?.content?.trim() || "";
    // Strip any markdown formatting the model might still produce
    translatedText = translatedText
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^[-*+]\s+/gm, "")
      .replace(/`([^`]+)`/g, "$1");

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
