import { useState, useRef, useEffect } from "react";
import { CaretDown } from "@phosphor-icons/react";

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownGroup {
  groupLabel: string;
  options: DropdownOption[];
}

export type DropdownItem = DropdownOption | DropdownGroup;

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownItem[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// Type guard
function isGroup(item: DropdownItem): item is DropdownGroup {
  return (item as DropdownGroup).groupLabel !== undefined;
}

export function Dropdown({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  className = "",
  disabled = false,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Find the selected label
  let selectedLabel = placeholder;
  for (const item of options) {
    if (isGroup(item)) {
      const found = item.options.find((opt) => opt.value === value);
      if (found) {
        selectedLabel = found.label;
        break;
      }
    } else {
      if (item.value === value) {
        selectedLabel = item.label;
        break;
      }
    }
  }

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full h-8 px-2.5 bg-bg-card text-[13px] font-medium text-text-primary cursor-pointer outline-none transition-colors ${
          isOpen ? "border border-border-strong" : "border border-border-subtle hover:bg-bg-hover"
        } ${disabled ? "opacity-60 cursor-not-allowed bg-bg-hover" : ""} rounded-md`}
      >
        <span className="truncate pr-3">{selectedLabel}</span>
        <CaretDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${isOpen ? "rotate-180 text-text-primary" : "text-text-tertiary"}`} weight="bold" />
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 top-full z-[999] min-w-full min-w-[210px] mt-1 bg-bg-card border border-border-strong rounded-xl max-h-[300px] overflow-y-auto py-1.5 scrollbar-none shadow-2xl">
          {options.map((item, index) => {
            if (isGroup(item)) {
              return (
                <div key={index}>
                  <div className="px-3 pt-2 pb-1.5 text-[11px] font-bold text-text-tertiary uppercase tracking-wider">
                    {item.groupLabel}
                  </div>
                  {item.options.map((opt) => {
                    const isSelected = opt.value === value;
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => handleSelect(opt.value)}
                        className={`w-full text-left px-3 py-1.5 text-[12px] font-medium transition-colors outline-none cursor-pointer flex items-center justify-between ${
                          isSelected ? "bg-bg-active text-accent-blue font-semibold" : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                        }`}
                      >
                        <span className="truncate">{opt.label}</span>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-accent-blue ml-2 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              );
            } else {
              const isSelected = item.value === value;
              return (
                <button
                  type="button"
                  key={item.value}
                  onClick={() => handleSelect(item.value)}
                  className={`w-full text-left px-3 py-1.5 text-[12px] font-medium transition-colors outline-none cursor-pointer flex items-center justify-between ${
                    isSelected ? "bg-bg-active text-accent-blue font-semibold" : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-accent-blue ml-2 shrink-0" />}
                </button>
              );
            }
          })}
        </div>
      )}
    </div>
  );
}
