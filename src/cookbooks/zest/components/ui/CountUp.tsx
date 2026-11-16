import { useEffect } from "react";
import { TextInput, type TextStyle, type StyleProp } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const AnimatedText = Animated.createAnimatedComponent(TextInput);

/**
 * A number that counts up on the UI thread once, when it arrives. A read-only
 * TextInput is the one text view Reanimated can change without a React render.
 */
export function CountUp({
  value,
  style,
  accessibilityLabel,
}: {
  value: number;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}) {
  const reduced = useReducedMotion();
  const shown = useSharedValue(reduced ? value : Math.round(value * 0.6));
  useEffect(() => {
    shown.set(
      reduced
        ? value
        : withTiming(value, {
            duration: 420,
            easing: Easing.bezier(0.23, 1, 0.32, 1),
          }),
    );
  }, [value, reduced, shown]);
  const props = useAnimatedProps(() => {
    return { text: String(Math.round(shown.get())) } as never;
  });
  return (
    <AnimatedText
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      animatedProps={props}
      // Sizes the view for the final number; the count only changes the glyphs.
      defaultValue={String(value)}
      editable={false}
      pointerEvents="none"
      caretHidden
      scrollEnabled={false}
      style={[style, { padding: 0 }]}
    />
  );
}
