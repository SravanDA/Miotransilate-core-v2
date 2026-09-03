import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  delay?: number;
  className?: string;
  disabled?: boolean;
}

export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  delay = 120,
  className = "",
  disabled = false
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    let x = 0;
    let y = 0;

    // Calculate X coordinate based on alignment
    if (side === "top" || side === "bottom") {
      if (align === "start") {
        x = rect.left;
      } else if (align === "end") {
        x = rect.right;
      } else {
        x = rect.left + rect.width / 2;
      }
    } else if (side === "left") {
      x = rect.left - 6;
      y = rect.top + rect.height / 2;
    } else if (side === "right") {
      x = rect.right + 6;
      y = rect.top + rect.height / 2;
    }

    if (side === "top") {
      y = rect.top - 6;
    } else if (side === "bottom") {
      y = rect.bottom + 6;
    }

    setCoords({ x, y });
  };

  const handleMouseEnter = () => {
    if (disabled || !content) return;
    updatePosition();
    timeoutRef.current = setTimeout(() => {
      updatePosition();
      setIsOpen(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const getTransformOrigin = () => {
    if (side === "top") return "bottom center";
    if (side === "bottom") return "top center";
    if (side === "left") return "right center";
    return "left center";
  };

  const getTranslateStyle = (): string => {
    if (side === "top") {
      return align === "start" ? "translate(0, -100%)" : align === "end" ? "translate(-100%, -100%)" : "translate(-50%, -100%)";
    }
    if (side === "bottom") {
      return align === "start" ? "translate(0, 0)" : align === "end" ? "translate(-100%, 0)" : "translate(-50%, 0)";
    }
    if (side === "left") {
      return "translate(-100%, -50%)";
    }
    return "translate(0, -50%)";
  };

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex items-center"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
      >
        {children}
      </span>
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.1, ease: "easeOut" }}
              style={{
                position: "fixed",
                top: coords.y,
                left: coords.x,
                transform: getTranslateStyle(),
                transformOrigin: getTransformOrigin(),
                zIndex: 99999,
                pointerEvents: "none"
              }}
              className={`px-2 py-1 bg-[#1A1A1E] text-zinc-100 border border-zinc-700/60 text-[11px] font-medium leading-none rounded shadow-xl backdrop-blur-xs select-none whitespace-nowrap ${className}`}
            >
              {content}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
