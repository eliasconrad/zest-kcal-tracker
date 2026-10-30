import { useEffect, useMemo, useState } from "react";
import { Text, View, type TextStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

/** About 25 words a second, faster when the model has run ahead. */
const TICK_MS = 40;
const LINE = "\n";
const PARAGRAPH = "\n\n";

/**
 * A model answer arriving: whole words fade in at an even pace however unevenly
 * the network delivers them, and a half-received word waits for its end. Once
 * everything has shown, it becomes one selectable text with the same line breaks.
 */
export function StreamedText({
  text,
  live,
  reduced,
  style,
  onShown,
}: {
  text: string;
  live: boolean;
  reduced: boolean;
  style: TextStyle;
  /** Everything has shown; what follows the text may come in now. */
  onShown?: () => void;
}) {
  const tokens = useMemo(() => {
    const list: string[] = [];
    for (const part of text.split(/(\s+)/)) {
      if (part.trim()) list.push(part);
      else if (part.includes("\n")) list.push(/\n[^\n]*\n/.test(part) ? PARAGRAPH : LINE);
    }
    // While it streams, the last word may be cut off mid-way.
    if (live && !/\s$/.test(text)) list.pop();
    return list;
  }, [live, text]);
  const [shown, setShown] = useState(live && !reduced ? 0 : Number.MAX_SAFE_INTEGER);
  const behind = tokens.length - shown;
  useEffect(() => {
    if (behind <= 0) return;
    const id = setInterval(
      () => setShown((count) => count + Math.max(1, Math.ceil((tokens.length - count) / 10))),
      TICK_MS,
    );
    return () => clearInterval(id);
  }, [behind, tokens.length]);
  const settled = !live && behind <= 0;
  useEffect(() => {
    if (settled) onShown?.();
  }, [settled, onShown]);
  if (settled)
    return (
      <Text selectable lineBreakStrategyIOS="none" style={style}>
        {text}
      </Text>
    );
  return (
    <View
      accessible
      accessibilityLabel={text}
      accessibilityLiveRegion="polite"
      style={{ flexDirection: "row", flexWrap: "wrap" }}
    >
      {tokens.slice(0, shown).map((token, index) =>
        token === LINE || token === PARAGRAPH ? (
          <View
            key={index}
            style={{ width: "100%", height: token === PARAGRAPH ? style.lineHeight : 0 }}
          />
        ) : (
          <Animated.Text
            key={index}
            entering={FadeIn.duration(220)}
            style={style}
          >
            {`${token} `}
          </Animated.Text>
        ),
      )}
    </View>
  );
}
