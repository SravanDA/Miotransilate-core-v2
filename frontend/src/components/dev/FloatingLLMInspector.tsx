import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  Key, 
  X, 
  CheckCircle, 
  WarningCircle, 
  CircleNotch,
  FloppyDisk, 
  Trash, 
  ArrowClockwise, 
  Eye,
  EyeSlash
} from "@phosphor-icons/react";
import { LLMTelemetry } from "../../services/LLMTelemetryService";

export function FloatingLLMInspector() {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(LLMTelemetry.getApiKey());
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasCustomKey, setHasCustomKey] = useState(LLMTelemetry.hasCustomApiKey());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latencyMs: number } | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync state with telemetry changes
  useEffect(() => {
    const unsubscribe = LLMTelemetry.subscribe(() => {
      setHasCustomKey(LLMTelemetry.hasCustomApiKey());
    });
    return unsubscribe;
  }, []);

  // Update input when opening modal
  useEffect(() => {
    if (isOpen) {
      setApiKeyInput(LLMTelemetry.getApiKey());
      setSavedSuccess(false);
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleSave = () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      handleClear();
      return;
    }
    LLMTelemetry.setApiKey(trimmed);
    setHasCustomKey(true);
    setSavedSuccess(true);
    setTestResult(null);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleClear = () => {
    LLMTelemetry.clearCustomApiKey();
    setApiKeyInput("");
    setHasCustomKey(false);
    setSavedSuccess(false);
    setTestResult({ ok: false, message: "Custom API key removed.", latencyMs: 0 });
    setTimeout(() => setTestResult(null), 2500);
  };

  const handleTestConnection = async () => {
    const trimmed = apiKeyInput.trim();
    setIsTesting(true);
    setTestResult(null);
    setSavedSuccess(false);
    try {
      const res = await LLMTelemetry.testApiKey(trimmed);
      setTestResult(res);
      if (res.ok && trimmed) {
        LLMTelemetry.setApiKey(trimmed);
        setHasCustomKey(true);
      }
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Circle */}
      <div 
        style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999 }}
        className="flex items-center"
      >
        <button
          onClick={() => setIsOpen(true)}
          className="relative group w-9 h-9 bg-[#12141a] hover:bg-[#1a1d26] text-amber-400 hover:text-amber-300 border border-[#2b3040] hover:border-accent-blue/50 rounded-full  flex items-center justify-center transition-all active:scale-90 cursor-pointer outline-none"
          title={hasCustomKey ? "LLM DevKit (API Key Configured)" : "LLM DevKit (Configure Gemini API Key)"}
        >
          <Key className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" weight="fill" />
          <span 
            className={`absolute top-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#12141a] ${
              hasCustomKey ? "bg-emerald-400" : "bg-amber-400"
            }`} 
          />
        </button>
      </div>

      {/* Modal Dialog */}
      {isOpen && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div 
            className="w-full max-w-md bg-[#12141c] text-slate-100 border border-[#2b3040] rounded-2xl overflow-hidden font-sans select-none flex flex-col max-h-[90vh] my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-[#161922] border-b border-[#262a38]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Key className="w-4 h-4" weight="fill" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-white font-mono flex items-center gap-2">
                    LLM DevKit
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      hasCustomKey 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                        : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    }`}>
                      {hasCustomKey ? "Key Configured" : "No Custom Key"}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Gemini API Key & Connection Setup
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer outline-none"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-[13px] text-slate-200">
              <p className="text-[12px] text-slate-300 leading-relaxed">
                Enter your Gemini API key below. Keys are stored locally in your browser and used for AI auto-translations.
              </p>

              {/* API Key Input */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono font-semibold text-slate-300 uppercase tracking-wider">
                  Gemini API Key
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKeyInput}
                    onChange={(e) => {
                      setApiKeyInput(e.target.value);
                      setSavedSuccess(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave();
                    }}
                    placeholder="AIzaSy..."
                    className="w-full h-10 pl-3.5 pr-10 bg-[#0a0c10] border border-[#2b3040] focus:border-accent-blue rounded-xl text-[12px] text-white font-mono outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 p-1 text-slate-400 hover:text-slate-200 cursor-pointer outline-none"
                    title={showApiKey ? "Hide Key" : "Show Key"}
                  >
                    {showApiKey ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Feedback messages */}
              {savedSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl text-[11px] font-mono flex items-center gap-2 animate-in fade-in">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" weight="fill" />
                  <span>API Key saved successfully!</span>
                </div>
              )}

              {testResult && (
                <div className={`p-3 rounded-xl border text-[11px] font-mono flex items-start gap-2.5 animate-in fade-in ${
                  testResult.ok 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" 
                    : "bg-rose-500/10 border-rose-500/20 text-rose-300"
                }`}>
                  {testResult.ok ? (
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" weight="fill" />
                  ) : (
                    <WarningCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" weight="fill" />
                  )}
                  <div className="space-y-0.5">
                    <p className="font-semibold">{testResult.message}</p>
                    {testResult.latencyMs > 0 && (
                      <p className="text-[10px] opacity-75">Response latency: {testResult.latencyMs}ms</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#161922] border-t border-[#262a38] gap-2">
              <div>
                {hasCustomKey && (
                  <button
                    onClick={handleClear}
                    className="h-8.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 rounded-lg text-[11px] font-mono flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Trash className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="btn-secondary h-8 px-3 text-[11px]"
                >
                  {isTesting ? <CircleNotch className="w-3.5 h-3.5 animate-spin" /> : <ArrowClockwise className="w-3.5 h-3.5" />}
                  <span>{isTesting ? "Testing..." : "Test Connection"}</span>
                </button>

                <button
                  onClick={handleSave}
                  disabled={!apiKeyInput.trim()}
                  className="btn-primary h-8 px-3 text-[11px]"
                >
                  <FloppyDisk className="w-3.5 h-3.5" />
                  <span>Save Key</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
