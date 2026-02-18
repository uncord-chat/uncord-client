import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { SemanticColors } from "@/constants/theme";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  /** Style applied to the wrapper View. Pass `{ flex: 1 }` when the boundary should fill its parent. */
  style?: StyleProp<ViewStyle>;
};

type State = {
  hasError: boolean;
  /** Incremented on retry to force a fresh mount of children. */
  retryKey: number;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryKey: 0 };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  private handleRetry = () => {
    // Increment retryKey to force React to unmount and remount the children,
    // avoiding the problem of re-rendering with the same state that caused
    // the error.
    this.setState((prev) => ({ hasError: false, retryKey: prev.retryKey + 1 }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <View
          style={[this.props.style, styles.errorContent]}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          <Text style={styles.text}>Something went wrong.</Text>
          <Pressable style={styles.retryButton} onPress={this.handleRetry} accessibilityRole="button">
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View key={this.state.retryKey} style={this.props.style}>
        {this.props.children}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  errorContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    color: SemanticColors.error,
    fontSize: 16,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: SemanticColors.primaryButtonBg,
  },
  retryText: {
    color: SemanticColors.primaryButtonText,
    fontWeight: "600",
    fontSize: 14,
  },
});
