import type { ITranslationProvider, TranslationRequest, TranslationResult } from "./types";
import { 
  LLMTelemetry, 
  analyzeSemanticSense, 
  CANDIDATE_MODELS as TELEMETRY_MODELS,
  type ParsedItemResult 
} from "../services/LLMTelemetryService";

const LANGUAGE_MAP: Record<string, string> = {
  ar: "Arabic",
  es: "Spanish",
  tr: "Turkish",
  bg: "Bulgarian",
  it: "Italian",
  fr: "French (Canada)",
  "fr-CA": "French (Canada)",
  "fr-ca": "French (Canada)",
  de: "German",
  pt: "Portuguese",
  ru: "Russian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese (Simplified)",
  hi: "Hindi",
  th: "Thai",
  vi: "Vietnamese",
  ms: "Malay",
  id: "Indonesian",
};

export function getLanguageName(code: string): string {
  return LANGUAGE_MAP[code] || code;
}

export function buildTranslationPrompt(requests: TranslationRequest[]): {
  prompt: string;
  systemInstructionSummary: string;
  rulesApplied: string[];
  promptContextSummary: string;
} {
  const languageName = getLanguageName(requests[0].targetLanguage);
  const isCanadianFrench = requests[0].targetLanguage.toLowerCase().startsWith("fr") || languageName.includes("Canada");
  
  const tagsBlock = requests.map((r, i) => {
    return `  {"index": ${i}, "english": ${JSON.stringify(r.english)}, "copyType": "${r.copyType}"}`;
  }).join(",\n");

  const rulesApplied = [
    "Keep translations concise & natural for UI context",
    "Preserve placeholders ({name}, {{count}}, %s, %d) exactly",
    "Preserve HTML tags (<b>, <br/>, <strong>) exactly",
    "Preserve brand names (MioSalon, GST, etc.) in English",
    "Tone: buttons imperative, labels noun phrases, messages informative",
    isCanadianFrench
      ? "Use authentic Canadian French (Québec) terminology for salon/spa business"
      : `Use formal/polite register for ${languageName}`
  ];

  const specificLanguageRule = isCanadianFrench
    ? `6. For French (Canada), use authentic Canadian French (Québec/Canada) terminology, date formats, and phrasing standard for salon/spa business software in Canada (not European French).`
    : `6. For ${languageName}, use the formal/polite register appropriate for business software.`;

  const systemInstructionSummary = `Professional UI translator for MioSalon salon & spa management software (English → ${languageName}).`;
  const promptContextSummary = `Translating ${requests.length} UI element(s) with copy type constraints and variable preservation.`;

  const prompt = `You are a professional translator for a salon and spa business management software called MioSalon.

TASK: Translate the following UI strings from English to ${languageName}.

RULES:
1. Keep translations concise and natural for UI context (buttons, labels, headers, messages).
2. Preserve any placeholders like {name}, {{count}}, %s, %d exactly as-is.
3. Preserve any HTML tags like <b>, <br/>, <strong> exactly as-is.
4. Do NOT transliterate brand names (MioSalon, GST, etc.) — keep them in English.
5. Match the tone: buttons should be imperative, labels should be noun phrases, messages should be informative.
${specificLanguageRule}

INPUT (JSON array):
[
${tagsBlock}
]

OUTPUT: Return ONLY a valid JSON array with this exact structure (no markdown, no explanation, no code fence):
[
  {"index": 0, "translated": "...", "backTranslation": "...", "confidence": 95},
  ...
]

Where:
- "translated" is the ${languageName} translation
- "backTranslation" is a literal English back-translation of your ${languageName} output
- "confidence" is your confidence score (0-100)

Return ONLY the JSON array. No other text.`;

  return { prompt, systemInstructionSummary, rulesApplied, promptContextSummary };
}

export class GeminiProvider implements ITranslationProvider {
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const results = await this.translateBatch([request]);
    return results[0];
  }

  async translateBatch(requests: TranslationRequest[]): Promise<TranslationResult[]> {
    const apiKey = LLMTelemetry.getApiKey();

    if (!apiKey) {
      console.error("Gemini API key is not configured. Set it in .env or via the Floating LLM Inspector.");
      // If offline/no key, emit trace and return fallback
      const { prompt, systemInstructionSummary, rulesApplied, promptContextSummary } = buildTranslationPrompt(requests);
      const traceId = LLMTelemetry.startCall({
        model: LLMTelemetry.getPreferredModel(),
        targetLanguage: requests[0]?.targetLanguage || "unknown",
        requestCount: requests.length,
        rawPrompt: prompt,
        systemInstructionSummary,
        rulesApplied,
        promptContextSummary
      });

      LLMTelemetry.failCall(traceId, {
        durationMs: 0,
        errorDetails: "No API key configured. Please input an API key in the LLM Inspector.",
        statusCode: 401
      });

      return requests.map((req) => ({
        translatedText: `[${req.targetLanguage.toUpperCase()}] ${req.english}`,
        confidence: 0,
        backTranslation: req.english,
        status: "Pending Review",
        modelUsed: "Fallback (no API key)",
      }));
    }

    // Process in chunks of 25 to avoid token limits
    const CHUNK_SIZE = 25;
    const allResults: TranslationResult[] = [];

    for (let i = 0; i < requests.length; i += CHUNK_SIZE) {
      const chunk = requests.slice(i, i + CHUNK_SIZE);
      const chunkResults = await this.translateChunk(chunk, apiKey);
      allResults.push(...chunkResults);
    }

    return allResults;
  }

  private async translateChunk(requests: TranslationRequest[], apiKey: string): Promise<TranslationResult[]> {
    const { prompt, systemInstructionSummary, rulesApplied, promptContextSummary } = buildTranslationPrompt(requests);
    const targetLanguage = requests[0]?.targetLanguage || "unknown";

    // Prioritize preferred model first, then fallback models
    const preferredModel = LLMTelemetry.getPreferredModel();
    const candidateModelList = [
      preferredModel,
      ...TELEMETRY_MODELS.map(m => m.id).filter(id => id !== preferredModel)
    ];

    const traceId = LLMTelemetry.startCall({
      model: preferredModel,
      targetLanguage,
      requestCount: requests.length,
      rawPrompt: prompt,
      systemInstructionSummary,
      rulesApplied,
      promptContextSummary
    });

    const startTime = performance.now();

    for (const model of candidateModelList) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const temperature = LLMTelemetry.getTemperature();

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: temperature,
              topP: 0.8,
              maxOutputTokens: 8192,
            },
          }),
        });

        const durationMs = Math.round(performance.now() - startTime);

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`Gemini model ${model} error (${response.status}):`, errText);
          
          // If 429 rate limited or 404, try next candidate model
          if (response.status === 429 || response.status === 404) {
            continue;
          }
          throw new Error(`Gemini API returned ${response.status}: ${errText.slice(0, 120)}`);
        }

        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const textParts = parts.filter((p: any) => p.text && !p.thought);
        const rawText = textParts.map((p: any) => p.text).join("\n") || parts[parts.length - 1]?.text || "";

        // Robust JSON Extraction & Normalization
        let parsed: Array<{
          index?: number;
          translated?: string;
          translation?: string;
          backTranslation?: string;
          back_translation?: string;
          confidence?: number;
          [key: string]: any;
        }> = [];

        try {
          const cleanText = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
          let rawParsed: any;
          try {
            rawParsed = JSON.parse(cleanText);
          } catch {
            const arrayMatch = rawText.match(/\[[\s\S]*\]/);
            const objectMatch = rawText.match(/\{[\s\S]*\}/);
            if (arrayMatch) {
              rawParsed = JSON.parse(arrayMatch[0]);
            } else if (objectMatch) {
              rawParsed = JSON.parse(objectMatch[0]);
            } else {
              throw new Error("No JSON object or array found in Gemini response");
            }
          }

          if (Array.isArray(rawParsed)) {
            parsed = rawParsed;
          } else if (rawParsed && typeof rawParsed === "object") {
            if (Array.isArray(rawParsed.results)) {
              parsed = rawParsed.results;
            } else if (Array.isArray(rawParsed.translations)) {
              parsed = rawParsed.translations;
            } else if (Array.isArray(rawParsed.items)) {
              parsed = rawParsed.items;
            } else {
              parsed = [{ ...rawParsed, index: rawParsed.index !== undefined ? rawParsed.index : 0 }];
            }
          }
        } catch (parseErr) {
          console.error("Failed to parse Gemini response:", rawText);
          throw new Error("Invalid JSON structure from Gemini response");
        }

        // Map results and analyze semantic sense
        const parsedItems: ParsedItemResult[] = [];

        const results: TranslationResult[] = requests.map((req, idx) => {
          const match = Array.isArray(parsed)
            ? (parsed.find((p: any) => p.index === idx) || (parsed.length === 1 && idx === 0 ? parsed[0] : parsed[idx]))
            : null;

          if (match) {
            const langNameLower = getLanguageName(req.targetLanguage).toLowerCase();
            const translatedText = match.translated 
              || match.translation 
              || match[langNameLower] 
              || match[req.targetLanguage]
              || Object.entries(match).find(([k, v]) => 
                  typeof v === "string" && 
                  k !== "english" && 
                  k !== "backTranslation" && 
                  k !== "copyType" && 
                  k !== "index" && 
                  v !== req.english
                )?.[1];

            if (translatedText) {
              const confidence = typeof match.confidence === "number" ? match.confidence : 95;
              const backTranslation = match.backTranslation || match.back_translation;
              
              const semanticSense = analyzeSemanticSense(
                req.english,
                String(translatedText),
                backTranslation,
                confidence
              );

              parsedItems.push({
                index: idx,
                english: req.english,
                copyType: req.copyType,
                translated: String(translatedText),
                backTranslation,
                confidence,
                semanticSense
              });

              return {
                translatedText: String(translatedText),
                confidence,
                backTranslation,
                status: "Pending Review",
                modelUsed: `Gemini (${model})`,
              };
            }
          }

          const fallbackSemantic = analyzeSemanticSense(
            req.english,
            `[${req.targetLanguage.toUpperCase()}] ${req.english}`,
            req.english,
            50
          );

          parsedItems.push({
            index: idx,
            english: req.english,
            copyType: req.copyType,
            translated: `[${req.targetLanguage.toUpperCase()}] ${req.english}`,
            backTranslation: req.english,
            confidence: 50,
            semanticSense: fallbackSemantic
          });

          return {
            translatedText: `[${req.targetLanguage.toUpperCase()}] ${req.english}`,
            confidence: 50,
            backTranslation: req.english,
            status: "Pending Review",
            modelUsed: "Fallback (missing index)",
          };
        });

        // Record telemetry success
        LLMTelemetry.completeCall(traceId, {
          durationMs,
          rawResponse: rawText,
          parsedResults: parsedItems,
          apiUsageMetadata: data.usageMetadata
        });

        return results;
      } catch (modelErr: any) {
        console.warn(`Attempt with ${model} failed:`, modelErr);
      }
    }

    const durationMs = Math.round(performance.now() - startTime);

    // If all models failed
    LLMTelemetry.failCall(traceId, {
      durationMs,
      errorDetails: "All Gemini candidate models failed (rate limit / network / quota).",
      statusCode: 500
    });

    return requests.map((req) => ({
      translatedText: `[${req.targetLanguage.toUpperCase()}] ${req.english}`,
      confidence: 0,
      backTranslation: req.english,
      status: "Pending Review",
      modelUsed: "Fallback (offline)",
    }));
  }
}
