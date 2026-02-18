import { memo, useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Colors, Opacity } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useMemberActions } from "@/lib/members/member-context";

type TypingIndicatorProps = {
  userIds: string[];
};

const BouncingDots = memo(function BouncingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -3, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      );

    const animation = Animated.parallel([bounce(dot1, 0), bounce(dot2, 150), bounce(dot3, 300)]);
    animation.start();
    return () => animation.stop();
  }, [dot1, dot2, dot3]);

  const scheme = useColorScheme();
  const dotColor = Colors[scheme].icon;

  return (
    <View style={styles.dotsContainer}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View key={i} style={[styles.dot, { backgroundColor: dotColor, transform: [{ translateY: dot }] }]} />
      ))}
    </View>
  );
});

export const TypingIndicator = memo(function TypingIndicator({ userIds }: TypingIndicatorProps) {
  const { getMember } = useMemberActions();
  const visible = userIds.length > 0;

  let text = "";
  if (visible) {
    const names = userIds.map((id) => {
      const member = getMember(id);
      return member?.nickname ?? member?.user.display_name ?? member?.user.username ?? "Someone";
    });

    if (names.length === 1) {
      text = `${names[0]} is typing`;
    } else if (names.length === 2) {
      text = `${names[0]} and ${names[1]} are typing`;
    } else if (names.length === 3) {
      text = `${names[0]}, ${names[1]}, and ${names[2]} are typing`;
    } else {
      text = "Several people are typing";
    }
  }

  return (
    <View style={styles.container} accessibilityLiveRegion="polite" accessibilityLabel={visible ? text : undefined}>
      {visible && (
        <View style={styles.content}>
          <BouncingDots />
          <ThemedText style={styles.text}>{text}</ThemedText>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    height: 28,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  dotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginRight: 6,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  text: {
    fontSize: 12,
    opacity: Opacity.subtle,
  },
});
