import React from 'react';
import { Search, X } from 'lucide-react';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  label?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export const SearchField: React.FC<SearchFieldProps> = ({
  value,
  onChange,
  onClear,
  placeholder = 'Search',
  label = 'Search',
  inputRef,
}) => {
  return (
    <div className="relative flex items-center">
      <Search
        className="pointer-events-none absolute start-3 h-4 w-4 text-text-secondary"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="w-full min-h-[44px] rounded-xl border border-border bg-surface-sunken ps-9 pe-9 text-sm text-text-primary placeholder:text-text-secondary/80 focus:border-brand focus:bg-surface-raised focus:outline-none"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange('');
            onClear?.();
          }}
          className="absolute end-1.5 flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-raised cursor-pointer"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
