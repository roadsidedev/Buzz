/**
 * useFormValidation - React hook for form validation with Zod
 */

import { useState, useCallback } from "react";
import { z, ZodError, ZodObject } from "zod";

/**
 * Hook for form validation using Zod schemas
 *
 * @example
 * const { handleChange, handleSubmit, errors, data } = useFormValidation({
 *   schema: CreateRoomRequestSchema,
 *   defaultValues: { title: "", type: "debate" }
 * });
 */
export function useFormValidation(schema: ZodObject<any>) {
  const [errors, setErrors] = useState<Record<string, string> | null>(null);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const validateField = useCallback(
    (field: string, value: unknown) => {
      try {
        const fieldSchema = schema.shape[field];
        if (fieldSchema) {
          fieldSchema.parse(value);
          setErrors((prev) => {
            if (!prev) return null;
            const { [field]: _, ...rest } = prev;
            return Object.keys(rest).length > 0 ? rest : null;
          });
        }
      } catch (err) {
        if (err instanceof ZodError) {
          const fieldError = err.errors[0]?.message;
          if (fieldError) {
            setErrors((prev) => ({ ...prev, [field]: fieldError }));
          }
        }
      }
    },
    [schema],
  );

  const handleChange = useCallback(
    (field: string, value: unknown) => {
      validateField(field, value);
    },
    [validateField],
  );

  const validate = useCallback(
    (formData: Record<string, unknown>): boolean => {
      try {
        schema.parse(formData);
        setErrors(null);
        setData(formData as any);
        return true;
      } catch (err) {
        if (err instanceof ZodError) {
          const fieldErrors: Record<string, string> = {};
          err.errors.forEach((error) => {
            const path = error.path.join(".");
            fieldErrors[path] = error.message;
          });
          setErrors(fieldErrors);
        }
        return false;
      }
    },
    [schema],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const data = Object.fromEntries(formData.entries());

      try {
        const parsed = schema.parse(data);
        setErrors(null);
        setData(parsed as any);
        return parsed;
      } catch (err) {
        if (err instanceof ZodError) {
          const fieldErrors: Record<string, string> = {};
          err.errors.forEach((error) => {
            const path = error.path.join(".");
            fieldErrors[path] = error.message;
          });
          setErrors(fieldErrors);
        }
        return null;
      }
    },
    [schema],
  );

  const reset = useCallback(() => {
    setErrors(null);
    setData(null);
  }, []);

  return {
    errors,
    data,
    handleChange,
    handleSubmit,
    validate,
    reset,
    isValid: errors === null && data !== null,
  };
}

/**
 * useApiValidation - Hook for validating API responses
 */
export function useApiValidation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateRequest = useCallback(
    async (schema: ZodObject<any>, data: unknown): Promise<unknown> => {
      try {
        return schema.parse(data);
      } catch (err) {
        if (err instanceof ZodError) {
          setError(err.errors[0]?.message || "Validation failed");
        }
        return null;
      }
    },
    [],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    validateRequest,
    clearError,
    setLoading,
  };
}

export default useFormValidation;
