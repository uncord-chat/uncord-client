import { memo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { AcceptDocumentsStep } from "@/components/onboarding/accept-documents-step";
import { JoinServerStep } from "@/components/onboarding/join-server-step";
import { StepIndicator } from "@/components/onboarding/step-indicator";
import { VerifyEmailStep } from "@/components/onboarding/verify-email-step";
import { ThemedText } from "@/components/themed-text";
import { SemanticColors } from "@/constants/theme";
import { useOnboardingState } from "@/lib/onboarding/onboarding-context";

export const OnboardingFlow = memo(function OnboardingFlow() {
  const { step, config, error } = useOnboardingState();

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <StepIndicator currentStep={step} config={config} />

        {error && step !== "verify_email" && step !== "join_server" && step !== "accept_documents" ? (
          <ThemedText style={styles.error}>{error}</ThemedText>
        ) : null}

        {step === "verify_email" && <VerifyEmailStep />}
        {step === "join_server" && <JoinServerStep />}
        {step === "accept_documents" && <AcceptDocumentsStep />}
      </View>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  container: {
    flex: 1,
    justifyContent: "center",
  },
  error: {
    color: SemanticColors.error,
    textAlign: "center",
    marginBottom: 16,
  },
});
