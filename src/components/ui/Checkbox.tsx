import React, { useId } from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  description,
  id,
  className = '',
  onChange,
  onCheckedChange,
  ...rest
}) => {
  const generatedId = useId();
  const boxId = id ?? generatedId;
  return (
    <label
      htmlFor={boxId}
      className={`flex ${label || description ? 'min-h-[44px]' : ''} items-start gap-3 cursor-pointer ${className}`}
    >
      <input
        id={boxId}
        type="checkbox"
        onChange={(e) => {
          onChange?.(e);
          onCheckedChange?.(e.target.checked);
        }}
        className="mt-1 h-5 w-5 rounded border-border text-brand focus:ring-brand accent-brand cursor-pointer"
        {...rest}
      />
      {(label || description) && (
        <span className="text-sm">
          {label && <span className="block font-medium text-text-primary">{label}</span>}
          {description && <span className="block text-xs text-text-secondary">{description}</span>}
        </span>
      )}
    </label>
  );
};

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

export const Radio: React.FC<RadioProps> = ({
  label,
  description,
  id,
  className = '',
  ...rest
}) => {
  const generatedId = useId();
  const radioId = id ?? generatedId;
  return (
    <label htmlFor={radioId} className={`flex min-h-[44px] items-start gap-3 cursor-pointer ${className}`}>
      <input
        id={radioId}
        type="radio"
        className="mt-1 h-5 w-5 border-border text-brand focus:ring-brand accent-brand cursor-pointer"
        {...rest}
      />
      <span className="text-sm">
        <span className="block font-medium text-text-primary">{label}</span>
        {description && <span className="block text-xs text-text-secondary">{description}</span>}
      </span>
    </label>
  );
};
