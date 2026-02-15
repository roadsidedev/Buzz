/**
 * Textarea Component (Neobrutalism Design)
 *
 * A wrapper around HTML textarea with consistent styling,
 * character count, and validation states.
 *
 * Features:
 * - 2px black border with cyan focus state
 * - Optional character count display
 * - Max length support with visual feedback
 * - Label and error message support
 * - Resizable with minimum height
 * - Full TypeScript support
 * - Accessible
 */

import React, { useState } from "react";

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  showCharCount?: boolean;
  fullWidth?: boolean;
}

/**
 * Textarea Component
 *
 * @example
 * <Textarea label="Description" placeholder="Enter description..." />
 * <Textarea label="Message" maxLength={500} showCharCount />
 * <Textarea label="Bio" error="Too long" />
 */
export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  helperText,
  showCharCount = false,
  fullWidth = true,
  maxLength,
  value,
  className = "",
  id = "",
  onChange,
  ...props
}) => {
  const [charCount, setCharCount] = useState(
    typeof value === "string" ? value.length : 0
  );

  const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCharCount(e.target.value.length);
    onChange?.(e);
  };

  return (
    <div className={fullWidth ? "w-full" : ""}>
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-sm font-bold uppercase tracking-wide mb-2"
        >
          {label}
          {props.required && <span className="text-error ml-1">*</span>}
        </label>
      )}

      <textarea
        id={textareaId}
        maxLength={maxLength}
        value={value}
        onChange={handleChange}
        className={`
          w-full
          px-4 py-3
          min-h-[120px]
          bg-base-white
          text-base-black
          placeholder-base-gray-400
          border-2
          ${error ? "border-error" : "border-base-black"}
          focus:outline-none
          focus:border-primary-500
          focus:ring-3
          focus:ring-primary-50
          transition-all duration-200
          resize-vertical
          disabled:opacity-50 disabled:cursor-not-allowed
          font-mono text-sm
          ${className}
        `}
        aria-invalid={!!error}
        aria-describedby={
          error
            ? `${textareaId}-error`
            : helperText || showCharCount
              ? `${textareaId}-helper`
              : undefined
        }
        {...props}
      />

      <div className="flex justify-between items-center mt-2">
        <div>
          {error && (
            <p
              id={`${textareaId}-error`}
              className="text-sm text-error font-medium"
              role="alert"
            >
              {error}
            </p>
          )}

          {helperText && !error && (
            <p
              id={`${textareaId}-helper`}
              className="text-sm text-base-gray-500"
            >
              {helperText}
            </p>
          )}
        </div>

        {showCharCount && (
          <p className="text-xs text-base-gray-500 font-mono">
            {charCount}
            {maxLength ? `/${maxLength}` : ""}
          </p>
        )}
      </div>
    </div>
  );
};

export default Textarea;
