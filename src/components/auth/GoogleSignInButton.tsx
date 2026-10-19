import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

interface GoogleSignInButtonProps {
  className?: string;
  size?: "default" | "sm" | "lg";
  variant?: "editorial" | "outline" | "compact";
  text?: string;
  onSuccess?: () => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_black" | "filled_blue";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle";
              logo_alignment?: "left" | "center";
              width?: number;
              locale?: string;
            },
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("size-4 shrink-0", className)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function GoogleSignInButton({
  className,
  size = "default",
  variant = "editorial",
  text = "Continue with Google",
  onSuccess,
}: GoogleSignInButtonProps) {
  const { loginWithGoogle, config, isLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const clientId = config.googleClientId;

  const handleClick = () => {
    if (!clientId) {
      toast.error(
        "Google Sign-In is not configured yet. Add GOOGLE_CLIENT_ID to server/.env to enable live sign-in.",
      );
      return;
    }

    // Direct Google OAuth2 token client popup for custom styled button
    if (window.google?.accounts?.oauth2) {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "openid profile email",
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              if (tokenResponse.error !== "popup_closed_by_user") {
                toast.error(`Google authentication error: ${tokenResponse.error}`);
              }
              return;
            }
            if (!tokenResponse.access_token) {
              toast.error("Google did not return credentials. Please try again.");
              return;
            }
            setIsSubmitting(true);
            try {
              await loginWithGoogle({ accessToken: tokenResponse.access_token });
              onSuccess?.();
            } catch {
              // Handled in context
            } finally {
              setIsSubmitting(false);
            }
          },
        });
        client.requestAccessToken({ prompt: "select_account" });
        return;
      } catch (err) {
        console.error("TokenClient error:", err);
      }
    }

    // Fallback to Google Identity Services One Tap prompt if available
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt();
      } catch {
        // Fallback prompt error ignore
      }
    } else {
      toast.info("Connecting to Google authentication service… Please wait a moment.");
    }
  };

  const loading = isLoading || isSubmitting;

  const sizeClass =
    variant === "compact"
      ? "h-9 px-3 text-xs sm:text-sm font-medium"
      : size === "sm"
        ? "h-8 px-3 text-xs font-medium"
        : size === "lg"
          ? "h-11 px-5 text-base font-medium"
          : "h-10 px-4 text-sm font-medium";

  return (
    <div className="relative inline-block">
      <button
        type="button"
        disabled={loading}
        onClick={handleClick}
        className={cn(
          "google-signin-btn relative inline-flex items-center justify-center gap-2.5 rounded-sm font-medium leading-none select-none transition-all duration-150 cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4285F4] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none",
          sizeClass,
          className,
        )}
        data-testid="google-signin-button"
        aria-label={text}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin shrink-0 opacity-70" aria-hidden="true" />
        ) : (
          <GoogleIcon className="size-4 shrink-0" />
        )}
        <span className="leading-none whitespace-nowrap">{loading ? "Authenticating…" : text}</span>
      </button>
    </div>
  );
}
