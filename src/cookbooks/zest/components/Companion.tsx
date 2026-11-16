import { useEffect, useState } from "react";
import { Canvas, Group, vec, type Transforms3d } from "@shopify/react-native-skia";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import { FIGURE, feetIn, type Scene } from "../hooks/useScene";
import { figures, type Rig } from "./helpers/Figures";
import { Glow } from "./helpers/Glow";
import { headTransform, pupilTransform } from "./helpers/frames";
import { helpers, type HelperId } from "../data/helpers";
import { EASE } from "../motion/timing";

const [footX, footY] = feetIn(FIGURE.hero);
/** How long a finger rests before the swap mode opens. iOS context menus use ~0.5 s; the companion is a character, not a menu, so a touch sooner. */
export const HOLD_MS = 380;

/**
 * The chosen helper, live: one drawing shared between its hero, composer and
 * calendar positions. A tap opens the diary; a hold opens the swap mode.
 */
export function Companion({
  scene,
  helper,
  onPress,
  calendarOpen,
  hidden = false,
  onHold,
}: {
  scene: Scene;
  helper: HelperId;
  onPress: () => void;
  calendarOpen: boolean;
  /** Gone while the swap mode holds the helpers; it lands again when that closes. */
  hidden?: boolean;
  onHold?: () => void;
}) {
  const {
    gazeX,
    gazeY,
    headX,
    headY,
    bodyX,
    figure,
    feetX,
    feetY,
    reduced,
    hop,
    expression,
    energy,
    spin,
  } = scene;
  const lid = useSharedValue(1);
  const pressure = useSharedValue(0);
  const holding = useSharedValue(0);
  const gone = useSharedValue(0);
  useEffect(() => {
    gone.set(withTiming(hidden ? 1 : 0, { duration: hidden ? 180 : 120, easing: EASE }));
  }, [gone, hidden]);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(
      () =>
        lid.set(
          withSequence(
            withTiming(0.07, { duration: 95 }),
            withTiming(1, { duration: 135 }),
          ),
        ),
      3870,
    );
    return () => {
      clearInterval(id);
      cancelAnimation(lid);
    };
  }, [lid, reduced]);

  // A swap crossfades the old drawing out (180 ms) while the new one fades in
  // (220 ms), from scale 0.94: nothing appears from nothing.
  const [shown, setShown] = useState<{ current: HelperId; leaving: HelperId | null }>({
    current: helper,
    leaving: null,
  });
  const arrive = useSharedValue(1);
  const depart = useSharedValue(0);
  // Derived from the prop during render, the React way to remember the last value.
  if (helper !== shown.current) setShown({ current: helper, leaving: shown.current });
  useEffect(() => {
    if (!shown.leaving) return;
    if (reduced) {
      arrive.set(1);
      depart.set(0);
    } else {
      depart.set(1);
      arrive.set(0);
      depart.set(withTiming(0, { duration: 180, easing: EASE }));
      arrive.set(withTiming(1, { duration: 220, easing: EASE }));
    }
    const clear = setTimeout(
      () => setShown((s) => (s.leaving ? { ...s, leaving: null } : s)),
      reduced ? 0 : 240,
    );
    return () => clearTimeout(clear);
  }, [shown.leaving, reduced, arrive, depart]);

  const place = useAnimatedStyle(() => ({
    opacity: 1 - gone.get(),
    transformOrigin: [footX, footY, 0],
    transform: [
      { translateX: feetX.get() - footX },
      { translateY: feetY.get() - footY - hop.get() * 12 },
      { scale: figure.get() * (1 + holding.get() * 0.06) },
      { rotateZ: `${bodyX.get() * 1.8}deg` },
      { scaleX: 1 + pressure.get() * 0.035 },
      { scaleY: 1 - pressure.get() * 0.05 },
    ],
  }));
  const rig: Rig = {
    head: useDerivedValue<Transforms3d>(() => headTransform(headX.get(), headY.get())),
    pupils: useDerivedValue<Transforms3d>(() => pupilTransform(gazeX.get(), gazeY.get())),
    blink: useDerivedValue<Transforms3d>(() => [{ scaleY: lid.get() }]),
    curious: useDerivedValue(() => Math.max(0, -expression.get())),
    wry: useDerivedValue(() => Math.max(0, expression.get())),
    smile: useDerivedValue(() => 1 - Math.max(0, expression.get())),
  };
  const arriveScale = useDerivedValue<Transforms3d>(() => [{ scale: 0.94 + 0.06 * arrive.get() }]);

  // The analysing glow: the helper's own colour breathes behind it while a
  // photo is with the model. `energy` charges while a reply is on its way and
  // `spin` keeps the phase continuous, so the pulse never jumps.
  const glowOpacity = useDerivedValue(() => {
    const charge = energy.get();
    if (charge <= 0.01) return 0;
    const breath = reduced ? 1 : 0.72 + 0.28 * Math.sin(spin.get() * 2.4);
    return Math.min(1, charge * 1.5) * breath;
  });
  const glowScale = useDerivedValue<Transforms3d>(() => [
    { scale: reduced ? 1 : 1 + 0.07 * Math.sin(spin.get() * 2.4) },
  ]);
  const accent = helpers[shown.current].palette.accent;

  const tap = Gesture.Tap()
    .maxDuration(HOLD_MS - 40)
    .onBegin(() => pressure.set(withTiming(1, { duration: 100 })))
    .onFinalize((_event, success) => {
      pressure.set(withTiming(0, { duration: 170 }));
      if (success) scheduleOnRN(onPress);
    });
  const hold = Gesture.LongPress()
    .minDuration(HOLD_MS)
    .onStart(() => {
      pressure.set(withTiming(0, { duration: 120 }));
      holding.set(withTiming(1, { duration: 160, easing: EASE }));
      if (onHold) scheduleOnRN(onHold);
    })
    .onFinalize(() => {
      holding.set(withTiming(0, { duration: 180, easing: EASE }));
    });
  const gesture = onHold ? Gesture.Race(hold, tap) : tap;
  const Current = figures[shown.current];
  const Leaving = shown.leaving ? figures[shown.leaving] : null;
  const name = helpers[helper].name;
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={
          calendarOpen
            ? `${name}, close calorie calendar`
            : `${name}, open calorie calendar`
        }
        accessibilityHint={
          onHold
            ? "Opens your food diary. Touch and hold to change your helper."
            : "Opens your food diary."
        }
        onAccessibilityTap={onPress}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "longpress") {
            onHold?.();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          }
        }}
        accessibilityActions={onHold ? [{ name: "longpress", label: "Change helper" }] : undefined}
        style={[
          {
            position: "absolute",
            left: 0,
            top: 0,
            width: FIGURE.hero,
            height: FIGURE.hero,
            zIndex: 45,
          },
          place,
        ]}
      >
        <Canvas
          pointerEvents="none"
          style={{ width: FIGURE.hero, height: FIGURE.hero }}
        >
          <Group transform={[{ scale: FIGURE.hero / 140 }]}>
            <Glow accent={accent} opacity={glowOpacity} transform={glowScale} />
            {Leaving && shown.leaving && (
              <Group opacity={depart}>
                <Leaving rig={rig} palette={helpers[shown.leaving].palette} />
              </Group>
            )}
            <Group opacity={arrive} transform={arriveScale} origin={vec(70, 128)}>
              <Current rig={rig} palette={helpers[shown.current].palette} />
            </Group>
          </Group>
        </Canvas>
      </Animated.View>
    </GestureDetector>
  );
}
