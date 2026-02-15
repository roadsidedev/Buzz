/**
 * RegisterPage: User registration form
 * 
 * Allows new users to create an account with email, username, and password.
 * Includes comprehensive form validation and error handling.
 */

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/stores/auth-store";
import { RegisterRequest } from "@/types/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import logger from "@/utils/logger";

/**
 * Validation errors for form fields
 */
interface ValidationErrors {
  email?: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
}

/**
 * RegisterPage component
 */
const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuth();

  // Form state
  const [formData, setFormData] = useState<RegisterRequest>({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  /**
   * Validate form inputs
   * 
   * Checks:
   * - Email valid format and unique (server checks uniqueness)
   * - Username 3-30 characters
   * - Password 8+ characters
   * - Passwords match
   */
  const validate = (): boolean => {
    const errors: ValidationErrors = {};

    // Email validation
    if (!formData.email) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Invalid email format";
    }

    // Username validation
    if (!formData.username) {
      errors.username = "Username is required";
    } else if (formData.username.length < 3) {
      errors.username = "Username must be at least 3 characters";
    } else if (formData.username.length > 30) {
      errors.username = "Username must be at most 30 characters";
    }

    // Password validation
    if (!formData.password) {
      errors.password = "Password is required";
    } else if (formData.password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }

    // Confirm password
    if (!formData.confirmPassword) {
      errors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle form field change
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    clearError();
  };

  /**
   * Handle form submission
   * 
   * 1. Validate form
   * 2. Call register action
   * 3. Navigate to discover on success
   * 4. Error handling by auth store
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    // Validate before submission
    if (!validate()) {
      logger.debug("Registration form validation failed", {
        hasEmail: !!formData.email,
        hasUsername: !!formData.username,
        hasPassword: !!formData.password,
      });
      return;
    }

    try {
      logger.info("Registration attempt", { email: formData.email });
      await register(formData);
      logger.info("Registration successful, navigating to discover");
      navigate("/discover");
    } catch (err) {
      // Error handled by auth store
      logger.error("Registration error caught in component", { error: err });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-900 border-2 border-cyan-500 p-8">
          {/* Header */}
          <h1 className="text-3xl font-bold text-cyan-400 mb-2">ClawHouse</h1>
          <h2 className="text-2xl font-bold text-white mb-6">Create Account</h2>

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
                name="email"
                value={formData.email}
                onChange={handleChange}
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

            {/* Username Field */}
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Username
              </label>
              <Input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="your_username"
                disabled={isLoading}
                className={`
                  border-2 bg-slate-800 text-white placeholder-slate-500
                  focus:outline-none focus:ring-2 focus:ring-cyan-500
                  ${
                    validationErrors.username
                      ? "border-red-500 bg-red-950"
                      : "border-cyan-500"
                  }
                `}
              />
              {validationErrors.username && (
                <p className="text-red-400 text-sm mt-1">
                  {validationErrors.username}
                </p>
              )}
              <p className="text-slate-400 text-xs mt-1">
                3-30 characters, letters and underscores
              </p>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Password
              </label>
              <Input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
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
              <p className="text-slate-400 text-xs mt-1">
                Minimum 8 characters
              </p>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Confirm Password
              </label>
              <Input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                disabled={isLoading}
                className={`
                  border-2 bg-slate-800 text-white placeholder-slate-500
                  focus:outline-none focus:ring-2 focus:ring-cyan-500
                  ${
                    validationErrors.confirmPassword
                      ? "border-red-500 bg-red-950"
                      : "border-cyan-500"
                  }
                `}
              />
              {validationErrors.confirmPassword && (
                <p className="text-red-400 text-sm mt-1">
                  {validationErrors.confirmPassword}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2 border-2 border-cyan-500 disabled:opacity-50"
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          {/* Login Link */}
          <p className="text-slate-300 text-sm mt-6 text-center">
            Already have an account?{" "}
            <Link to="/login" className="text-cyan-400 hover:underline font-medium">
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
