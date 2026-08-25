"use client";

import { useEffect, useRef, useState } from "react";

const GSI_SRC = "https://accounts.google.com/gsi/client";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdentityApi {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        auto_select?: boolean;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: {
          theme?: "outline" | "filled_blue" | "filled_black";
          size?: "small" | "medium" | "large";
          text?: "signin_with" | "signup_with" | "continue_with";
          shape?: "rectangular" | "pill";
          width?: number;
          logo_alignment?: "left" | "center";
        },
      ) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

/** Loads the Google Identity Services script once per page. */
function loadGsi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("script failed")));
      return;
    }

    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("script failed"));
    document.head.appendChild(script);
  });
}

interface Props {
  /** Called with the Google ID token once the user picks an account */
  onCredential: (idToken: string) => void;
  text?: "signin_with" | "signup_with" | "continue_with";
}

/**
 * Renders Google's official sign-in button. Returns null when no client id is
 * configured, so the rest of the form still works without Google set up.
 */
export default function GoogleSignInButton({ onCredential, text = "continue_with" }: Props) {
  const holderRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const [failed, setFailed] = useState(false);

  // Keep the latest callback without forcing the button to re-render
  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!CLIENT_ID) return;

    let cancelled = false;

    loadGsi()
      .then(() => {
        if (cancelled || !holderRef.current || !window.google) return;

        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => {
            if (response.credential) callbackRef.current(response.credential);
          },
        });

        holderRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(holderRef.current, {
          theme: "outline",
          size: "large",
          text,
          shape: "pill",
          width: 320,
          logo_alignment: "center",
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [text]);

  if (!CLIENT_ID) return null;

  if (failed) {
    return (
      <p className="text-center text-xs text-ink-faint">
        Google sign-in could not load. Check your connection, or use your email and password.
      </p>
    );
  }

  return <div ref={holderRef} className="flex justify-center [color-scheme:light]" />;
}

export const googleConfigured = Boolean(CLIENT_ID);
