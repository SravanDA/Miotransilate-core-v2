import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value?: string | string[];
  onChange?: (value: any) => void;
  placeholder?: string;
  multiSelect?: boolean;
  searchable?: boolean;
  disabled?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select option',
  multiSelect = false,
  searchable = false,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isSelected = (val: string) => {
    if (multiSelect && Array.isArray(value)) {
      return value.includes(val);
    }
    return value === val;
  };

  const handleSelect = (val: string) => {
    if (multiSelect) {
      const currentValues = Array.isArray(value) ? value : [];
      const newValues = currentValues.includes(val)
        ? currentValues.filter(v => v !== val)
        : [...currentValues, val];
      onChange?.(newValues);
    } else {
      onChange?.(val);
      setIsOpen(false);
    }
  };

  const handleSelectAll = () => {
    if (multiSelect && onChange) {
      onChange(filteredOptions.map(o => o.value));
    }
  };

  const handleDeselectAll = () => {
    if (multiSelect && onChange) {
      onChange([]);
    }
  };

  const getDisplayText = () => {
    if (multiSelect && Array.isArray(value)) {
      if (value.length === 0) return placeholder;
      if (value.length === 1) return options.find(o => o.value === value[0])?.label || placeholder;
      return `${value.length} selected`;
    }
    const selectedOption = options.find(o => o.value === value);
    return selectedOption ? selectedOption.label : placeholder;
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <button
        type="button"
        className={`w-full flex items-center justify-between bg-white border h-[40px] px-3 rounded-[4px] text-[14px] text-left focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors ${
          isOpen ? 'border-primary' : 'border-input-box hover:border-primary'
        } ${disabled ? 'bg-disable text-disable cursor-not-allowed' : 'text-heading'}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className={`block truncate ${!value || (Array.isArray(value) && value.length === 0) ? 'text-help' : ''}`}>
          {getDisplayText()}
        </span>
        <ChevronDown className="h-4 w-4 text-help" />
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-border-main rounded-[4px] shadow-lg py-1 max-h-60 overflow-auto">
          {searchable && (
            <div className="px-3 py-2 sticky top-0 bg-white z-10 border-b border-border-main">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-4 w-4 text-help" />
                <input
                  type="text"
                  className="w-full pl-9 pr-3 py-1.5 text-[14px] border border-input-box rounded-[4px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              
              {multiSelect && (
                <div className="flex justify-between mt-2 pt-2 border-t border-border-main">
                  <button 
                    type="button"
                    className="text-[12px] font-semibold text-heading bg-secondary px-3 py-1 rounded-[4px] hover:bg-secondary-hover"
                    onClick={(e) => { e.stopPropagation(); handleSelectAll(); }}
                  >
                    Select All
                  </button>
                  <button 
                    type="button"
                    className="text-[12px] font-semibold text-heading px-3 py-1 hover:bg-secondary hover:rounded-[4px]"
                    onClick={(e) => { e.stopPropagation(); handleDeselectAll(); }}
                  >
                    Deselect All
                  </button>
                </div>
              )}
            </div>
          )}

          <ul className="py-1">
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-help">No options found</li>
            ) : (
              filteredOptions.map((option) => (
                <li
                  key={option.value}
                  className={`flex items-center px-3 py-2 text-[14px] cursor-pointer ${
                    isSelected(option.value) ? 'bg-[#EBF2FF] text-primary font-medium' : 'text-heading hover:bg-table-row-even'
                  }`}
                  onClick={() => handleSelect(option.value)}
                >
                  {multiSelect && (
                    <div className={`mr-3 flex h-4 w-4 items-center justify-center rounded border ${
                      isSelected(option.value) ? 'bg-primary border-primary text-white' : 'border-input-box bg-white'
                    }`}>
                      {isSelected(option.value) && <Check className="h-3 w-3" />}
                    </div>
                  )}
                  <span className="block truncate">{option.label}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
