import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthPanel } from "@/components/auth-panel/auth-panel";
import { ErrorBoundary } from "@/components/error-boundary";
import { AuthenticatedDesktop } from "@/components/layout/authenticated-desktop";
import { AuthenticatedMobile } from "@/components/layout/authenticated-mobile";
import { DataProviders } from "@/components/layout/data-providers";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { MobileHeader } from "@/components/layout/mobile-header";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { ServerSidebar } from "@/components/server-sidebar/server-sidebar";
import { SERVER_SIDEBAR_WIDTH } from "@/constants/layout";
import { Colors } from "@/constants/theme";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { OnboardingProvider, useOnboardingState } from "@/lib/onboarding/onboarding-context";

// ---------------------------------------------------------------------------
// Shared responsive layout — eliminates duplication between unauthenticated,
// onboarding, and authenticated layouts.
// ---------------------------------------------------------------------------

type ResponsiveShellProps = {
  children: React.ReactNode;
  isDesktop: boolean;
  backgroundColor: string;
};

function ResponsiveShellDesktop({ children, backgroundColor }: ResponsiveShellProps): React.ReactElement {
  return (
    <SafeAreaView style={[styles.desktopContainer, { backgroundColor }]}>
      <ServerSidebar />
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

function ResponsiveShellMobile({ children, backgroundColor }: ResponsiveShellProps): React.ReactElement {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <SafeAreaView style={[styles.mobileContainer, { backgroundColor }]}>
      <MobileHeader onMenuPress={openDrawer} />
      <View style={styles.content}>{children}</View>
      <MobileDrawer open={drawerOpen} onClose={closeDrawer} width={SERVER_SIDEBAR_WIDTH}>
        <ServerSidebar />
      </MobileDrawer>
    </SafeAreaView>
  );
}

function ResponsiveShell({ children, isDesktop, backgroundColor }: ResponsiveShellProps): React.ReactElement {
  return isDesktop ? (
    <ResponsiveShellDesktop isDesktop={isDesktop} backgroundColor={backgroundColor}>
      {children}
    </ResponsiveShellDesktop>
  ) : (
    <ResponsiveShellMobile isDesktop={isDesktop} backgroundColor={backgroundColor}>
      {children}
    </ResponsiveShellMobile>
  );
}

// ---------------------------------------------------------------------------
// Authenticated layout — wraps content in data providers
// ---------------------------------------------------------------------------

function AuthenticatedLayout({
  isDesktop,
  backgroundColor,
}: {
  isDesktop: boolean;
  backgroundColor: string;
}): React.ReactElement {
  return (
    <DataProviders>
      {isDesktop ? (
        <AuthenticatedDesktop backgroundColor={backgroundColor} />
      ) : (
        <AuthenticatedMobile backgroundColor={backgroundColor} />
      )}
    </DataProviders>
  );
}

// ---------------------------------------------------------------------------
// Onboarding gate — decides between onboarding and authenticated content
// ---------------------------------------------------------------------------

function OnboardingGateInner({
  isDesktop,
  backgroundColor,
  tint,
}: {
  isDesktop: boolean;
  backgroundColor: string;
  tint: string;
}): React.ReactElement {
  const { step } = useOnboardingState();

  if (step === "loading") {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={tint} />
      </View>
    );
  }

  if (step === "complete") {
    return <AuthenticatedLayout isDesktop={isDesktop} backgroundColor={backgroundColor} />;
  }

  return (
    <ResponsiveShell isDesktop={isDesktop} backgroundColor={backgroundColor}>
      <ErrorBoundary style={{ flex: 1 }}>
        <OnboardingFlow />
      </ErrorBoundary>
    </ResponsiveShell>
  );
}

function OnboardingGate({
  isDesktop,
  backgroundColor,
  tint,
}: {
  isDesktop: boolean;
  backgroundColor: string;
  tint: string;
}): React.ReactElement {
  return (
    <OnboardingProvider>
      <OnboardingGateInner isDesktop={isDesktop} backgroundColor={backgroundColor} tint={tint} />
    </OnboardingProvider>
  );
}

// ---------------------------------------------------------------------------
// Main layout — top-level gate
// ---------------------------------------------------------------------------

export default function MainLayout(): React.ReactElement {
  const { status } = useAuthGate();
  const colorScheme = useColorScheme();
  const isDesktop = useIsDesktop();
  const backgroundColor = Colors[colorScheme].background;
  const tint = Colors[colorScheme].tint;

  if (status === "loading") {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={tint} />
      </View>
    );
  }

  if (status === "authenticated") {
    return <OnboardingGate isDesktop={isDesktop} backgroundColor={backgroundColor} tint={tint} />;
  }

  return (
    <ResponsiveShell isDesktop={isDesktop} backgroundColor={backgroundColor}>
      <AuthPanel />
    </ResponsiveShell>
  );
}

const styles = StyleSheet.create({
  desktopContainer: {
    flex: 1,
    flexDirection: "row",
  },
  mobileContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
