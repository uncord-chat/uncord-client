import { memo } from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Colors, SemanticColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { OnboardingConfig, OnboardingStep } from "@uncord-chat/protocol/models/onboarding";

type StepIndicatorProps = {
  currentStep: OnboardingStep | "loading";
  config: OnboardingConfig | null;
};

type StepDef = {
  key: OnboardingStep;
  label: string;
};

const ALL_STEPS: StepDef[] = [
  { key: "verify_email", label: "Verify" },
  { key: "join_server", label: "Join" },
  { key: "accept_documents", label: "Accept" },
];

function getVisibleSteps(config: OnboardingConfig | null): StepDef[] {
  if (!config) return ALL_STEPS;

  const steps: StepDef[] = [];
  if (config.require_email_verification) {
    steps.push(ALL_STEPS[0]!);
  }
  steps.push(ALL_STEPS[1]!);
  if (config.documents.some((d) => d.required)) {
    steps.push(ALL_STEPS[2]!);
  }
  return steps;
}

const STEP_ORDER: OnboardingStep[] = ["verify_email", "join_server", "accept_documents", "complete"];

function getStepIndex(step: OnboardingStep | "loading"): number {
  if (step === "loading") return -1;
  return STEP_ORDER.indexOf(step);
}

export const StepIndicator = memo(function StepIndicator({ currentStep, config }: StepIndicatorProps) {
  const colorScheme = useColorScheme();
  const visibleSteps = getVisibleSteps(config);
  const currentIndex = getStepIndex(currentStep);

  if (visibleSteps.length <= 1) return null;

  const currentStepNumber = visibleSteps.findIndex((s) => s.key === currentStep) + 1;
  const totalSteps = visibleSteps.length;

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${currentStepNumber} of ${totalSteps}`}
      accessibilityValue={{ min: 1, max: totalSteps, now: currentStepNumber }}
    >
      {visibleSteps.map((s, i) => {
        const stepIndex = getStepIndex(s.key);
        const isActive = s.key === currentStep;
        const isCompleted = currentIndex > stepIndex;

        let dotColor = Colors[colorScheme].icon;
        if (isActive) dotColor = SemanticColors.primaryButtonBg;
        if (isCompleted) dotColor = SemanticColors.success;

        return (
          <View key={s.key} style={styles.step}>
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
            <ThemedText style={[styles.label, isActive && styles.labelActive]}>{s.label}</ThemedText>
            {i < visibleSteps.length - 1 && (
              <View
                style={[
                  styles.connector,
                  { backgroundColor: isCompleted ? SemanticColors.success : Colors[colorScheme].border },
                ]}
              />
            )}
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  label: {
    fontSize: 13,
    opacity: 0.7,
  },
  labelActive: {
    opacity: 1,
    fontWeight: "600",
  },
  connector: {
    width: 24,
    height: 2,
    marginHorizontal: 8,
    borderRadius: 1,
  },
});
