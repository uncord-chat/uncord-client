import { memo, useCallback, useRef, useState } from "react";
import {
  Platform,
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  type TextStyle,
} from "react-native";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getWebTextArea } from "@/lib/web-utils";

// Web: remove browser focus outline, disable manual resize, enable vertical scroll at max height.
const webInputStyle =
  Platform.OS === "web" ? ({ outlineStyle: "none", resize: "none", overflowY: "auto" } as unknown as TextStyle) : {};

const LINE_HEIGHT = 20;
const MAX_LINES = 4;
const MAX_INPUT_HEIGHT = LINE_HEIGHT * MAX_LINES;

type MessageInputProps = {
  channelName: string;
  onSend: (content: string) => void;
  onTyping?: () => void;
  onStopTyping?: () => void;
  disabled?: boolean;
};

export const MessageInput = memo(function MessageInput({
  channelName,
  onSend,
  onTyping,
  onStopTyping,
  disabled,
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [inputHeight, setInputHeight] = useState(LINE_HEIGHT);
  const inputRef = useRef<TextInput>(null);
  const colorScheme = useColorScheme();
  const bgColor = Colors[colorScheme].messageInputBg;
  const textColor = Colors[colorScheme].text;
  const placeholderColor = Colors[colorScheme].icon;

  // Web: collapse textarea to 0, read true scrollHeight, clamp, and apply.
  // All synchronous within one JS task so the browser never paints the collapsed state.
  const measureAndResize = useCallback(() => {
    const el = getWebTextArea(inputRef);
    if (!el) return;
    el.style.height = "0px";
    const clamped = Math.min(Math.max(el.scrollHeight, LINE_HEIGHT), MAX_INPUT_HEIGHT);
    el.style.height = `${clamped}px`;
    setInputHeight(clamped);
  }, []);

  const handleChangeText = useCallback(
    (value: string) => {
      setText(value);
      if (value.length > 0) onTyping?.();
      measureAndResize();
    },
    [onTyping, measureAndResize],
  );

  const handleBlur = useCallback(() => {
    onStopTyping?.();
  }, [onStopTyping]);

  // Native: use onContentSizeChange which reports true content height on iOS/Android.
  const handleContentSizeChange = useCallback(
    (e: NativeSyntheticEvent<{ contentSize: { width: number; height: number } }>) => {
      if (Platform.OS === "web") return;
      const contentHeight = e.nativeEvent.contentSize.height;
      const clamped = Math.min(Math.max(contentHeight, LINE_HEIGHT), MAX_INPUT_HEIGHT);
      setInputHeight(clamped);
    },
    [],
  );

  const doSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
    // Reset height — onChangeText won't fire for programmatic setText("").
    setInputHeight(LINE_HEIGHT);
    const el = getWebTextArea(inputRef);
    if (el) el.style.height = `${LINE_HEIGHT}px`;
  }, [text, onSend]);

  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (Platform.OS !== "web") return;
      const nativeEvent = e.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean };
      if (nativeEvent.key === "Enter" && !nativeEvent.shiftKey) {
        e.preventDefault();
        doSend();
      }
    },
    [doSend],
  );

  return (
    <View style={styles.container}>
      <View style={[styles.inputRow, { backgroundColor: bgColor }]}>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: textColor, height: inputHeight }, webInputStyle]}
          placeholder={`Message #${channelName}`}
          placeholderTextColor={placeholderColor}
          value={text}
          onChangeText={handleChangeText}
          onContentSizeChange={handleContentSizeChange}
          onKeyPress={handleKeyPress}
          onBlur={handleBlur}
          multiline
          numberOfLines={1}
          editable={!disabled}
          blurOnSubmit={false}
          accessibilityLabel={`Message input for ${channelName}`}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 16,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: LINE_HEIGHT,
    paddingVertical: 0,
    borderWidth: 0,
  },
});
