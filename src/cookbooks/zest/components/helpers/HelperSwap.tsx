import { useEffect, useRef } from "react";
import { Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { GlassSurface } from "../ui/GlassSurface";
import { StaticHelper } from "./StaticHelper";
import { helperList, type HelperId } from "../../data/helpers";
import { EASE, SNAP } from "../../motion/timing";
import { theme } from "../../theme";

export const SWAP_SLOT = 54;
export const SWAP_PAD = 8;
/** Full width of the bar: six slots and the padding either side. */
export const SWAP_WIDTH = helperList.length * SWAP_SLOT + SWAP_PAD * 2;

/**
 * The swap bar: one Liquid Glass pill holding all six helpers. It forms while
 * the finger holds the companion; sliding along it lifts the helper under the
 * finger, letting go picks it. The parent owns the hit-testing because the
 * gesture began on the companion, not here.
 */
export function HelperSwap({
  selected,
  hovered,
  bottom,
  reduced,
  onLayout,
}: {
  selected: HelperId;
  hovered: HelperId | null;
  bottom: number;
  reduced: boolean;
  /** Where the first slot starts on screen, so the parent can map the finger. */
  onLayout: (left: number) => void;
}) {
  const focus = hovered ?? selected;
  const name = helperList.find((h) => h.id === focus);
  const row = useRef<View>(null);
  return (
    <Animated.View
      pointerEvents="none"
      entering={reduced ? undefined : FadeIn.duration(160)}
      exiting={reduced ? undefined : FadeOut.duration(140)}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={name ? `Helper: ${name.name}, ${name.role}` : "Choose a helper"}
      style={{
        position: "absolute",
        bottom,
        left: 0,
        right: 0,
        alignItems: "center",
        gap: 10,
        zIndex: 60,
      }}
    >
      {name && (
        <Animated.View
          key={name.id}
          entering={reduced ? undefined : FadeIn.duration(120)}
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 14,
            borderCurve: "continuous",
            paddingHorizontal: 12,
            paddingVertical: 7,
            boxShadow: "0 4px 16px rgba(32, 35, 25, 0.08)",
            flexDirection: "row",
            alignItems: "baseline",
            gap: 6,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "600", color: theme.ink, letterSpacing: -0.2 }}>
            {name.name}
          </Text>
          <Text style={{ fontSize: 13, color: theme.muted }}>{name.role}</Text>
        </Animated.View>
      )}
      <GlassSurface
        interactive
        style={{
          width: SWAP_WIDTH,
          height: SWAP_SLOT + SWAP_PAD * 2,
          borderRadius: (SWAP_SLOT + SWAP_PAD * 2) / 2,
          paddingHorizontal: SWAP_PAD,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <View
          ref={row}
          onLayout={() => {
            // Measured in the window so a keyboard or sheet never shifts the maths.
            row.current?.measureInWindow((x) => onLayout(x));
          }}
          style={{ flexDirection: "row" }}
        >
          {helperList.map((helper) => (
            <Slot
              key={helper.id}
              id={helper.id}
              lifted={helper.id === focus}
              current={helper.id === selected}
              reduced={reduced}
            />
          ))}
        </View>
      </GlassSurface>
    </Animated.View>
  );
}

function Slot({
  id,
  lifted,
  current,
  reduced,
}: {
  id: HelperId;
  lifted: boolean;
  current: boolean;
  reduced: boolean;
}) {
  const lift = useSharedValue(lifted ? 1 : 0);
  useEffect(() => {
    lift.set(
      reduced
        ? withTiming(lifted ? 1 : 0, { duration: 0 })
        : withSpring(lifted ? 1 : 0, SNAP),
    );
  }, [lift, lifted, reduced]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift.get() * 10 }, { scale: 1 + lift.get() * 0.32 }],
  }));
  return (
    <View style={{ width: SWAP_SLOT, height: SWAP_SLOT, alignItems: "center", justifyContent: "center" }}>
      {current && (
        <View
          style={{
            position: "absolute",
            bottom: 2,
            width: 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: theme.ink,
          }}
        />
      )}
      <Animated.View style={style}>
        <StaticHelper id={id} size={46} frame={lifted ? "cheer" : "idle"} />
      </Animated.View>
    </View>
  );
}

export { EASE as SWAP_EASE };
