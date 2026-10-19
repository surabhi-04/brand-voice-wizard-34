import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  getAuthConfig,
  getCurrentUser,
  logoutUser,
  signInWithGoogle,
  type AuthConfig,
  type AuthUser,
} from "./auth-service";

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  config: AuthConfig;
  loginWithGoogle: (
    credentialOrTokens: string | { idToken?: string; accessToken?: string },
  ) => Promise<AuthUser>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const defaultAuthConfig: AuthConfig = {
  googleClientId: null,
  isGoogleConfigured: false,
  isJwtConfigured: false,
  isDbConfigured: false,
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  initialUser,
  skipInitialCheck = false,
}: {
  children: ReactNode;
  initialUser?: AuthUser | null;
  skipInitialCheck?: boolean;
}) {
  const [user, setUser] = useState<AuthUser | null>(initialUser ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(
    skipInitialCheck ? false : initialUser === undefined,
  );
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AuthConfig>(defaultAuthConfig);

  // Load public auth configuration from server
  useEffect(() => {
    let mounted = true;
    getAuthConfig().then((cfg) => {
      if (mounted) setConfig(cfg);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Check active session on initial page load
  const checkSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const activeUser = await getCurrentUser();
      setUser(activeUser);
      setError(null);
    } catch (err) {
      setUser(null);
      setError(err instanceof Error ? err.message : "Failed to verify session.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!skipInitialCheck && initialUser === undefined) {
      void checkSession();
    }
  }, [checkSession, initialUser, skipInitialCheck]);

  const loginWithGoogle = useCallback(
    async (credentialOrTokens: string | { idToken?: string; accessToken?: string }) => {
      setIsLoading(true);
      setError(null);
      try {
        const authenticatedUser = await signInWithGoogle(credentialOrTokens);
        setUser(authenticatedUser);
        toast.success(`Welcome back, ${authenticatedUser.name.split(" ")[0]}!`);
        return authenticatedUser;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Google authentication failed.";
        setError(message);
        toast.error(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Initialize GIS globally once when Google Client ID is loaded
  useEffect(() => {
    if (!config.googleClientId || typeof window === "undefined") return;

    function initGlobalGIS() {
      if (!window.google?.accounts?.id || !config.googleClientId) return;
      try {
        window.google.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: (response) => {
            if (response.credential) {
              void loginWithGoogle(response.credential);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });
      } catch {
        // Ignore duplicate init
      }
    }

    if (window.google?.accounts?.id) {
      initGlobalGIS();
    } else {
      const timer = setInterval(() => {
        if (window.google?.accounts?.id) {
          initGlobalGIS();
          clearInterval(timer);
        }
      }, 300);
      return () => clearInterval(timer);
    }
  }, [config.googleClientId, loginWithGoogle]);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await logoutUser();
      setUser(null);
      toast.success("You have been signed out.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        config,
        loginWithGoogle,
        logout,
        checkSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Graceful fallback for isolated tests or unprovided wrappers
    return {
      user: null,
      isLoading: false,
      error: null,
      config: defaultAuthConfig,
      loginWithGoogle: async () => ({ id: "mock", name: "Mock", email: "mock@example.com" }),
      logout: async () => {},
      checkSession: async () => {},
    };
  }
  return ctx;
}
