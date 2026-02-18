import DOMPurify from "dompurify";
import { Platform, type StyleProp, type ViewStyle } from "react-native";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type HtmlContentProps = {
  html: string;
  style?: StyleProp<ViewStyle>;
};

/** Shared CSS rules used by both web and native HTML renderers. */
function buildHtmlStyles(textColor: string, tintColor: string): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      color: ${textColor};
      background: transparent;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      word-wrap: break-word;
      overflow-wrap: break-word;
      padding: 0;
    }
    a { color: ${tintColor}; }
    p { margin-bottom: 8px; }
    ul, ol { padding-left: 20px; margin-bottom: 8px; }
    h1, h2, h3, h4, h5, h6 { margin-bottom: 8px; }
  `;
}

function HtmlContentWeb({ html, style }: HtmlContentProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const wrappedHtml = `<style>${buildHtmlStyles(colors.text, colors.tint)}</style>${html}`;
  const sanitisedHtml = DOMPurify.sanitize(wrappedHtml);

  return (
    <div style={Object.assign({ flex: 1 }, style as object)} dangerouslySetInnerHTML={{ __html: sanitisedHtml }} />
  );
}

// Lazy require to avoid loading react-native-webview on web.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LazyWebView = Platform.OS !== "web" ? require("react-native-webview").default : null;

function HtmlContentNative({ html, style }: HtmlContentProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const sanitisedHtml = DOMPurify.sanitize(html);

  const templateHtml = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>${buildHtmlStyles(colors.text, colors.tint)}</style>
</head>
<body>${sanitisedHtml}</body>
</html>`;

  return (
    <LazyWebView
      source={{ html: templateHtml }}
      style={[{ backgroundColor: "transparent" }, style]}
      javaScriptEnabled={false}
      originWhitelist={["*"]}
      scrollEnabled
    />
  );
}

export function HtmlContent(props: HtmlContentProps) {
  if (Platform.OS === "web") {
    return <HtmlContentWeb {...props} />;
  }
  return <HtmlContentNative {...props} />;
}
