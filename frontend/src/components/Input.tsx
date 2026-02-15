/**
 * Input Component (Neobrutalism Design)
 *
 * A wrapper around HTML input with consistent styling,
 * validation states, and label support.
 *
 * Features:
 * - 2px black border with cyan focus state
 * - Supports text, email, password, number, search
 * - Optional label and error message display
 * - Helper text support
 * - Full TypeScript support
 * - Accessible with proper aria attributes
 */

import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

/**
 * Input Component
 *
 * @example
 * <Input type="text" label="Name" placeholder="John Doe" />
 * <Input type="email" label="Email" error="Invalid email format" />
 * <Input type="password" label="Password" helperText="Min 8 characters" />
 */
export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  fullWidth = true,
  className = "",
  id = "",
  type = "text",
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={fullWidth ? "w-full" : ""}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-bold uppercase tracking-wide mb-2"
        >
          {label}
          {props.required && <span className="text-error ml-1">*</span>}
        </label>
      )}

      <input
        id={inputId}
        type={type}
        className={`
          w-full
          px-4 py-3
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
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
        }
        {...props}
      />

      {error && (
        <p
          id={`${inputId}-error`}
          className="text-sm text-error font-medium mt-1"
          role="alert"
        >
          {error}
        </p>
      )}

      {helperText && !error && (
        <p
          id={`${inputId}-helper`}
          className="text-sm text-base-gray-500 mt-1"
        >
          {helperText}
        </p>
      )}
    </div>
  );
};

export default Input;
