import { useState, useRef, useEffect } from "react";
import { CaretDown, Check, Plus } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";

export const PRESET_COPY_TYPES = [
  "Button",
  "Label",
  "Header",
  "Placeholder",
  "Error",
  "Tooltip",
  "General",
  "Modal Title",
  "Badge",
  "Tab",
  "Toast",
  "Form Help",
  "Table Column",
  "Navigation",
  "Link"
] as const;

interface CopyTypeSelectorProps {
  value?: string;
  onChange: (newType: string) => void;
  className?: string;
  disabled?: boolean;
  align?: "left" | "right";
  size?: "sm" | "md";
}

export function CopyTypeSelector({
  value = "General",
  onChange,
  className,
  disabled = false,
  align = "left",
  size = "sm"
}: CopyTypeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayValue = value && value.trim() ? value : "General";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const filteredPresets = PRESET_COPY_TYPES.filter(p =>
    p.toLowerCase().includes(query.toLowerCase())
  );

  const isCustomNew = query.trim() && !PRESET_COPY_TYPES.some(p => p.toLowerCase() === query.trim().toLowerCase());

  const handleSelect = (selected: string) => {
    onChange(selected);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div className={cn("relative inline-block", className)} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border font-medium transition-all outline-none cursor-pointer",
          size === "md" ? "px-2.5 py-1 text-[12px]" : "px-2 py-0.5 text-[11px]",
          isOpen
            ? "bg-bg-hover border-border-strong text-text-primary"
            : "bg-bg-main hover:bg-bg-hover border-border-subtle hover:border-border-strong text-text-secondary hover:text-text-primary",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        title="Click to change or customize Copy Type"
      >
        <span className="truncate max-w-[120px]">{displayValue}</span>
        {!disabled && <CaretDown className={cn("w-2.5 h-2.5 opacity-50 transition-transform", isOpen && "rotate-180")} weight="bold" />}
      </button>

      {isOpen && !disabled && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute z-50 mt-1 w-52 bg-bg-card border border-border-subtle rounded-xl  py-1.5 flex flex-col max-h-[260px] overflow-hidden",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {/* Search / Custom input */}
          <div className="px-2 pb-1.5 border-b border-border-subtle">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search or type custom..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) {
                  handleSelect(query.trim());
                }
              }}
              className="w-full h-7 px-2 bg-bg-main border border-border-strong rounded-md text-[12px] text-text-primary placeholder:text-text-tertiary focus:border-accent-blue outline-none"
            />
          </div>

          {/* List of types */}
          <div className="overflow-y-auto flex-1 scrollbar-none py-1">
            {isCustomNew && (
              <button
                type="button"
                onClick={() => handleSelect(query.trim())}
                className="w-full text-left px-3 py-1.5 text-[12px] font-medium text-accent-blue hover:bg-accent-blue/10 flex items-center gap-1.5 transition-colors cursor-pointer outline-none"
              >
                <Plus className="w-3.5 h-3.5" weight="bold" />
                <span className="truncate">Create "{query.trim()}"</span>
              </button>
            )}

            {filteredPresets.map((preset) => {
              const isSelected = displayValue.toLowerCase() === preset.toLowerCase();
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelect(preset)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-[12px] transition-colors flex items-center justify-between cursor-pointer outline-none",
                    isSelected
                      ? "bg-bg-active text-text-primary font-semibold"
                      : "text-text-secondary hover:bg-bg-hover hover:text-text-primary font-medium"
                  )}
                >
                  <span className="truncate">{preset}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-accent-blue shrink-0" weight="bold" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
