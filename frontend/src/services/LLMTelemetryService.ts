export interface VariableIntegrityResult {
  passed: boolean;
  expectedVars: string[];
  foundVars: string[];
  missingVars: string[];
}

export interface SemanticSenseAnalysis {
  englishLength: number;
  translatedLength: number;
  lengthDeltaPercent: number; // e.g. +25% or -10%
  variableIntegrity: VariableIntegrityResult;
  hasHtmlTags: boolean;
  htmlTagsPreserved: boolean;
  backTranslationSenseCheck: "MATCHES_INTENT" | "SLIGHT_DIVERGENCE" | "MISMATCH" | "UNAVAILABLE";
  confidenceScore: number;
}

export interface ParsedItemResult {
  index: number;
  english: string;
  copyType?: string;
  translated: string;
  backTranslation?: string;
  confidence: number;
  semanticSense: SemanticSenseAnalysis;
}

export interface LLMCallTrace {
  id: string;
  timestamp: string; // ISO string
  model: string;
  targetLanguage: string;
  requestCount: number;
  status: "in_progress" | "success" | "error" | "fallback";
  durationMs: number;
  tokensPerSecond: number;
  
  // Token breakdown
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  tokenSource: "gemini_api" | "estimated";

  // Context & Prompt
  systemInstructionSummary: string;
  rulesApplied: string[];
  rawPrompt: string;
  promptContextSummary: string;

  // Output
  rawResponse: string;
  parsedResults: ParsedItemResult[];
  errorDetails?: string;
  statusCode?: number;
}

export interface SessionMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rateLimitHits: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  averageLatencyMs: number;
  averageTokensPerSec: number;
}

export const CANDIDATE_MODELS = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Stable mid-size multimodal model (Recommended)" },
  { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash", description: "Next-gen experimental Flash model" },
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview", description: "Deep reasoning & nuanced localization" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Pro multimodal reasoning model" }
];

const LOCAL_STORAGE_KEY_API_KEY = "miotranslate_custom_gemini_key";
const LOCAL_STORAGE_KEY_MODEL = "miotranslate_preferred_gemini_model";
const LOCAL_STORAGE_KEY_TEMPERATURE = "miotranslate_gemini_temperature";

// Variable extractor regex (matches {name}, {{count}}, {0}, %s, %d, etc.)
export function extractVariables(text: string): string[] {
  const matches = text.match(/\{{1,2}[a-zA-Z0-9_-]+\}{1,2}|%[sdif]/g) || [];
  return Array.from(new Set(matches));
}

// Simple token estimator (~4 chars per token)
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.8);
}

export function analyzeSemanticSense(
  english: string,
  translated: string,
  backTranslation?: string,
  confidence: number = 95
): SemanticSenseAnalysis {
  const engVars = extractVariables(english);
  const transVars = extractVariables(translated);
  const missingVars = engVars.filter(v => !transVars.includes(v));

  const engLength = english.length;
  const transLength = translated.length;
  const lengthDeltaPercent = engLength > 0 
    ? Math.round(((transLength - engLength) / engLength) * 100)
    : 0;

  // HTML tag check
  const engTags: string[] = english.match(/<[^>]+>/g) || [];
  const transTags: string[] = translated.match(/<[^>]+>/g) || [];
  const hasHtmlTags = engTags.length > 0;
  const htmlTagsPreserved = hasHtmlTags 
    ? engTags.every(tag => transTags.includes(tag))
    : true;

  // Sense check heuristic on back-translation
  let backTranslationSenseCheck: SemanticSenseAnalysis["backTranslationSenseCheck"] = "UNAVAILABLE";
  if (backTranslation && backTranslation.trim()) {
    const normEng = english.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
    const normBack = backTranslation.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
    if (normEng === normBack) {
      backTranslationSenseCheck = "MATCHES_INTENT";
    } else {
      // Check word overlap
      const engWords = new Set<string>(normEng.split(/\s+/).filter(w => w.length > 2));
      const backWords = normBack.split(/\s+/).filter(w => w.length > 2);
      let matches = 0;
      backWords.forEach(w => { if (engWords.has(w)) matches++; });
      const overlap = engWords.size > 0 ? matches / engWords.size : 1;
      backTranslationSenseCheck = overlap > 0.5 ? "MATCHES_INTENT" : "SLIGHT_DIVERGENCE";
    }
  }

  return {
    englishLength: engLength,
    translatedLength: transLength,
    lengthDeltaPercent,
    variableIntegrity: {
      passed: missingVars.length === 0,
      expectedVars: engVars,
      foundVars: transVars,
      missingVars
    },
    hasHtmlTags,
    htmlTagsPreserved,
    backTranslationSenseCheck,
    confidenceScore: confidence
  };
}

class LLMTelemetryServiceImpl {
  private listeners: Set<() => void> = new Set();
  private history: LLMCallTrace[] = [];
  private activeCall: LLMCallTrace | null = null;

  // Metrics
  private metrics: SessionMetrics = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    rateLimitHits: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    averageLatencyMs: 0,
    averageTokensPerSec: 0
  };

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  // API Key Access — only from user-entered key in LLM Inspector (BYO key).
  // Never embed an API key in the client bundle via VITE_ env vars.
  getApiKey(): string {
    try {
      const customKey = localStorage.getItem(LOCAL_STORAGE_KEY_API_KEY);
      if (customKey && customKey.trim()) return customKey.trim();
    } catch {}
    return "";
  }

  setApiKey(key: string) {
    try {
      if (key && key.trim()) {
        localStorage.setItem(LOCAL_STORAGE_KEY_API_KEY, key.trim());
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY_API_KEY);
      }
      this.notify();
    } catch {}
  }

  clearCustomApiKey() {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY_API_KEY);
      this.notify();
    } catch {}
  }

  hasCustomApiKey(): boolean {
    try {
      return Boolean(localStorage.getItem(LOCAL_STORAGE_KEY_API_KEY)?.trim());
    } catch {
      return false;
    }
  }

  // Preferred Model Access
  getPreferredModel(): string {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_MODEL);
      if (saved && CANDIDATE_MODELS.some(m => m.id === saved)) {
        return saved;
      }
      return CANDIDATE_MODELS[0].id;
    } catch {
      return CANDIDATE_MODELS[0].id;
    }
  }

  setPreferredModel(modelId: string) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_MODEL, modelId);
      this.notify();
    } catch {}
  }

  // Temperature
  getTemperature(): number {
    try {
      const val = localStorage.getItem(LOCAL_STORAGE_KEY_TEMPERATURE);
      return val ? parseFloat(val) : 0.1;
    } catch {
      return 0.1;
    }
  }

  setTemperature(temp: number) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_TEMPERATURE, String(temp));
      this.notify();
    } catch {}
  }

  // Test API Key Live
  async testApiKey(keyToTest?: string): Promise<{ ok: boolean; message: string; latencyMs: number }> {
    const key = keyToTest !== undefined ? keyToTest.trim() : this.getApiKey();
    if (!key) {
      return { ok: false, message: "No API key configured. Please enter a key.", latencyMs: 0 };
    }

    const start = performance.now();
    const model = this.getPreferredModel();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Ping. Reply with JSON: {"status":"ok"}' }] }],
          generationConfig: { maxOutputTokens: 20, temperature: 0.1 }
        })
      });

      const latencyMs = Math.round(performance.now() - start);

      if (!resp.ok) {
        const errBody = await resp.text();
        let errorMsg = `API error (${resp.status})`;
        try {
          const parsed = JSON.parse(errBody);
          if (parsed.error?.message) {
            errorMsg = parsed.error.message;
          }
        } catch {}

        if (resp.status === 429) {
          return { ok: false, message: `Rate limit hit (429): Quota exceeded on key.`, latencyMs };
        }
        if (resp.status === 400 || resp.status === 403) {
          return { ok: false, message: `Authentication error (${resp.status}): Invalid API key.`, latencyMs };
        }
        return { ok: false, message: `${errorMsg.slice(0, 120)}`, latencyMs };
      }

      return { ok: true, message: `Connected to ${model} successfully!`, latencyMs };
    } catch (err: any) {
      return { ok: false, message: `Network error: ${err.message || "Failed to reach Gemini"}`, latencyMs: Math.round(performance.now() - start) };
    }
  }

  // Record Call Lifecycle
  startCall(params: {
    model: string;
    targetLanguage: string;
    requestCount: number;
    rawPrompt: string;
    rulesApplied: string[];
    systemInstructionSummary: string;
    promptContextSummary: string;
  }): string {
    const id = "trace_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const estPromptToks = estimateTokens(params.rawPrompt);

    const trace: LLMCallTrace = {
      id,
      timestamp: new Date().toISOString(),
      model: params.model,
      targetLanguage: params.targetLanguage,
      requestCount: params.requestCount,
      status: "in_progress",
      durationMs: 0,
      tokensPerSecond: 0,
      promptTokens: estPromptToks,
      completionTokens: 0,
      totalTokens: estPromptToks,
      tokenSource: "estimated",
      systemInstructionSummary: params.systemInstructionSummary,
      rulesApplied: params.rulesApplied,
      rawPrompt: params.rawPrompt,
      promptContextSummary: params.promptContextSummary,
      rawResponse: "",
      parsedResults: []
    };

    this.activeCall = trace;
    this.notify();
    return id;
  }

  completeCall(
    id: string,
    params: {
      durationMs: number;
      rawResponse: string;
      parsedResults: ParsedItemResult[];
      apiUsageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
      status?: "success" | "fallback";
    }
  ) {
    let trace = this.activeCall && this.activeCall.id === id ? this.activeCall : this.history.find(h => h.id === id);
    if (!trace) return;

    const actualPromptToks = params.apiUsageMetadata?.promptTokenCount ?? trace.promptTokens ?? estimateTokens(trace.rawPrompt);
    const actualCompToks = params.apiUsageMetadata?.candidatesTokenCount ?? estimateTokens(params.rawResponse);
    const totalToks = params.apiUsageMetadata?.totalTokenCount ?? (actualPromptToks + actualCompToks);

    const seconds = Math.max(0.05, params.durationMs / 1000);
    const tokensPerSecond = Math.round(actualCompToks / seconds);

    trace.status = params.status || "success";
    trace.durationMs = params.durationMs;
    trace.rawResponse = params.rawResponse;
    trace.parsedResults = params.parsedResults;
    trace.promptTokens = actualPromptToks;
    trace.completionTokens = actualCompToks;
    trace.totalTokens = totalToks;
    trace.tokensPerSecond = tokensPerSecond;
    trace.tokenSource = params.apiUsageMetadata?.totalTokenCount ? "gemini_api" : "estimated";

    // Update Session Metrics
    this.metrics.totalCalls += 1;
    this.metrics.successfulCalls += 1;
    this.metrics.totalPromptTokens += actualPromptToks;
    this.metrics.totalCompletionTokens += actualCompToks;
    this.metrics.totalTokens += totalToks;

    const prevLatencies = this.metrics.averageLatencyMs * (this.metrics.totalCalls - 1);
    this.metrics.averageLatencyMs = Math.round((prevLatencies + params.durationMs) / this.metrics.totalCalls);

    const prevSpeed = this.metrics.averageTokensPerSec * (this.metrics.totalCalls - 1);
    this.metrics.averageTokensPerSec = Math.round((prevSpeed + tokensPerSecond) / this.metrics.totalCalls);

    // Push to history (limit to 100 traces)
    this.history.unshift({ ...trace });
    if (this.history.length > 100) this.history.pop();

    this.activeCall = null;
    this.notify();
  }

  failCall(
    id: string,
    params: {
      durationMs: number;
      errorDetails: string;
      statusCode?: number;
    }
  ) {
    let trace = this.activeCall && this.activeCall.id === id ? this.activeCall : this.history.find(h => h.id === id);
    if (!trace) return;

    trace.status = "error";
    trace.durationMs = params.durationMs;
    trace.errorDetails = params.errorDetails;
    trace.statusCode = params.statusCode;

    this.metrics.totalCalls += 1;
    this.metrics.failedCalls += 1;
    this.metrics.totalPromptTokens += trace.promptTokens;
    this.metrics.totalTokens += trace.promptTokens;

    const prevLatencies = this.metrics.averageLatencyMs * (this.metrics.totalCalls - 1);
    this.metrics.averageLatencyMs = Math.round((prevLatencies + params.durationMs) / this.metrics.totalCalls);

    if (params.statusCode === 429) {
      this.metrics.rateLimitHits += 1;
    }

    this.history.unshift({ ...trace });
    if (this.history.length > 100) this.history.pop();

    this.activeCall = null;
    this.notify();
  }

  // Getters
  getActiveCall(): LLMCallTrace | null {
    return this.activeCall;
  }

  getLatestTrace(): LLMCallTrace | null {
    return this.history[0] || null;
  }

  getHistory(): LLMCallTrace[] {
    return [...this.history];
  }

  getMetrics(): SessionMetrics {
    return { ...this.metrics };
  }

  clearHistory() {
    this.history = [];
    this.notify();
  }

  resetSessionMetrics() {
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rateLimitHits: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      averageLatencyMs: 0,
      averageTokensPerSec: 0
    };
    this.notify();
  }
}

export const LLMTelemetry = new LLMTelemetryServiceImpl();
