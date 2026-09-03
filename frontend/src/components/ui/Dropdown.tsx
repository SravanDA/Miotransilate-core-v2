import { useState, useRef, useEffect } from "react";
import { CaretDown, Check } from "@phosphor-icons/react";

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
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

  // Find the selected label and icon
  let selectedLabel = placeholder;
  let selectedIcon: React.ReactNode = undefined;

  for (const item of options) {
    if (isGroup(item)) {
      const found = item.options.find((opt) => opt.value === value);
      if (found) {
        selectedLabel = found.label;
        selectedIcon = found.icon;
        break;
      }
    } else {
      if (item.value === value) {
        selectedLabel = item.label;
        selectedIcon = item.icon;
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
        className={`flex items-center justify-between w-full h-8 px-2.5 bg-bg-card text-[12px] font-medium text-text-primary cursor-pointer outline-none transition-all ${
          isOpen ? "border border-border-strong ring-1 ring-border-strong/50" : "border border-border-subtle hover:border-border-strong hover:bg-bg-hover"
        } ${disabled ? "opacity-60 cursor-not-allowed bg-bg-hover" : ""} rounded-lg `}
      >
        <div className="flex items-center gap-1.5 truncate pr-2 min-w-0">
          {selectedIcon && <span className="shrink-0 flex items-center">{selectedIcon}</span>}
          <span className="truncate">{selectedLabel}</span>
        </div>
        <CaretDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${isOpen ? "rotate-180 text-text-primary" : "text-text-tertiary"}`} weight="bold" />
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 top-full z-[999] min-w-full min-w-[200px] mt-1 bg-bg-card border border-border-strong rounded-xl max-h-[300px] overflow-y-auto p-1 scrollbar-none flex flex-col gap-0.5 animate-fadeIn shadow-lg">
          {options.map((item, index) => {
            if (isGroup(item)) {
              return (
                <div key={index} className="flex flex-col gap-0.5">
                  <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                    {item.groupLabel}
                  </div>
                  {item.options.map((opt) => {
                    const isSelected = opt.value === value;
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => handleSelect(opt.value)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors outline-none cursor-pointer flex items-center justify-between ${
                          isSelected ? "bg-bg-active text-accent-blue font-semibold" : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {opt.icon && <span className="shrink-0 flex items-center">{opt.icon}</span>}
                          <span className="truncate">{opt.label}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-accent-blue ml-2 shrink-0" weight="bold" />}
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
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors outline-none cursor-pointer flex items-center justify-between ${
                    isSelected ? "bg-bg-active text-accent-blue font-semibold" : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {optIcon(item) && <span className="shrink-0 flex items-center">{item.icon}</span>}
                    <span className="truncate">{item.label}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-accent-blue ml-2 shrink-0" weight="bold" />}
                </button>
              );
            }
          })}
        </div>
      )}
    </div>
  );
}

function optIcon(item: DropdownOption) {
  return item.icon !== undefined;
}
