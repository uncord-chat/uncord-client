"use client";

import {
  acceptOnboarding,
  getOnboardingConfig,
  getOnboardingStatus,
  joinInvite,
  joinServer,
  resendVerification,
} from "@/lib/api/client";
import { fetchWithRefresh, type FetchResult } from "@/lib/api/fetch-with-refresh";
import { useAuthActions, useAuthState, useCurrentServer } from "@/lib/auth/auth-context";
import type { OnboardingConfig } from "@uncord-chat/protocol/models/onboarding";
import type { OnboardingStep as ProtocolStep } from "@uncord-chat/protocol/models/onboarding";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type OnboardingStep = ProtocolStep | "loading";

type OnboardingState = {
  step: OnboardingStep;
  config: OnboardingConfig | null;
  error: string | null;
  /** Invite code stored after a join attempt was blocked by email verification. */
  pendingInviteCode: string | null;
};

type OnboardingActions = {
  resendVerification: () => Promise<void>;
  joinServer: () => Promise<void>;
  joinWithInvite: (code: string) => Promise<void>;
  acceptDocuments: (slugs: string[]) => Promise<void>;
  refreshStep: () => Promise<void>;
};

const OnboardingStateContext = createContext<OnboardingState | null>(null);
const OnboardingActionsContext = createContext<OnboardingActions | null>(null);

// ---------------------------------------------------------------------------
// Pure helpers extracted from determineStep for testability.
// ---------------------------------------------------------------------------

type StepContext = {
  serverId: string;
  baseUrl: string;
  refreshSession: (serverId: string) => Promise<void>;
};

/** Re-fetch the onboarding status and return the new step. */
async function refetchStep(ctx: StepContext): Promise<FetchResult<ProtocolStep>> {
  const result = await fetchWithRefresh(ctx.serverId, ctx.baseUrl, getOnboardingStatus, ctx.refreshSession);
  if (!result.ok) return result;
  return { ok: true, data: result.data.step };
}

/** Attempt to join via an invite code. Returns the new step on success, or null if blocked. */
async function attemptInviteJoin(
  ctx: StepContext,
  code: string,
): Promise<{ step: ProtocolStep } | { blocked: "EMAIL_NOT_VERIFIED" } | { error: string }> {
  const joinResult = await fetchWithRefresh(
    ctx.serverId,
    ctx.baseUrl,
    (url, token) => joinInvite(url, token, code),
    ctx.refreshSession,
  );
  if (joinResult.ok || joinResult.code === "ALREADY_MEMBER") {
    const newStatus = await refetchStep(ctx);
    return { step: newStatus.ok ? newStatus.data : "join_server" };
  }
  if (joinResult.code === "EMAIL_NOT_VERIFIED") {
    return { blocked: "EMAIL_NOT_VERIFIED" };
  }
  return { error: joinResult.reason };
}

/** Attempt an open join. Returns the new step on success, or null if blocked. */
async function attemptOpenJoin(
  ctx: StepContext,
): Promise<{ step: ProtocolStep } | { blocked: "EMAIL_NOT_VERIFIED" } | { error: string }> {
  const joinResult = await fetchWithRefresh(ctx.serverId, ctx.baseUrl, joinServer, ctx.refreshSession);
  if (joinResult.ok || joinResult.code === "ALREADY_MEMBER") {
    const newStatus = await refetchStep(ctx);
    return { step: newStatus.ok ? newStatus.data : "join_server" };
  }
  if (joinResult.code === "EMAIL_NOT_VERIFIED") {
    return { blocked: "EMAIL_NOT_VERIFIED" };
  }
  return { error: joinResult.reason };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { currentServerId } = useAuthState();
  const currentServer = useCurrentServer();
  const { refreshSession } = useAuthActions();

  const [step, setStep] = useState<OnboardingStep>("loading");
  const [config, setConfig] = useState<OnboardingConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);

  const fetchIdRef = useRef(0);
  const pendingInviteCodeRef = useRef<string | null>(null);
  const pendingOpenJoinRef = useRef(false);

  const determineStep = useCallback(async () => {
    if (!currentServerId || !currentServer) return;

    const id = ++fetchIdRef.current;
    const ctx: StepContext = { serverId: currentServerId, baseUrl: currentServer.baseUrl, refreshSession };
    const isCurrent = () => id === fetchIdRef.current;

    const statusResult = await fetchWithRefresh(currentServerId, ctx.baseUrl, getOnboardingStatus, refreshSession);
    if (!isCurrent()) return;

    if (!statusResult.ok) {
      setError(statusResult.reason);
      return;
    }

    let serverStep = statusResult.data.step;
    let configFetched = false;

    // Handle join_server step with various auto-join scenarios.
    if (serverStep === "join_server") {
      if (pendingInviteCodeRef.current) {
        const result = await attemptInviteJoin(ctx, pendingInviteCodeRef.current);
        if (!isCurrent()) return;

        if ("step" in result) {
          pendingInviteCodeRef.current = null;
          setPendingInviteCode(null);
          serverStep = result.step;
        } else if ("blocked" in result) {
          return; // Stay on verify_email
        }
        // Other errors: fall through and show whatever step the server says
      } else if (pendingOpenJoinRef.current) {
        const result = await attemptOpenJoin(ctx);
        if (!isCurrent()) return;

        if ("step" in result) {
          pendingOpenJoinRef.current = false;
          serverStep = result.step;
        } else if ("blocked" in result) {
          return; // Stay on verify_email
        }
      } else {
        // First time seeing join_server — fetch config to check if public.
        const configResult = await fetchWithRefresh(currentServerId, ctx.baseUrl, getOnboardingConfig, refreshSession);
        if (!isCurrent()) return;

        if (configResult.ok) {
          setConfig(configResult.data);
          configFetched = true;

          if (configResult.data.open_join) {
            const result = await attemptOpenJoin(ctx);
            if (!isCurrent()) return;

            if ("step" in result) {
              serverStep = result.step;
            } else if ("blocked" in result) {
              pendingOpenJoinRef.current = true;
              setStep("verify_email");
              setError(null);
              return;
            }
          }
        }
      }
    }

    if (serverStep !== "complete" && !configFetched) {
      const configResult = await fetchWithRefresh(currentServerId, ctx.baseUrl, getOnboardingConfig, refreshSession);
      if (!isCurrent()) return;

      if (configResult.ok) {
        setConfig(configResult.data);
      }
    }

    setStep(serverStep);
    setError(null);
  }, [currentServerId, currentServer, refreshSession]);

  // Track whether onboarding has completed so we don't reset the authenticated
  // layout when determineStep is recreated due to a dependency change.
  const completedRef = useRef(false);
  useEffect(() => {
    if (step === "complete") completedRef.current = true;
  }, [step]);

  useEffect(() => {
    // Once onboarding is complete, the authenticated layout is mounted (gateway,
    // member provider, etc.). Resetting to "loading" would unmount everything,
    // losing the user's route, channel selection, and member data. Skip re-checks.
    if (completedRef.current) return;

    setStep("loading");
    setConfig(null);
    setError(null);
    setPendingInviteCode(null);
    pendingInviteCodeRef.current = null;
    pendingOpenJoinRef.current = false;
    determineStep();
  }, [determineStep]);

  /** Fetch config if we don't already have it (needed when transitioning to verify_email). */
  const ensureConfig = useCallback(async () => {
    if (config || !currentServerId || !currentServer) return;
    const configResult = await fetchWithRefresh(
      currentServerId,
      currentServer.baseUrl,
      getOnboardingConfig,
      refreshSession,
    );
    if (configResult.ok) {
      setConfig(configResult.data);
    }
  }, [config, currentServerId, currentServer, refreshSession]);

  const resendVerificationAction = useCallback(async () => {
    if (!currentServerId || !currentServer) return;
    setError(null);

    const result = await fetchWithRefresh(currentServerId, currentServer.baseUrl, resendVerification, refreshSession);

    if (!result.ok) {
      setError(result.reason);
    }
  }, [currentServerId, currentServer, refreshSession]);

  const joinServerAction = useCallback(async () => {
    if (!currentServerId || !currentServer) return;
    setError(null);

    const result = await fetchWithRefresh(currentServerId, currentServer.baseUrl, joinServer, refreshSession);

    if (!result.ok) {
      // Already a member — treat as success and advance to the next step.
      if (result.code === "ALREADY_MEMBER") {
        await determineStep();
        return;
      }
      // If blocked by email verification, transition to verify step
      if (result.code === "EMAIL_NOT_VERIFIED") {
        pendingOpenJoinRef.current = true;
        setStep("verify_email");
        await ensureConfig();
        return;
      }
      setError(result.reason);
      return;
    }
    await determineStep();
  }, [currentServerId, currentServer, refreshSession, determineStep, ensureConfig]);

  const joinWithInviteAction = useCallback(
    async (code: string) => {
      if (!currentServerId || !currentServer) return;
      setError(null);

      const result = await fetchWithRefresh(
        currentServerId,
        currentServer.baseUrl,
        (baseUrl, token) => joinInvite(baseUrl, token, code),
        refreshSession,
      );

      if (!result.ok) {
        // Already a member — treat as success and advance to the next step.
        if (result.code === "ALREADY_MEMBER") {
          pendingInviteCodeRef.current = null;
          setPendingInviteCode(null);
          await determineStep();
          return;
        }
        // If blocked by email verification, store the invite code and show verify step.
        // The code itself was accepted by the server (it returned a verification error,
        // not UNKNOWN_INVITE), so we remember it for after verification.
        if (result.code === "EMAIL_NOT_VERIFIED") {
          pendingInviteCodeRef.current = code;
          setPendingInviteCode(code);
          setStep("verify_email");
          await ensureConfig();
          return;
        }
        setError(result.reason);
        return;
      }
      pendingInviteCodeRef.current = null;
      setPendingInviteCode(null);
      await determineStep();
    },
    [currentServerId, currentServer, refreshSession, determineStep, ensureConfig],
  );

  const acceptDocumentsAction = useCallback(
    async (slugs: string[]) => {
      if (!currentServerId || !currentServer) return;
      setError(null);

      const result = await fetchWithRefresh(
        currentServerId,
        currentServer.baseUrl,
        (baseUrl, token) => acceptOnboarding(baseUrl, token, { accepted_document_slugs: slugs }),
        refreshSession,
      );

      if (!result.ok) {
        setError(result.reason);
        return;
      }
      await determineStep();
    },
    [currentServerId, currentServer, refreshSession, determineStep],
  );

  const refreshStepAction = useCallback(async () => {
    await determineStep();
  }, [determineStep]);

  const state = useMemo<OnboardingState>(
    () => ({ step, config, error, pendingInviteCode }),
    [step, config, error, pendingInviteCode],
  );

  const actions = useMemo<OnboardingActions>(
    () => ({
      resendVerification: resendVerificationAction,
      joinServer: joinServerAction,
      joinWithInvite: joinWithInviteAction,
      acceptDocuments: acceptDocumentsAction,
      refreshStep: refreshStepAction,
    }),
    [resendVerificationAction, joinServerAction, joinWithInviteAction, acceptDocumentsAction, refreshStepAction],
  );

  return (
    <OnboardingStateContext.Provider value={state}>
      <OnboardingActionsContext.Provider value={actions}>{children}</OnboardingActionsContext.Provider>
    </OnboardingStateContext.Provider>
  );
}

export function useOnboardingState(): OnboardingState {
  const ctx = useContext(OnboardingStateContext);
  if (!ctx) throw new Error("useOnboardingState must be used within OnboardingProvider");
  return ctx;
}

export function useOnboardingActions(): OnboardingActions {
  const ctx = useContext(OnboardingActionsContext);
  if (!ctx) throw new Error("useOnboardingActions must be used within OnboardingProvider");
  return ctx;
}
