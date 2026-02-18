import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { getPublicServerInfo } from "@/lib/api/client";
import { useAuthActions, useAuthState, useCurrentServer } from "@/lib/auth/auth-context";

import { LoginForm } from "./login-form";
import { MfaForm } from "./mfa-form";
import { RegisterForm } from "./register-form";

type AuthView = "login" | "register" | "mfa";

export function AuthPanel() {
  const [view, setView] = useState<AuthView>("login");
  const { currentServerId } = useAuthState();
  const { updateServerInfo, clearMfaTicket } = useAuthActions();
  const currentServer = useCurrentServer();
  const [serverName, setServerName] = useState<string | null>(currentServer?.name ?? null);
  const [serverDescription, setServerDescription] = useState<string | null>(null);
  const [serverIconKey, setServerIconKey] = useState<string | null>(null);

  // Reset to login view when the current server changes
  useEffect(() => {
    setView("login");
    clearMfaTicket();
  }, [currentServerId, clearMfaTicket]);

  // Fetch public server info (name, description, icon).
  // Depend on stable primitives to avoid re-fetching when the server object
  // reference changes (e.g. after updateServerInfo updates the name).
  const serverId = currentServer?.id;
  const serverBaseUrl = currentServer?.baseUrl;
  useEffect(() => {
    if (!serverId || !serverBaseUrl) {
      setServerName(null);
      setServerDescription(null);
      setServerIconKey(null);
      return;
    }
    if (currentServer?.name) {
      setServerName(currentServer.name);
    }
    let cancelled = false;
    getPublicServerInfo(serverBaseUrl)
      .then((res) => {
        if (cancelled || !res.ok) return;
        setServerName(res.data.name);
        setServerDescription(res.data.description);
        setServerIconKey(res.data.icon_key);
        updateServerInfo(serverId, res.data.name);
      })
      .catch(() => {
        // Network failure fetching server info — leave fields as null.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, serverBaseUrl, updateServerInfo]);

  const showLogin = useCallback(() => setView("login"), []);
  const showRegister = useCallback(() => setView("register"), []);
  const showMfa = useCallback(() => setView("mfa"), []);

  return (
    <View style={styles.container}>
      {view === "login" && (
        <LoginForm
          serverName={serverName}
          serverDescription={serverDescription}
          serverIconKey={serverIconKey}
          serverBaseUrl={currentServer?.baseUrl ?? null}
          onRegisterPress={showRegister}
          onMfaRequired={showMfa}
        />
      )}
      {view === "register" && (
        <RegisterForm
          serverName={serverName}
          serverDescription={serverDescription}
          serverIconKey={serverIconKey}
          serverBaseUrl={currentServer?.baseUrl ?? null}
          onLoginPress={showLogin}
        />
      )}
      {view === "mfa" && <MfaForm onBackToLogin={showLogin} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
});
