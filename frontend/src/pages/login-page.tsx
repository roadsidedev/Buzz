/**
 * LoginPage: User login form
 *
 * Allows existing users to authenticate with email and password.
 * Includes form validation, error handling, and loading states.
 */

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { logger } from "@/utils/logger";

/**
 * Validation errors for form fields
 */
interface ValidationErrors {
  email?: string;
  password?: string;
}

/**
 * LoginPage component
 */
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuth();

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {},
  );

  /**
   * Validate form inputs
   *
   * Checks:
   * - Email present and valid format
   * - Password present and 8+ chars
   */
  const validate = (): boolean => {
    const errors: ValidationErrors = {};

    // Email validation
    if (!email) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Invalid email format";
    }

    // Password validation
    if (!password) {
      errors.password = "Password is required";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle form submission
   *
   * 1. Validate form
   * 2. Call login action
   * 3. Navigate to discover on success
   * 4. Error handling by auth store
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    // Validate before submission
    if (!validate()) {
      logger.debug("Login form validation failed", {
        hasEmail: !!email,
        hasPassword: !!password,
      });
      return;
    }

    try {
      logger.info("Login attempt", { email });
      await login(email, password);
      logger.info("Login successful, navigating to discover");
      navigate("/discover");
    } catch (err) {
      // Error handled by auth store
      logger.error("Login error caught in component", { error: err });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-900 border-2 border-cyan-500 p-8">
          {/* Header */}
          <h1 className="text-3xl font-bold text-cyan-400 mb-2">ClawHouse</h1>
          <h2 className="text-2xl font-bold text-white mb-6">Login</h2>

          {/* Error Alert */}
          {error && (
            <Alert className="mb-6 bg-red-950 border-2 border-red-500">
              <AlertDescription className="text-red-200">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError();
                }}
                placeholder="your@email.com"
                disabled={isLoading}
                className={`
                  border-2 bg-slate-800 text-white placeholder-slate-500
                  focus:outline-none focus:ring-2 focus:ring-cyan-500
                  ${
                    validationErrors.email
                      ? "border-red-500 bg-red-950"
                      : "border-cyan-500"
                  }
                `}
              />
              {validationErrors.email && (
                <p className="text-red-400 text-sm mt-1">
                  {validationErrors.email}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError();
                }}
                placeholder="••••••••"
                disabled={isLoading}
                className={`
                  border-2 bg-slate-800 text-white placeholder-slate-500
                  focus:outline-none focus:ring-2 focus:ring-cyan-500
                  ${
                    validationErrors.password
                      ? "border-red-500 bg-red-950"
                      : "border-cyan-500"
                  }
                `}
              />
              {validationErrors.password && (
                <p className="text-red-400 text-sm mt-1">
                  {validationErrors.password}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2 border-2 border-cyan-500 disabled:opacity-50"
            >
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>

          {/* Register Link */}
          <p className="text-slate-300 text-sm mt-6 text-center">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-cyan-400 hover:underline font-medium"
            >
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export { LoginPage };
