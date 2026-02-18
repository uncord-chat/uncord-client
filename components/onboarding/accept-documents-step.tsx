import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { HtmlContent } from "@/components/onboarding/html-content";
import { ThemedText } from "@/components/themed-text";
import { Colors, SemanticColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useOnboardingActions, useOnboardingState } from "@/lib/onboarding/onboarding-context";

export const AcceptDocumentsStep = memo(function AcceptDocumentsStep() {
  const { config, error: contextError } = useOnboardingState();
  const { acceptDocuments } = useOnboardingActions();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const [acceptedSlugs, setAcceptedSlugs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredDocs = useMemo(
    () => (config?.documents ?? []).filter((d) => d.required).sort((a, b) => a.position - b.position),
    [config],
  );

  const allAccepted = requiredDocs.length === 0 || requiredDocs.every((d) => acceptedSlugs.has(d.slug));

  // If the server has no documents at all, auto-accept and advance.
  const hasNoDocuments = config != null && config.documents.length === 0;
  useEffect(() => {
    if (hasNoDocuments) {
      acceptDocuments([]);
    }
  }, [hasNoDocuments, acceptDocuments]);

  const toggleSlug = useCallback((slug: string) => {
    setAcceptedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!allAccepted) return;
    setError(null);
    setLoading(true);
    try {
      await acceptDocuments([...acceptedSlugs]);
    } catch {
      setError("Failed to accept documents.");
    } finally {
      setLoading(false);
    }
  }, [allAccepted, acceptedSlugs, acceptDocuments]);

  const displayError = error || contextError;

  return (
    <View style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Review and accept
      </ThemedText>

      <ThemedText style={styles.description}>Please read and accept the following before continuing.</ThemedText>

      {requiredDocs.map((doc) => (
        <View key={doc.slug} style={[styles.documentCard, { borderColor: colors.inputBorder }]}>
          <ThemedText type="subtitle" style={styles.docTitle}>
            {doc.title}
          </ThemedText>

          <ScrollView
            style={[styles.docContent, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
            nestedScrollEnabled
          >
            <HtmlContent html={doc.content} />
          </ScrollView>

          <Pressable
            style={styles.checkboxRow}
            onPress={() => toggleSlug(doc.slug)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedSlugs.has(doc.slug) }}
            accessibilityLabel={`I have read and accept ${doc.title}`}
          >
            <View
              style={[
                styles.checkbox,
                { borderColor: colors.inputBorder },
                acceptedSlugs.has(doc.slug) && styles.checkboxChecked,
              ]}
            >
              {acceptedSlugs.has(doc.slug) && <ThemedText style={styles.checkmark}>✓</ThemedText>}
            </View>
            <ThemedText style={styles.checkboxLabel}>I have read and accept {doc.title}</ThemedText>
          </Pressable>
        </View>
      ))}

      {displayError ? <ThemedText style={styles.error}>{displayError}</ThemedText> : null}

      <Pressable
        style={[styles.button, (!allAccepted || loading) && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!allAccepted || loading}
        accessibilityRole="button"
        accessibilityLabel="Continue"
      >
        {loading ? (
          <ActivityIndicator color={SemanticColors.primaryButtonText} />
        ) : (
          <ThemedText style={styles.buttonText}>Continue</ThemedText>
        )}
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
  },
  title: {
    marginBottom: 16,
  },
  description: {
    marginBottom: 24,
    lineHeight: 22,
  },
  documentCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  docTitle: {
    marginBottom: 12,
  },
  docContent: {
    maxHeight: 300,
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: SemanticColors.primaryButtonBg,
    borderColor: SemanticColors.primaryButtonBg,
  },
  checkmark: {
    color: SemanticColors.primaryButtonText,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
  },
  error: {
    color: SemanticColors.error,
    marginBottom: 16,
  },
  button: {
    backgroundColor: SemanticColors.primaryButtonBg,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: SemanticColors.primaryButtonText,
    fontWeight: "600",
  },
});
