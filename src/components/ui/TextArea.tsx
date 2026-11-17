import React, { useId } from 'react';

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, hint, id, className = '', ...rest }, ref) => {
    const generatedId = useId();
    const areaId = id ?? generatedId;
    const errorId = `${areaId}-error`;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={areaId} className="block text-sm font-medium text-text-primary">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={areaId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`w-full rounded-xl border bg-surface-raised px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/70 transition-colors focus:border-brand focus:outline-none disabled:opacity-60 ${
            error ? 'border-danger' : 'border-border'
          } ${className}`}
          {...rest}
        />
        {hint && !error && <p className="text-xs text-text-secondary">{hint}</p>}
        {error && (
          <p id={errorId} role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    );
  },
);

TextArea.displayName = 'TextArea';
