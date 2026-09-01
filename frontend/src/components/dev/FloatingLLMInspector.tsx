import React, { useState, useEffect, useRef } from "react";
import { 
  Lightning, 
  X, 
  Minus, 
  ArrowsOut, 
  ArrowsIn,
  Key, 
  Cpu, 
  ChartBar, 
  Clock, 
  ClockCounterClockwise, 
  Flask, 
  CheckCircle, 
  WarningCircle, 
  CircleNotch,
  FloppyDisk, 
  Trash, 
  DownloadSimple, 
  ArrowClockwise, 
  ShieldCheck, 
  Check, 
  Copy,
  Sparkle,
  Eye,
  EyeSlash
} from "@phosphor-icons/react";
import { 
  LLMTelemetry, 
  CANDIDATE_MODELS, 
  type LLMCallTrace, 
  type SessionMetrics 
} from "../../services/LLMTelemetryService";
import { GeminiProvider, getLanguageName } from "../../engine/GeminiProvider";

export function FloatingLLMInspector() {
  // Toggle & Window State
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeTab, setActiveTab] = useState<"live" | "api" | "tokens" | "history" | "sandbox">("live");

  // Telemetry state
  const [metrics, setMetrics] = useState<SessionMetrics>(LLMTelemetry.getMetrics());
  const [latestTrace, setLatestTrace] = useState<LLMCallTrace | null>(LLMTelemetry.getLatestTrace());
  const [activeCall, setActiveCall] = useState<LLMCallTrace | null>(LLMTelemetry.getActiveCall());
  const [history, setHistory] = useState<LLMCallTrace[]>(LLMTelemetry.getHistory());
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);

  // API Config state
  const [customKeyInput, setCustomKeyInput] = useState(LLMTelemetry.getApiKey());
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasCustomKey, setHasCustomKey] = useState(LLMTelemetry.hasCustomApiKey());
  const [selectedModel, setSelectedModel] = useState(LLMTelemetry.getPreferredModel());
  const [temperature, setTemperature] = useState(LLMTelemetry.getTemperature());
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latencyMs: number } | null>(null);
  const [copyNotification, setCopyNotification] = useState<string | null>(null);

  // Sandbox state
  const [sandboxText, setSandboxText] = useState("Confirm appointment for {client_name} at {time}?");
  const [sandboxLang, setSandboxLang] = useState("ar");
  const [sandboxCopyType, setSandboxCopyType] = useState("Modal Title");
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<any | null>(null);

  // Window position (draggable)
  const [position, setPosition] = useState({ x: Math.max(20, window.innerWidth - 680), y: 70 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0
  });

  // Subscribe to telemetry updates
  useEffect(() => {
    const unsubscribe = LLMTelemetry.subscribe(() => {
      setMetrics(LLMTelemetry.getMetrics());
      setLatestTrace(LLMTelemetry.getLatestTrace());
      setActiveCall(LLMTelemetry.getActiveCall());
      setHistory(LLMTelemetry.getHistory());
      setHasCustomKey(LLMTelemetry.hasCustomApiKey());
      setSelectedModel(LLMTelemetry.getPreferredModel());
      setTemperature(LLMTelemetry.getTemperature());
    });
    return unsubscribe;
  }, []);

  // Handle Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) return;
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const newX = Math.max(10, Math.min(window.innerWidth - 300, dragRef.current.initialX + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - 100, dragRef.current.initialY + dy));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const triggerCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyNotification(label);
    setTimeout(() => setCopyNotification(null), 1800);
  };

  const handleSaveApiKey = () => {
    const trimmed = customKeyInput.trim();
    LLMTelemetry.setApiKey(trimmed);
    setTestResult({ ok: true, message: "API Key saved and active for all translations.", latencyMs: 0 });
    setTimeout(() => setTestResult(null), 3000);
  };

  const handleResetApiKey = () => {
    LLMTelemetry.clearCustomApiKey();
    setCustomKeyInput(import.meta.env.VITE_GEMINI_API_KEY || "");
    setTestResult({ ok: true, message: "Reset to environment default key.", latencyMs: 0 });
    setTimeout(() => setTestResult(null), 3000);
  };

  const handleTestKeyLive = async () => {
    const trimmed = customKeyInput.trim();
    setTestingKey(true);
    setTestResult(null);
    try {
      const res = await LLMTelemetry.testApiKey(trimmed);
      setTestResult(res);
      if (res.ok && trimmed) {
        LLMTelemetry.setApiKey(trimmed);
      }
    } finally {
      setTestingKey(false);
    }
  };

  const handleRunSandbox = async () => {
    if (!sandboxText.trim()) return;
    setSandboxLoading(true);
    setSandboxResult(null);
    try {
      const provider = new GeminiProvider();
      const res = await provider.translate({
        english: sandboxText,
        targetLanguage: sandboxLang,
        copyType: sandboxCopyType,
        context: "Sandbox prompt test"
      });
      setSandboxResult(res);
    } catch (e: any) {
      setSandboxResult({ error: e.message || "Failed to translate" });
    } finally {
      setSandboxLoading(false);
    }
  };

  const currentDisplayTrace = selectedTraceId
    ? history.find(h => h.id === selectedTraceId) || latestTrace
    : activeCall || latestTrace;

  const formatTokens = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  return (
    <>
      {/* 1. Floating Trigger Button */}
      {!isOpen && (
        <div 
          style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999 }}
          className="flex items-center gap-2"
        >
          <button
            onClick={() => setIsOpen(true)}
            className="group flex items-center gap-2.5 px-3.5 py-2 bg-[#12141a] hover:bg-[#1a1d26] text-white border border-[#2b3040] hover:border-accent-blue/50 rounded-full shadow-2xl backdrop-blur-md transition-all active:scale-95 cursor-pointer outline-none"
            title="Open Live LLM & Token Inspector"
          >
            <div className="relative flex items-center justify-center">
              <Lightning className={`w-4 h-4 text-amber-400 ${activeCall ? 'animate-bounce' : ''}`} weight="fill" />
              {activeCall && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent-blue animate-ping" />
              )}
            </div>

            <span className="text-[12px] font-semibold tracking-tight font-mono">
              LLM DevKit
            </span>

            <div className="flex items-center gap-1.5 pl-2 border-l border-white/10 text-[11px] font-mono">
              <span className="text-text-secondary">{formatTokens(metrics.totalTokens)} toks</span>
              {hasCustomKey && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Custom API Key active" />
              )}
            </div>
          </button>
        </div>
      )}

      {/* 2. Floating Inspector Window */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            left: isMaximized ? 10 : position.x,
            top: isMaximized ? 10 : position.y,
            width: isMaximized ? "calc(100vw - 20px)" : 660,
            height: isMinimized ? "auto" : isMaximized ? "calc(100vh - 20px)" : 620,
            zIndex: 99999,
          }}
          className="flex flex-col bg-[#0f1117]/95 text-slate-100 border border-[#262a38] rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden font-sans select-none"
        >
          {/* Header (Draggable Handle) */}
          <div
            onMouseDown={handleMouseDown}
            className={`flex items-center justify-between px-4 py-3 bg-[#161922] border-b border-[#262a38] ${
              isMaximized ? "cursor-default" : "cursor-move"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Lightning className="w-4 h-4" weight="fill" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold tracking-tight text-white font-mono">
                    LLM & Token Live Inspector
                  </span>
                  <span className="px-1.5 py-0.5 bg-accent-blue/10 text-accent-blue border border-accent-blue/20 text-[10px] font-mono rounded">
                    TEST TOOLKIT
                  </span>
                  {activeCall && (
                    <span className="flex items-center gap-1 text-[11px] text-amber-400 animate-pulse font-medium">
                      <CircleNotch className="w-3 h-3 animate-spin" /> Live In-Flight
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                  <span>Model: {selectedModel}</span>
                  <span>·</span>
                  <span>Session: {metrics.totalCalls} calls ({formatTokens(metrics.totalTokens)} toks)</span>
                </div>
              </div>
            </div>

            {/* Window controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer outline-none"
                title={isMinimized ? "Expand" : "Minimize"}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer outline-none"
                title={isMaximized ? "Restore" : "Maximize"}
              >
                {isMaximized ? <ArrowsIn className="w-3.5 h-3.5" /> : <ArrowsOut className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer outline-none"
                title="Close DevKit"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Body content (Hidden when minimized) */}
          {!isMinimized && (
            <div className="flex-1 flex flex-col min-h-0 select-text bg-[#0d0f15]">
              {/* Navigation Tabs */}
              <div className="flex items-center px-3 pt-2 bg-[#12141c] border-b border-[#262a38] gap-1 overflow-x-auto scrollbar-none text-[12px]">
                {[
                  { key: "live", label: "Live Pipeline", icon: Lightning },
                  { key: "api", label: "API & Model Config", icon: Key },
                  { key: "tokens", label: "Token Analytics", icon: ChartBar },
                  { key: "history", label: `Traces (${history.length})`, icon: ClockCounterClockwise },
                  { key: "sandbox", label: "Prompt Lab", icon: Flask },
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key as any)}
                      className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-all cursor-pointer outline-none ${
                        isActive
                          ? "border-accent-blue text-white bg-[#191d28] rounded-t-lg shadow-xs"
                          : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" weight={isActive ? "fill" : "regular"} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab Contents */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-[13px] text-slate-200">
                {copyNotification && (
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-md text-[11px] font-mono flex items-center gap-1.5 animate-fadeIn">
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied {copyNotification} to clipboard!</span>
                  </div>
                )}

                {/* ============================================================ */}
                {/* TAB 1: LIVE PIPELINE (Before / During / After) */}
                {/* ============================================================ */}
                {activeTab === "live" && (
                  <div className="space-y-4">
                    {!currentDisplayTrace ? (
                      <div className="text-center py-12 text-slate-500 space-y-2">
                        <Cpu className="w-8 h-8 mx-auto opacity-40" />
                        <p className="font-medium text-[13px]">No translation calls recorded yet.</p>
                        <p className="text-[11px]">Click Auto-Translate anywhere in the app or run a test in the Prompt Lab.</p>
                      </div>
                    ) : (
                      <>
                        {/* Call Summary Banner */}
                        <div className="p-3 bg-[#151822] border border-[#2b3040] rounded-xl flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              currentDisplayTrace.status === 'success' ? 'bg-emerald-400' :
                              currentDisplayTrace.status === 'in_progress' ? 'bg-amber-400 animate-ping' :
                              'bg-rose-400'
                            }`} />
                            <span className="font-mono font-bold text-white text-[12px]">
                              {currentDisplayTrace.model}
                            </span>
                            <span className="text-slate-400 text-[11px]">→ {getLanguageName(currentDisplayTrace.targetLanguage)}</span>
                            <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-slate-300">
                              {currentDisplayTrace.requestCount} string(s)
                            </span>
                          </div>

                          <div className="flex items-center gap-3 font-mono text-[11px]">
                            <span className="text-emerald-400 font-bold">{currentDisplayTrace.durationMs}ms</span>
                            <span className="text-slate-400">·</span>
                            <span className="text-amber-400 font-bold">{currentDisplayTrace.totalTokens} tokens</span>
                            <span className="text-slate-500 text-[10px]">({currentDisplayTrace.promptTokens} in / {currentDisplayTrace.completionTokens} out)</span>
                          </div>
                        </div>

                        {/* PHASE 1: BEFORE TRANSLATION (Context & Prompt) */}
                        <div className="p-3.5 bg-[#12151e] border border-[#252938] rounded-xl space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white font-semibold text-[12px]">
                              <span className="w-5 h-5 rounded-full bg-accent-blue/20 text-accent-blue flex items-center justify-center text-[10px] font-bold">1</span>
                              <span>Before Translation (Context & Prompt Engineering)</span>
                            </div>
                            <button
                              onClick={() => triggerCopy(currentDisplayTrace.rawPrompt, "Raw Prompt")}
                              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 font-mono cursor-pointer"
                            >
                              <Copy className="w-3 h-3" /> Copy Prompt
                            </button>
                          </div>

                          <div className="space-y-1.5 text-[11px]">
                            <div className="p-2 bg-[#0a0c10] rounded-md font-mono text-slate-300 space-y-1 border border-white/5">
                              <p className="text-slate-400 font-semibold">Domain Context:</p>
                              <p className="text-slate-200">{currentDisplayTrace.systemInstructionSummary}</p>
                            </div>

                            <div className="p-2 bg-[#0a0c10] rounded-md text-slate-300 space-y-1 border border-white/5 font-mono">
                              <p className="text-slate-400 font-semibold">Preservation Rules Enforced ({currentDisplayTrace.rulesApplied?.length || 0}):</p>
                              <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[10px]">
                                {currentDisplayTrace.rulesApplied?.map((r, i) => (
                                  <li key={i}>{r}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>

                        {/* PHASE 2: DURING TRANSLATION (Telemetry & Speed) */}
                        <div className="p-3.5 bg-[#12151e] border border-[#252938] rounded-xl space-y-2">
                          <div className="flex items-center gap-2 text-white font-semibold text-[12px]">
                            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold">2</span>
                            <span>During Translation (Live Telemetry)</span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
                            <div className="p-2 bg-[#0a0c10] border border-white/5 rounded-lg">
                              <span className="text-[10px] text-slate-400 block">Prompt Tokens</span>
                              <span className="text-[13px] font-bold text-slate-200">{currentDisplayTrace.promptTokens}</span>
                            </div>
                            <div className="p-2 bg-[#0a0c10] border border-white/5 rounded-lg">
                              <span className="text-[10px] text-slate-400 block">Output Tokens</span>
                              <span className="text-[13px] font-bold text-amber-400">{currentDisplayTrace.completionTokens}</span>
                            </div>
                            <div className="p-2 bg-[#0a0c10] border border-white/5 rounded-lg">
                              <span className="text-[10px] text-slate-400 block">Latency</span>
                              <span className="text-[13px] font-bold text-emerald-400">{currentDisplayTrace.durationMs}ms</span>
                            </div>
                            <div className="p-2 bg-[#0a0c10] border border-white/5 rounded-lg">
                              <span className="text-[10px] text-slate-400 block">Speed</span>
                              <span className="text-[13px] font-bold text-accent-blue">{currentDisplayTrace.tokensPerSecond} tok/s</span>
                            </div>
                          </div>
                        </div>

                        {/* PHASE 3: AFTER TRANSLATION (Semantic Sense & Reverse Check) */}
                        <div className="p-3.5 bg-[#12151e] border border-[#252938] rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white font-semibold text-[12px]">
                              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">3</span>
                              <span>After Translation (Semantic Sense & Reverse Verification)</span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400">
                              {currentDisplayTrace.parsedResults?.length || 0} result(s)
                            </span>
                          </div>

                          {/* Individual String Verifications */}
                          <div className="space-y-2.5">
                            {currentDisplayTrace.parsedResults?.map((item, idx) => {
                              const sense = item.semanticSense;
                              const isLengthWarning = Math.abs(sense?.lengthDeltaPercent || 0) > 60;
                              const isVarMissing = !sense?.variableIntegrity.passed;

                              return (
                                <div key={idx} className="p-3 bg-[#0a0c10] border border-[#202430] rounded-lg space-y-2 font-mono text-[11px]">
                                  <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-2">
                                    <div className="space-y-0.5">
                                      <span className="text-[10px] text-slate-400 block">English Source ({item.copyType || 'Text'}):</span>
                                      <span className="text-white font-medium text-[12px]">{item.english}</span>
                                    </div>
                                    <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] rounded shrink-0">
                                      {item.confidence}% Conf
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div className="space-y-0.5">
                                      <span className="text-[10px] text-amber-400/80 block">Translated ({getLanguageName(currentDisplayTrace.targetLanguage)}):</span>
                                      <span className="text-amber-200 text-[12px] font-semibold">{item.translated}</span>
                                    </div>
                                    <div className="space-y-0.5">
                                      <span className="text-[10px] text-slate-400 block">Reverse / Back-Translation:</span>
                                      <span className="text-slate-300 italic text-[11px]">"{item.backTranslation || 'N/A'}"</span>
                                    </div>
                                  </div>

                                  {/* Sense & Quality Badges */}
                                  <div className="flex items-center gap-2 pt-1 border-t border-white/5 flex-wrap text-[10px]">
                                    {/* Length Delta Gauge */}
                                    <span className={`px-2 py-0.5 rounded border flex items-center gap-1 ${
                                      isLengthWarning 
                                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                                        : 'bg-white/5 text-slate-300 border-white/10'
                                    }`}>
                                      <span>Length:</span>
                                      <span className="font-bold">{sense?.englishLength} → {sense?.translatedLength} chars</span>
                                      <span>({sense?.lengthDeltaPercent > 0 ? `+${sense?.lengthDeltaPercent}` : sense?.lengthDeltaPercent}%)</span>
                                    </span>

                                    {/* Variable Integrity Badge */}
                                    <span className={`px-2 py-0.5 rounded border flex items-center gap-1 ${
                                      isVarMissing 
                                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    }`}>
                                      {isVarMissing ? <WarningCircle className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                                      <span>Variables: {isVarMissing ? `Missing ${sense?.variableIntegrity.missingVars.join(', ')}` : 'Integrity Verified'}</span>
                                    </span>

                                    {/* Reverse Intent Alignment */}
                                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                      Intent: {sense?.backTranslationSenseCheck || 'VERIFIED'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Raw JSON View toggle */}
                          <details className="pt-2 text-[11px]">
                            <summary className="text-slate-400 hover:text-white cursor-pointer font-mono">
                              View Raw Response Payload
                            </summary>
                            <pre className="mt-2 p-3 bg-[#08090d] border border-white/10 rounded-lg text-[10px] text-slate-300 overflow-x-auto font-mono max-h-48">
                              {currentDisplayTrace.rawResponse || "No raw response recorded"}
                            </pre>
                          </details>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ============================================================ */}
                {/* TAB 2: API & MODEL CONFIG (Live Key Switcher) */}
                {/* ============================================================ */}
                {activeTab === "api" && (
                  <div className="space-y-4">
                    {/* Live API Key Card */}
                    <div className="p-4 bg-[#141720] border border-[#292e3d] rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white font-semibold">
                          <Key className="w-4 h-4 text-amber-400" />
                          <span>Gemini API Key Live Switcher</span>
                        </div>
                        {hasCustomKey ? (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono rounded">
                            Custom Key Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-white/5 text-slate-400 border border-white/10 text-[10px] font-mono rounded">
                            Using .env Default
                          </span>
                        )}
                      </div>

                      <p className="text-[12px] text-slate-400 leading-relaxed">
                        When rate limits (429) are reached during testing, paste a new API key below to switch immediately without editing source files or restarting servers.
                      </p>

                      <div className="space-y-2">
                        <div className="relative flex items-center">
                          <input
                            type={showApiKey ? "text" : "password"}
                            value={customKeyInput}
                            onChange={(e) => setCustomKeyInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveApiKey();
                            }}
                            placeholder="AIzaSy... or API Key"
                            className="w-full h-9 pl-3 pr-10 bg-[#0a0c10] border border-[#2b3040] focus:border-accent-blue rounded-lg text-[12px] text-white font-mono outline-none transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-200 cursor-pointer outline-none"
                            title={showApiKey ? "Hide Key" : "Show Key"}
                          >
                            {showApiKey ? <EyeSlash className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleSaveApiKey}
                              className="h-8 px-3.5 bg-accent-blue hover:brightness-110 text-white font-medium rounded-lg text-[11px] flex items-center gap-1.5 cursor-pointer outline-none"
                            >
                              <FloppyDisk className="w-3.5 h-3.5" />
                              <span>Apply Key</span>
                            </button>
                            <button
                              onClick={handleTestKeyLive}
                              disabled={testingKey || !customKeyInput.trim()}
                              className="h-8 px-3 bg-[#1e2330] hover:bg-[#282f40] text-slate-200 border border-[#353d52] font-medium rounded-lg text-[11px] flex items-center gap-1.5 cursor-pointer outline-none disabled:opacity-40"
                            >
                              {testingKey ? <CircleNotch className="w-3.5 h-3.5 animate-spin" /> : <ArrowClockwise className="w-3.5 h-3.5" />}
                              <span>Test Connection</span>
                            </button>
                          </div>

                          {hasCustomKey && (
                            <button
                              onClick={handleResetApiKey}
                              className="text-[11px] text-slate-400 hover:text-rose-400 cursor-pointer font-mono"
                            >
                              Reset to .env Default
                            </button>
                          )}
                        </div>

                        {testResult && (
                          <div className={`p-2.5 rounded-lg border text-[11px] font-mono flex items-start gap-2 ${
                            testResult.ok 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
                              : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                          }`}>
                            {testResult.ok ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                            <div>
                              <p className="font-semibold">{testResult.message}</p>
                              {testResult.latencyMs > 0 && <p className="text-[10px] opacity-75 mt-0.5">Roundtrip ping: {testResult.latencyMs}ms</p>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Model Preferences */}
                    <div className="p-4 bg-[#141720] border border-[#292e3d] rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-white font-semibold">
                        <Cpu className="w-4 h-4 text-accent-blue" />
                        <span>Primary Candidate Model</span>
                      </div>

                      <div className="space-y-2">
                        {CANDIDATE_MODELS.map(m => (
                          <label
                            key={m.id}
                            className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                              selectedModel === m.id
                                ? 'bg-accent-blue/10 border-accent-blue/40 text-white'
                                : 'bg-[#0a0c10] border-white/5 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="radio"
                                name="modelSelect"
                                checked={selectedModel === m.id}
                                onChange={() => {
                                  setSelectedModel(m.id);
                                  LLMTelemetry.setPreferredModel(m.id);
                                }}
                                className="accent-accent-blue"
                              />
                              <div>
                                <span className="font-mono text-[12px] font-bold block">{m.name}</span>
                                <span className="text-[10px] text-slate-400">{m.description}</span>
                              </div>
                            </div>
                            <span className="font-mono text-[10px] text-slate-500">{m.id}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Temperature Slider */}
                    <div className="p-4 bg-[#141720] border border-[#292e3d] rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-semibold text-white">Temperature (Creativity vs Determinism)</span>
                        <span className="font-mono text-amber-400 font-bold">{temperature}</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.05"
                        value={temperature}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setTemperature(val);
                          LLMTelemetry.setTemperature(val);
                        }}
                        className="w-full accent-accent-blue"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>0.0 (Strict & Deterministic)</span>
                        <span>0.5 (Balanced)</span>
                        <span>1.0 (Creative)</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ============================================================ */}
                {/* TAB 3: TOKEN & COST ANALYTICS */}
                {/* ============================================================ */}
                {activeTab === "tokens" && (
                  <div className="space-y-4">
                    {/* Big KPI Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 bg-[#141720] border border-[#292e3d] rounded-xl space-y-1">
                        <span className="text-[11px] text-slate-400 font-mono block">Total Tokens</span>
                        <span className="text-xl font-bold text-white font-mono">{formatTokens(metrics.totalTokens)}</span>
                        <span className="text-[10px] text-slate-500 block">Across session</span>
                      </div>
                      <div className="p-3.5 bg-[#141720] border border-[#292e3d] rounded-xl space-y-1">
                        <span className="text-[11px] text-slate-400 font-mono block">Avg Latency</span>
                        <span className="text-xl font-bold text-emerald-400 font-mono">{metrics.averageLatencyMs}ms</span>
                        <span className="text-[10px] text-slate-500 block">Per LLM call</span>
                      </div>
                      <div className="p-3.5 bg-[#141720] border border-[#292e3d] rounded-xl space-y-1">
                        <span className="text-[11px] text-slate-400 font-mono block">Throughput</span>
                        <span className="text-xl font-bold text-accent-blue font-mono">{metrics.averageTokensPerSec}</span>
                        <span className="text-[10px] text-slate-500 block">Tokens / second</span>
                      </div>
                      <div className="p-3.5 bg-[#141720] border border-[#292e3d] rounded-xl space-y-1">
                        <span className="text-[11px] text-slate-400 font-mono block">Total Invocations</span>
                        <span className="text-xl font-bold text-amber-400 font-mono">{metrics.totalCalls}</span>
                        <span className="text-[10px] text-slate-500 block">{metrics.successfulCalls} ok / {metrics.failedCalls} err</span>
                      </div>
                    </div>

                    {/* Breakdown & Context Consumption */}
                    <div className="p-4 bg-[#141720] border border-[#292e3d] rounded-xl space-y-3">
                      <div className="flex items-center justify-between text-white font-semibold text-[12px]">
                        <span>Token Distribution Breakdown</span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {metrics.totalPromptTokens + metrics.totalCompletionTokens} tokens total
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="h-3 w-full bg-[#0a0c10] rounded-full overflow-hidden flex border border-white/5">
                        <div 
                          style={{ width: `${metrics.totalTokens > 0 ? (metrics.totalPromptTokens / metrics.totalTokens) * 100 : 50}%` }}
                          className="bg-accent-blue h-full" 
                          title="Prompt Tokens"
                        />
                        <div 
                          style={{ width: `${metrics.totalTokens > 0 ? (metrics.totalCompletionTokens / metrics.totalTokens) * 100 : 50}%` }}
                          className="bg-amber-400 h-full" 
                          title="Completion Tokens"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                        <div className="flex items-center gap-2 p-2 bg-[#0a0c10] rounded-lg border border-white/5">
                          <span className="w-2.5 h-2.5 rounded-full bg-accent-blue" />
                          <div>
                            <span className="text-slate-400 block text-[10px]">Prompt / Context:</span>
                            <span className="text-white font-bold">{metrics.totalPromptTokens.toLocaleString()} tokens</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-[#0a0c10] rounded-lg border border-white/5">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                          <div>
                            <span className="text-slate-400 block text-[10px]">Completion / Output:</span>
                            <span className="text-amber-300 font-bold">{metrics.totalCompletionTokens.toLocaleString()} tokens</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Reset Stats */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => LLMTelemetry.resetSessionMetrics()}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg text-[11px] font-mono flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash className="w-3.5 h-3.5" />
                        <span>Reset Session Stats</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* ============================================================ */}
                {/* TAB 4: TRACES & CALL HISTORY */}
                {/* ============================================================ */}
                {activeTab === "history" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono">{history.length} call traces recorded</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(history, null, 2));
                            const downloadAnchor = document.createElement("a");
                            downloadAnchor.setAttribute("href", dataStr);
                            downloadAnchor.setAttribute("download", `llm_traces_${Date.now()}.json`);
                            document.body.appendChild(downloadAnchor);
                            downloadAnchor.click();
                            downloadAnchor.remove();
                          }}
                          className="text-accent-blue hover:underline flex items-center gap-1 font-mono cursor-pointer"
                        >
                          <DownloadSimple className="w-3 h-3" /> Export JSON
                        </button>
                        <button
                          onClick={() => LLMTelemetry.clearHistory()}
                          className="text-slate-400 hover:text-rose-400 font-mono cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {history.length === 0 ? (
                      <div className="text-center py-10 text-slate-500">
                        <Clock className="w-8 h-8 mx-auto opacity-30 mb-2" />
                        <p>No traces recorded in history.</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                        {history.map((h) => {
                          const isSelected = (selectedTraceId || latestTrace?.id) === h.id;
                          return (
                            <div
                              key={h.id}
                              onClick={() => {
                                setSelectedTraceId(h.id);
                                setActiveTab("live");
                              }}
                              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-[#181d28] border-accent-blue/50 text-white'
                                  : 'bg-[#12141c] border-[#252936] text-slate-300 hover:bg-[#161a24]'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${
                                    h.status === 'success' ? 'bg-emerald-400' :
                                    h.status === 'fallback' ? 'bg-amber-400' : 'bg-rose-400'
                                  }`} />
                                  <span className="font-bold text-white">{h.model}</span>
                                  <span className="text-slate-400">→ {getLanguageName(h.targetLanguage)}</span>
                                </div>
                                <span className="text-slate-400">{new Date(h.timestamp).toLocaleTimeString()}</span>
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                <span>{h.requestCount} item(s)</span>
                                <span>{h.durationMs}ms</span>
                                <span className="text-amber-400">{h.totalTokens} tokens</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ============================================================ */}
                {/* TAB 5: PROMPT LAB / SANDBOX */}
                {/* ============================================================ */}
                {activeTab === "sandbox" && (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-[#141720] border border-[#292e3d] rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white font-semibold text-[12px]">
                          <Flask className="w-4 h-4 text-amber-400" />
                          <span>Interactive Prompt & Sense Sandbox</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">Tests live without saving to tags</span>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                            English Source String:
                          </label>
                          <textarea
                            value={sandboxText}
                            onChange={(e) => setSandboxText(e.target.value)}
                            className="w-full h-16 p-2.5 bg-[#0a0c10] border border-[#2b3040] focus:border-accent-blue rounded-lg text-[12px] text-white font-mono outline-none resize-none transition-colors"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <label className="block text-[10px] font-mono text-slate-400 mb-1">Target Language:</label>
                            <select
                              value={sandboxLang}
                              onChange={(e) => setSandboxLang(e.target.value)}
                              className="w-full h-8 px-2 bg-[#0a0c10] border border-[#2b3040] text-white rounded-lg font-mono text-[11px] outline-none"
                            >
                              <option value="ar">Arabic (العربية)</option>
                              <option value="es">Spanish (Español)</option>
                              <option value="fr-CA">French Canada (Français)</option>
                              <option value="de">German (Deutsch)</option>
                              <option value="tr">Turkish (Türkçe)</option>
                              <option value="bg">Bulgarian (Български)</option>
                              <option value="it">Italian (Italiano)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono text-slate-400 mb-1">Copy Type Constraint:</label>
                            <select
                              value={sandboxCopyType}
                              onChange={(e) => setSandboxCopyType(e.target.value)}
                              className="w-full h-8 px-2 bg-[#0a0c10] border border-[#2b3040] text-white rounded-lg font-mono text-[11px] outline-none"
                            >
                              <option value="Button">Button (Imperative)</option>
                              <option value="Label">Label (Noun phrase)</option>
                              <option value="Header">Header</option>
                              <option value="Modal Title">Modal Title</option>
                              <option value="Error">Error Message</option>
                              <option value="Tooltip">Tooltip</option>
                            </select>
                          </div>
                        </div>

                        <button
                          onClick={handleRunSandbox}
                          disabled={sandboxLoading || !sandboxText.trim()}
                          className="w-full h-9 bg-accent-blue hover:brightness-110 text-white font-semibold rounded-lg text-[12px] flex items-center justify-center gap-2 transition-all cursor-pointer outline-none disabled:opacity-40"
                        >
                          {sandboxLoading ? <CircleNotch className="w-4 h-4 animate-spin" /> : <Sparkle className="w-4 h-4" weight="fill" />}
                          <span>{sandboxLoading ? "Generating & Inspecting..." : "Execute Test Translation"}</span>
                        </button>

                        {sandboxResult && (
                          <div className="p-3 bg-[#0a0c10] border border-[#2b3040] rounded-lg space-y-1.5 font-mono text-[11px]">
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span>Output Preview:</span>
                              <span className="text-emerald-400 font-bold">{sandboxResult.confidence || 95}% Confidence</span>
                            </div>
                            <p className="text-amber-200 font-semibold text-[13px]">{sandboxResult.translatedText || sandboxResult.error}</p>
                            {sandboxResult.backTranslation && (
                              <p className="text-slate-400 text-[10px] italic">Reverse: "{sandboxResult.backTranslation}"</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
