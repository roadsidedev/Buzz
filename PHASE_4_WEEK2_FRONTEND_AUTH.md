# Phase 4 Week 2: Frontend Authentication & Routing

**Week:** 2 of 3  
**Focus:** React Router, Auth store (Zustand), Protected routes, Login/Register pages  
**Days:** 5 (Feb 20-24, 2026)  
**Dependencies:** Week 1 backend auth complete  
**Deliverables:** 6 new pages, auth store, router, 20+ tests

---

## Day 6-7: React Router & Protected Routes

### Task: Set Up React Router

📁 **frontend/src/router/protected-route.tsx** (NEW)

```typescript
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/stores/auth-store";

/**
 * ProtectedRoute: Redirects to login if not authenticated
 */
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !requiredRole.includes(user?.role || "")) {
    return <Navigate to="/discover" replace />;
  }

  return <>{children}</>;
};

/**
 * PublicRoute: Redirects to discover if already authenticated
 */
interface PublicRouteProps {
  children: React.ReactNode;
}

export const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/discover" replace />;
  }

  return <>{children}</>;
};

/**
 * RoleRoute: Restricts access to specific roles
 */
interface RoleRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

export const RoleRoute: React.FC<RoleRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user?.role || "")) {
    return <Navigate to="/discover" replace />;
  }

  return <>{children}</>;
};
```

📁 **frontend/src/router/index.tsx** (NEW)

```typescript
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/stores/auth-store";

// Layout
import MainLayout from "@/components/layouts/main-layout";

// Pages
import LoginPage from "@/pages/login-page";
import RegisterPage from "@/pages/register-page";
import DiscoveryPage from "@/pages/discovery-page";
import RoomLivePage from "@/pages/room-live-page";
import EpisodePlayerPage from "@/pages/episode-player-page";
import ProfilePage from "@/pages/profile-page";
import NotFoundPage from "@/pages/not-found-page";

// Route Guards
import { ProtectedRoute, PublicRoute, RoleRoute } from "./protected-route";

/**
 * AppRouter: Main router configuration
 */
export const AppRouter: React.FC = () => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading application...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />

        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/discover" replace />} />

        {/* Protected Routes */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/discover" element={<DiscoveryPage />} />
          <Route path="/room/:id" element={<RoomLivePage />} />
          <Route path="/episode/:id" element={<EpisodePlayerPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        {/* Admin Routes (optional) */}
        <Route
          element={
            <RoleRoute allowedRoles={["admin", "moderator"]}>
              <MainLayout />
            </RoleRoute>
          }
        >
          {/* Admin pages would go here */}
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
};
```

---

## Day 8: Zustand Auth Store

### Task: Create Auth Store

📁 **frontend/src/stores/auth-store.ts** (NEW)

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  AuthUser,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
} from "@/types/auth";
import { apiClient } from "@/services/api-client";
import logger from "@/utils/logger";

/**
 * AuthStore: Global authentication state management
 * 
 * Persists to localStorage with key 'clawhouse-auth'
 * Handles login, register, logout, token refresh
 */
interface AuthStore {
  // State
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  validateToken: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  clearError: () => void;
}

export const useAuth = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      // Login action
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.post<AuthResponse>(
            "/auth/login",
            { email, password }
          );

          set({
            user: response.user,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });

          // Inject token into future requests
          apiClient.setAuthToken(response.accessToken);

          logger.info("User logged in", { email: response.user.email });
        } catch (err: any) {
          const errorMessage = err.response?.data?.error || "Login failed";
          set({
            error: errorMessage,
            isLoading: false,
            isAuthenticated: false,
          });
          logger.error("Login failed", { error: errorMessage });
          throw err;
        }
      },

      // Register action
      register: async (data: RegisterRequest) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.post<AuthResponse>(
            "/auth/register",
            data
          );

          set({
            user: response.user,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });

          // Inject token into future requests
          apiClient.setAuthToken(response.accessToken);

          logger.info("User registered", { email: response.user.email });
        } catch (err: any) {
          const errorMessage = err.response?.data?.error || "Registration failed";
          set({
            error: errorMessage,
            isLoading: false,
          });
          logger.error("Registration failed", { error: errorMessage });
          throw err;
        }
      },

      // Logout action
      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
        });
        apiClient.clearAuthToken();
        logger.info("User logged out");
      },

      // Validate token on app load
      validateToken: async () => {
        const { accessToken } = get();

        if (!accessToken) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        try {
          apiClient.setAuthToken(accessToken);
          const response = await apiClient.get<{ user: AuthUser }>(
            "/auth/validate"
          );

          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });

          logger.info("Token validated", { userId: response.user.id });
        } catch (err) {
          // Try to refresh token
          const refreshed = await get().refreshAccessToken();

          if (!refreshed) {
            set({
              user: null,
              accessToken: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }

          logger.warn("Token validation failed", { error: err });
        }
      },

      // Refresh access token
      refreshAccessToken: async () => {
        const { refreshToken } = get();

        if (!refreshToken) {
          return false;
        }

        try {
          const response = await apiClient.post<AuthResponse>(
            "/auth/refresh",
            { refreshToken }
          );

          set({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            user: response.user,
            isAuthenticated: true,
          });

          apiClient.setAuthToken(response.accessToken);

          logger.info("Token refreshed");
          return true;
        } catch (err) {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          });
          logger.error("Token refresh failed", { error: err });
          return false;
        }
      },

      // Clear error message
      clearError: () => set({ error: null }),
    }),
    {
      name: "clawhouse-auth", // localStorage key
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
);

/**
 * Hook to validate token on app load
 */
export const useInitializeAuth = () => {
  const validateToken = useAuth((state) => state.validateToken);

  React.useEffect(() => {
    validateToken();
  }, [validateToken]);
};
```

---

## Day 9: Login & Register Pages

### Task: Create Login Page

📁 **frontend/src/pages/login-page.tsx** (NEW)

```typescript
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * LoginPage: User login form
 */
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!email) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Invalid email format";
    }

    if (!password) {
      errors.password = "Password is required";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validate()) return;

    try {
      await login(email, password);
      navigate("/discover");
    } catch (err) {
      // Error is handled by store
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-900 border border-cyan-500 p-8">
          <h1 className="text-3xl font-bold text-cyan-400 mb-8">ClawHouse</h1>
          <h2 className="text-2xl font-bold text-white mb-6">Login</h2>

          {error && (
            <Alert className="mb-6 bg-red-950 border-red-500">
              <AlertDescription className="text-red-200">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                className={
                  validationErrors.email
                    ? "border-red-500 bg-red-950"
                    : "border-cyan-500 bg-slate-800"
                }
              />
              {validationErrors.email && (
                <p className="text-red-400 text-sm mt-1">
                  {validationErrors.email}
                </p>
              )}
            </div>

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
                className={
                  validationErrors.password
                    ? "border-red-500 bg-red-950"
                    : "border-cyan-500 bg-slate-800"
                }
              />
              {validationErrors.password && (
                <p className="text-red-400 text-sm mt-1">
                  {validationErrors.password}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2"
            >
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>

          <p className="text-slate-300 text-sm mt-6">
            Don't have an account?{" "}
            <Link to="/register" className="text-cyan-400 hover:underline">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
```

### Task: Create Register Page

📁 **frontend/src/pages/register-page.tsx** (NEW)

```typescript
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/stores/auth-store";
import { RegisterRequest } from "@/types/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * RegisterPage: User registration form
 */
const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuth();

  const [formData, setFormData] = useState<RegisterRequest>({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validate()) return;

    try {
      await register(formData);
      navigate("/discover");
    } catch (err) {
      // Error is handled by store
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-900 border border-cyan-500 p-8">
          <h1 className="text-3xl font-bold text-cyan-400 mb-8">ClawHouse</h1>
          <h2 className="text-2xl font-bold text-white mb-6">Create Account</h2>

          {error && (
            <Alert className="mb-6 bg-red-950 border-red-500">
              <AlertDescription className="text-red-200">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                className={
                  validationErrors.email
                    ? "border-red-500 bg-red-950"
                    : "border-cyan-500 bg-slate-800"
                }
              />
              {validationErrors.email && (
                <p className="text-red-400 text-sm mt-1">
                  {validationErrors.email}
                </p>
              )}
            </div>

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
                className={
                  validationErrors.username
                    ? "border-red-500 bg-red-950"
                    : "border-cyan-500 bg-slate-800"
                }
              />
              {validationErrors.username && (
                <p className="text-red-400 text-sm mt-1">
                  {validationErrors.username}
                </p>
              )}
            </div>

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
                className={
                  validationErrors.password
                    ? "border-red-500 bg-red-950"
                    : "border-cyan-500 bg-slate-800"
                }
              />
              {validationErrors.password && (
                <p className="text-red-400 text-sm mt-1">
                  {validationErrors.password}
                </p>
              )}
            </div>

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
                className={
                  validationErrors.confirmPassword
                    ? "border-red-500 bg-red-950"
                    : "border-cyan-500 bg-slate-800"
                }
              />
              {validationErrors.confirmPassword && (
                <p className="text-red-400 text-sm mt-1">
                  {validationErrors.confirmPassword}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2"
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <p className="text-slate-300 text-sm mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-cyan-400 hover:underline">
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
```

---

## Day 10: App Integration & Testing

### Task: Update Main App

📁 **frontend/src/App.tsx** (UPDATED)

```typescript
import React, { useEffect } from "react";
import { AppRouter } from "@/router";
import { useAuth, useInitializeAuth } from "@/stores/auth-store";

/**
 * App: Root component
 * 
 * Initializes auth on mount, renders router
 */
const App: React.FC = () => {
  useInitializeAuth();

  return <AppRouter />;
};

export default App;
```

### Task: Write Route Tests

📁 **tests/router/protected-routes.test.tsx** (NEW)

```typescript
import React from "react";
import { render, screen } from "@testing-library/react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute, PublicRoute } from "@/router/protected-route";
import { useAuth } from "@/stores/auth-store";
import { vi } from "vitest";

// Mock useAuth
vi.mock("@/stores/auth-store", () => ({
  useAuth: vi.fn(),
}));

describe("Protected Routes", () => {
  it("should render protected route when authenticated", () => {
    const mockUseAuth = useAuth as any;
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: "1", role: "agent" },
    });

    render(
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("should redirect to login when not authenticated", () => {
    const mockUseAuth = useAuth as any;
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    });

    render(
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </BrowserRouter>
    );

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("should redirect to discover when already authenticated accessing login", () => {
    const mockUseAuth = useAuth as any;
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: "1", role: "agent" },
    });

    render(
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <div>Login Page</div>
              </PublicRoute>
            }
          />
          <Route path="/discover" element={<div>Discover Page</div>} />
        </Routes>
      </BrowserRouter>
    );

    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
    expect(screen.getByText("Discover Page")).toBeInTheDocument();
  });
});
```

### Task: Write Store Tests

📁 **tests/stores/auth-store.test.ts** (NEW)

```typescript
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "@/stores/auth-store";
import { apiClient } from "@/services/api-client";
import { vi } from "vitest";

vi.mock("@/services/api-client");

describe("Auth Store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage
    localStorage.clear();
  });

  it("should login successfully", async () => {
    const { result } = renderHook(() => useAuth());

    const mockResponse = {
      user: { id: "1", email: "test@example.com", username: "testuser", role: "agent" },
      accessToken: "access_token_123",
      refreshToken: "refresh_token_123",
      expiresIn: 3600,
    };

    vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

    await act(async () => {
      await result.current.login("test@example.com", "password");
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe("test@example.com");
    expect(result.current.accessToken).toBe("access_token_123");
  });

  it("should handle login error", async () => {
    const { result } = renderHook(() => useAuth());

    vi.mocked(apiClient.post).mockRejectedValue(
      new Error("Invalid credentials")
    );

    await act(async () => {
      try {
        await result.current.login("test@example.com", "wrong");
      } catch {}
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBeDefined();
  });

  it("should logout successfully", () => {
    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should persist to localStorage", async () => {
    const { result } = renderHook(() => useAuth());

    const mockResponse = {
      user: { id: "1", email: "test@example.com", username: "testuser", role: "agent" },
      accessToken: "access_token_123",
      refreshToken: "refresh_token_123",
      expiresIn: 3600,
    };

    vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

    await act(async () => {
      await result.current.login("test@example.com", "password");
    });

    const stored = JSON.parse(localStorage.getItem("clawhouse-auth") || "{}");
    expect(stored.state.accessToken).toBe("access_token_123");
  });
});
```

---

## Environment Setup

Add to `frontend/.env`:

```bash
VITE_API_URL=http://localhost:4000
VITE_WS_URL=ws://localhost:4000
VITE_LOG_LEVEL=info
```

Update `frontend/tsconfig.json` paths if needed:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

---

## Checklist: Week 2

- [ ] React Router installed and configured
- [ ] Protected routes working (redirect to login)
- [ ] Public routes working (redirect to discover if logged in)
- [ ] Auth store (Zustand) implemented
- [ ] Token persistence in localStorage
- [ ] Login page created and styled
- [ ] Register page created and styled
- [ ] Form validation working
- [ ] Error messages displaying
- [ ] API client token injection working
- [ ] Route tests passing (8+)
- [ ] Store tests passing (10+)
- [ ] Manual testing: signup → login → access protected → logout

---

## Summary

**Week 2 delivers:**
- ✅ React Router with protected routes
- ✅ Auth store (Zustand) with persistence
- ✅ Login page (with validation)
- ✅ Register page (with validation)
- ✅ Token injection into API client
- ✅ Route guards (ProtectedRoute, PublicRoute, RoleRoute)
- ✅ 18+ frontend tests
- ✅ Full TypeScript strict mode

**Week 3:** Security hardening, E2E tests, deployment

