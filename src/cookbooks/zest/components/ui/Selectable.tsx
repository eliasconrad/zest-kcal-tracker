import { createContext, useContext, useEffect } from "react";
import type { StyleProp, TextProps, ViewStyle } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { theme } from "../../theme";

const SelectedContext = createContext<SharedValue<number> | null>(null);

/**
 * A choice that changes colour over 160 ms instead of snapping, so the eye can
 * follow where the selection went. Interruptible: tapping quickly just reverses.
 * Reduce Motion keeps the instant change.
 */
export function Selectable({
  selected,
  style,
  children,
}: React.PropsWithChildren<{ selected: boolean; style?: StyleProp<ViewStyle> }>) {
  const reduced = useReducedMotion();
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.set(
      reduced
        ? selected
          ? 1
          : 0
        : withTiming(selected ? 1 : 0, {
            duration: 160,
            easing: Easing.bezier(0.23, 1, 0.32, 1),
          }),
    );
  }, [selected, reduced, on]);
  const fill = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.get(), [0, 1], ["#FFFFFF", theme.heavy]),
  }));
  return (
    <SelectedContext.Provider value={on}>
      <Animated.View style={[style, fill]}>{children}</Animated.View>
    </SelectedContext.Provider>
  );
}

/** Text inside a Selectable: its colour follows the fill. */
export function SelectableText({
  style,
  children,
  from = theme.ink,
  to = theme.onHeavy,
  ...props
}: TextProps & { from?: string; to?: string }) {
  const on = useContext(SelectedContext);
  const color = useAnimatedStyle(() => ({
    color: interpolateColor(on?.get() ?? 0, [0, 1], [from, to]),
  }));
  return (
    <Animated.Text {...props} style={[style, color]}>
      {children}
    </Animated.Text>
  );
}
