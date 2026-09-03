import type { ITranslationProvider, TranslationRequest, TranslationResult } from "./types";
import { 
  LLMTelemetry, 
  analyzeSemanticSense, 
  CANDIDATE_MODELS as TELEMETRY_MODELS,
  type ParsedItemResult 
} from "../services/LLMTelemetryService";
import { getLexiconTranslation } from "./LexiconDictionary";

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
      // If offline/no key, use high-fidelity Lexicon Engine
      const { prompt, systemInstructionSummary, rulesApplied, promptContextSummary } = buildTranslationPrompt(requests);
      const traceId = LLMTelemetry.startCall({
        model: "Enterprise Lexicon Engine",
        targetLanguage: requests[0]?.targetLanguage || "unknown",
        requestCount: requests.length,
        rawPrompt: prompt,
        systemInstructionSummary,
        rulesApplied,
        promptContextSummary
      });

      const parsedItems: ParsedItemResult[] = [];
      const results: TranslationResult[] = requests.map((req, idx) => {
        const lex = getLexiconTranslation(req.english, req.targetLanguage);
        const semanticSense = analyzeSemanticSense(
          req.english,
          lex.translatedText,
          lex.backTranslation,
          lex.confidence
        );

        // Use COMPUTED confidence, not raw Lexicon score
        const computedConf = semanticSense.confidenceScore;

        parsedItems.push({
          index: idx,
          english: req.english,
          copyType: req.copyType,
          translated: lex.translatedText,
          backTranslation: lex.backTranslation,
          confidence: computedConf,
          semanticSense
        });

        let status: string = "Pending Review";
        if (computedConf < 50) {
          status = "Needs Attention";
        } else if (!semanticSense.variableIntegrity.passed) {
          status = "Needs Attention";
        }

        return {
          translatedText: lex.translatedText,
          confidence: computedConf,
          backTranslation: lex.backTranslation,
          status,
          stateCause: status === "Needs Attention" 
            ? (computedConf < 50 ? "low_confidence" : "missing_variables")
            : undefined,
          modelUsed: "Enterprise Lexicon Engine",
        };
      });

      LLMTelemetry.completeCall(traceId, {
        durationMs: 40,
        rawResponse: JSON.stringify(parsedItems),
        parsedResults: parsedItems
      });

      return results;
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
        } catch {
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

              // Use the COMPUTED confidence from semantic analysis, not the LLM self-report.
              // This includes penalties for missing vars, HTML issues, back-translation divergence, etc.
              const computedConfidence = semanticSense.confidenceScore;

              parsedItems.push({
                index: idx,
                english: req.english,
                copyType: req.copyType,
                translated: String(translatedText),
                backTranslation,
                confidence: computedConfidence,
                semanticSense
              });

              // Drive status from quality signals, not just LLM claims
              let derivedStatus: string = "Pending Review";
              if (computedConfidence < 50) {
                derivedStatus = "Needs Attention";
              } else if (!semanticSense.variableIntegrity.passed) {
                derivedStatus = "Needs Attention";
              } else if (semanticSense.backTranslationSenseCheck === "MISMATCH") {
                derivedStatus = "Needs Attention";
              }

              return {
                translatedText: String(translatedText),
                confidence: computedConfidence,
                backTranslation,
                status: derivedStatus,
                stateCause: derivedStatus === "Needs Attention"
                  ? (computedConfidence < 50 ? "low_confidence" 
                     : !semanticSense.variableIntegrity.passed ? "missing_variables" 
                     : "back_translation_mismatch")
                  : undefined,
                modelUsed: `Gemini (${model})`,
              };
            }
          }

          const lex = getLexiconTranslation(req.english, req.targetLanguage);
          const fallbackSemantic = analyzeSemanticSense(
            req.english,
            lex.translatedText,
            lex.backTranslation,
            lex.confidence
          );

          // Use computed confidence from semantic analysis for Lexicon fallback too
          const fallbackComputedConfidence = fallbackSemantic.confidenceScore;

          parsedItems.push({
            index: idx,
            english: req.english,
            copyType: req.copyType,
            translated: lex.translatedText,
            backTranslation: lex.backTranslation,
            confidence: fallbackComputedConfidence,
            semanticSense: fallbackSemantic
          });

          let fallbackStatus: string = "Pending Review";
          if (fallbackComputedConfidence < 50) {
            fallbackStatus = "Needs Attention";
          }

          return {
            translatedText: lex.translatedText,
            confidence: fallbackComputedConfidence,
            backTranslation: lex.backTranslation,
            status: fallbackStatus,
            stateCause: fallbackComputedConfidence < 50 ? "low_confidence_fallback" : undefined,
            modelUsed: "Enterprise Lexicon Engine (fallback)",
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

    // If all models failed, use high-fidelity Lexicon Engine
    const parsedItems: ParsedItemResult[] = [];
    const fallbackResults: TranslationResult[] = requests.map((req, idx) => {
      const lex = getLexiconTranslation(req.english, req.targetLanguage);
      const semanticSense = analyzeSemanticSense(
        req.english,
        lex.translatedText,
        lex.backTranslation,
        lex.confidence
      );

      // Use COMPUTED confidence
      const computedConf = semanticSense.confidenceScore;

      parsedItems.push({
        index: idx,
        english: req.english,
        copyType: req.copyType,
        translated: lex.translatedText,
        backTranslation: lex.backTranslation,
        confidence: computedConf,
        semanticSense
      });

      let status: string = "Pending Review";
      if (computedConf < 50) {
        status = "Needs Attention";
      }

      return {
        translatedText: lex.translatedText,
        confidence: computedConf,
        backTranslation: lex.backTranslation,
        status,
        stateCause: computedConf < 50 ? "low_confidence_offline_fallback" : undefined,
        modelUsed: "Enterprise Lexicon Engine (offline)",
      };
    });

    LLMTelemetry.failCall(traceId, {
      durationMs,
      errorDetails: "Gemini API unavailable. Automatically recovered using Enterprise Lexicon Engine.",
      statusCode: 200
    });

    return fallbackResults;
  }
}
