import React, { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, WarningCircle, Info, Spinner } from "@phosphor-icons/react";

export type ToastType = "success" | "error" | "info" | "warning" | "loading";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  action?: ToastAction;
  duration?: number;
}

interface ToastOptions {
  type?: ToastType;
  action?: ToastAction;
  duration?: number;
}

interface ToastContextType {
  toast: (message: string, options?: ToastOptions) => string;
  success: (message: string, options?: Omit<ToastOptions, "type">) => string;
  error: (message: string, options?: Omit<ToastOptions, "type">) => string;
  info: (message: string, options?: Omit<ToastOptions, "type">) => string;
  warning: (message: string, options?: Omit<ToastOptions, "type">) => string;
  loading: (message: string) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = Math.random().toString(36).substring(2, 9);
      const type = options.type || "success";
      const duration = options.duration ?? (type === "loading" ? 0 : 3500);

      const newToast: ToastItem = {
        id,
        message,
        type,
        action: options.action,
        duration
      };

      setToasts((prev) => [...prev.slice(-3), newToast]);

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }

      return id;
    },
    [dismiss]
  );

  const success = useCallback((msg: string, opts?: Omit<ToastOptions, "type">) => toast(msg, { ...opts, type: "success" }), [toast]);
  const error = useCallback((msg: string, opts?: Omit<ToastOptions, "type">) => toast(msg, { ...opts, type: "error" }), [toast]);
  const info = useCallback((msg: string, opts?: Omit<ToastOptions, "type">) => toast(msg, { ...opts, type: "info" }), [toast]);
  const warning = useCallback((msg: string, opts?: Omit<ToastOptions, "type">) => toast(msg, { ...opts, type: "warning" }), [toast]);
  const loading = useCallback((msg: string) => toast(msg, { type: "loading", duration: 0 }), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info, warning, loading, dismiss }}>
      {children}

      {/* Toast Container */}
      <div 
        aria-live="polite" 
        className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm sm:max-w-md w-full px-4 sm:px-0"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.94, transition: { duration: 0.15 } }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#17181c] border border-white/10 text-white rounded-lg -[0_8px_30px_rgba(0,0,0,0.48)] select-none"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {/* Linear Status Icons */}
                {t.type === "success" && (
                  <div className="w-4 h-4 rounded-full bg-[#5e6ad2] flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 text-white" weight="bold" />
                  </div>
                )}
                {t.type === "error" && (
                  <div className="w-4 h-4 rounded-full bg-[#e5484d] flex items-center justify-center shrink-0">
                    <X className="w-2.5 h-2.5 text-white" weight="bold" />
                  </div>
                )}
                {t.type === "warning" && (
                  <WarningCircle className="w-4 h-4 text-[#f2c94c] shrink-0" weight="fill" />
                )}
                {t.type === "info" && (
                  <Info className="w-4 h-4 text-[#5e6ad2] shrink-0" weight="bold" />
                )}
                {t.type === "loading" && (
                  <Spinner className="w-4 h-4 text-[#5e6ad2] animate-spin shrink-0" weight="bold" />
                )}

                <span className="text-[13px] font-medium text-[#f7f8f8] tracking-tight leading-snug truncate">
                  {t.message}
                </span>
              </div>

              {t.action && (
                <button
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                  className="text-[12px] font-medium text-[#87a9ff] hover:text-white px-2 py-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer shrink-0 outline-none"
                >
                  {t.action.label}
                </button>
              )}

              <button
                onClick={() => dismiss(t.id)}
                className="p-1 text-[#8a8f98] hover:text-[#f7f8f8] rounded hover:bg-white/10 transition-colors cursor-pointer shrink-0 outline-none -mr-1"
                aria-label="Close notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
