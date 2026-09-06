'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MultiSelect({ options, selectedValues, onChange, placeholder = 'Select...', disabled = false }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    if (disabled) return;
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const displayValue = selectedValues.length === 0
    ? <span className="text-stitch-secondary">{placeholder}</span>
    : <span className="text-stitch-on-surface truncate pr-2">
        {selectedValues.map(v => options.find(o => o.value === v)?.label || v).join(', ')}
      </span>;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          "w-full flex items-center justify-between text-left bg-stitch-surface border border-stitch-outline-variant px-3 py-2 text-sm font-sans transition-colors",
          disabled ? "opacity-70 cursor-not-allowed text-stitch-secondary" : "focus:border-stitch-primary hover:border-stitch-primary text-stitch-on-surface"
        )}
      >
        <div className="flex-1 overflow-hidden">{displayValue}</div>
        <ChevronDown className="w-4 h-4 text-stitch-secondary flex-shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-stitch-surface border border-stitch-outline-variant shadow-lg shadow-black/20 dark:shadow-black/60">
          {options.length === 0 ? (
            <div className="px-4 py-3 text-sm font-mono text-stitch-secondary">No options available</div>
          ) : (
            options.map((option) => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleOption(option.value)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-stitch-surface-container-highest transition-colors"
                >
                  <span className={clsx(
                    "font-sans",
                    isSelected ? "text-stitch-on-surface font-semibold" : "text-stitch-secondary"
                  )}>
                    {option.label}
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-stitch-primary" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
