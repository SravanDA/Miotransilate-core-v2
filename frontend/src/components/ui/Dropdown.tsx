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
        className={`flex items-center justify-between w-full h-9 px-3 bg-white text-[15px] font-[400] text-[#172B4D] cursor-pointer outline-none transition-colors ${
          isOpen ? "border border-[#0C66E4]" : "border border-[#DFE1E6] hover:bg-[#F4F5F7]"
        } ${disabled ? "opacity-60 cursor-not-allowed bg-[#F4F5F7]" : ""} rounded`}
      >
        <span className="truncate pr-4">{selectedLabel}</span>
        <CaretDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} weight="bold" />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 min-w-full min-w-[200px] mt-1 bg-white border border-[#DFE1E6] rounded shadow-[0_3px_5px_-1px_rgba(0,0,0,0.1),0_6px_10px_0_rgba(0,0,0,0.07)] max-h-[300px] overflow-y-auto py-2 custom-scrollbar">
          {options.map((item, index) => {
            if (isGroup(item)) {
              return (
                <div key={index}>
                  <div className="px-4 pt-3 pb-2 text-[15px] font-bold text-[#172B4D]">
                    {item.groupLabel}
                  </div>
                  {item.options.map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full text-left px-4 py-2 text-[15px] font-[400] text-[#172B4D] transition-colors ${
                        opt.value === value ? "bg-[#DDEBFF]" : "hover:bg-[#DDEBFF]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              );
            } else {
              return (
                <button
                  type="button"
                  key={item.value}
                  onClick={() => handleSelect(item.value)}
                  className={`w-full text-left px-4 py-2 text-[15px] font-[400] text-[#172B4D] transition-colors ${
                    item.value === value ? "bg-[#DDEBFF]" : "hover:bg-[#DDEBFF]"
                  }`}
                >
                  {item.label}
                </button>
              );
            }
          })}
        </div>
      )}
    </div>
  );
}
