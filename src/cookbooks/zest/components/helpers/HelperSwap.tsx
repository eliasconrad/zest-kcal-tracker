import { useEffect, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { BlurView } from "expo-blur";
import {
  Blur,
  Canvas,
  Group,
  Paint,
  type Transforms3d,
} from "@shopify/react-native-skia";
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import { GlassSurface, useNativeGlass } from "../ui/GlassSurface";
import { Touch } from "../ui/Touch";
import { figures, type Rig } from "./Figures";
import { headTransform, pupilTransform } from "./frames";
import { swapHelpers, type HelperId } from "../../data/helpers";
import type { Scene } from "../../hooks/useScene";
import { EASE } from "../../motion/timing";
import { theme } from "../../theme";

const CARD = 248;
const FIGURE_SIZE = 216;
/** Centre to centre; wide enough that a neighbour peeks past the card and off the screen. */
const STEP = 196;
const STAGE = 300;
const SETTLE = { duration: 400, dampingRatio: 1 };

/**
 * The swap mode: a hold on the companion frosts the chat over, and the six
 * helpers sit in a row across one glass card. A swipe moves between them, the
 * button picks the one on the card. The row lives in one canvas, so the blur
 * and the eyes of every helper run on the UI thread.
 */
export function HelperSwap({
  scene,
  selected,
  onChoose,
  onClose,
}: {
  scene: Scene;
  selected: HelperId;
  onChoose: (id: HelperId) => void;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const native = useNativeGlass();
  const { reduced } = scene;
  const first = Math.max(0, swapHelpers.findIndex((h) => h.id === selected));
  const [shown, setShown] = useState(first);
  const index = useSharedValue(first);
  const startIndex = useSharedValue(first);
  const helper = swapHelpers[shown];
  const last = swapHelpers.length - 1;
  const stageTop = Math.max(scene.top + 28, height * 0.46 - STAGE / 2 - 40);

  const tick = (next: number) => {
    setShown(next);
    void Haptics.selectionAsync();
  };
  useAnimatedReaction(
    () => Math.round(index.get()),
    (now, before) => {
      if (before !== null && now !== before && now >= 0 && now <= last)
        scheduleOnRN(tick, now);
    },
  );
  const go = (target: number, velocity = 0) => {
    "worklet";
    const clamped = Math.max(0, Math.min(last, target));
    index.set(
      reduced
        ? withTiming(clamped, { duration: 0 })
        : withSpring(clamped, { ...SETTLE, velocity }),
    );
  };

  // A finger on the stage draws the eyes; left alone they follow the scene's tilt and drift.
  const fingerX = useSharedValue(0);
  const fingerY = useSharedValue(0);
  const fingerOn = useSharedValue(0);
  const look = (x: number, y: number) => {
    "worklet";
    fingerX.set(Math.max(-1, Math.min(1, (x - width / 2) / 170)));
    fingerY.set(Math.max(-1, Math.min(1, (y - STAGE / 2) / 170)));
  };
  const swipe = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-24, 24])
    .onBegin((event) => {
      startIndex.set(index.get());
      fingerOn.set(1);
      look(event.x, event.y);
    })
    .onUpdate((event) => {
      look(event.x, event.y);
      const next = startIndex.get() - event.translationX / STEP;
      index.set(
        next < 0 ? next * 0.35 : next > last ? last + (next - last) * 0.35 : next,
      );
    })
    .onEnd((event) => {
      const flick = index.get() - (event.velocityX / STEP) * 0.18;
      // Paged, as the dots promise: one swipe moves one helper, however hard.
      const from = Math.round(startIndex.get());
      go(
        Math.max(from - 1, Math.min(from + 1, Math.round(flick))),
        -event.velocityX / STEP,
      );
    })
    .onFinalize(() => {
      fingerOn.set(0);
    });
  // A neighbour is a target too: a tap on its side moves to it.
  const tap = Gesture.Tap()
    .onBegin((event) => {
      fingerOn.set(1);
      look(event.x, event.y);
    })
    .onEnd((event) => {
      const edge = (width - CARD) / 2;
      if (event.x < edge) go(Math.round(index.get()) - 1);
      else if (event.x > width - edge) go(Math.round(index.get()) + 1);
    })
    .onFinalize(() => {
      fingerOn.set(0);
    });

  const gazeX = useDerivedValue(() =>
    fingerOn.get() ? fingerX.get() : scene.gazeX.get(),
  );
  const gazeY = useDerivedValue(() =>
    fingerOn.get() ? fingerY.get() : scene.gazeY.get(),
  );
  const softX = useSharedValue(0);
  const softY = useSharedValue(0);
  useAnimatedReaction(
    () => [gazeX.get(), gazeY.get()],
    ([x, y]) => {
      softX.set(withTiming(x, { duration: 140 }));
      softY.set(withTiming(y, { duration: 140 }));
    },
  );
  const lid = useSharedValue(1);
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
    return () => clearInterval(id);
  }, [lid, reduced]);
  const rig: Rig = {
    head: useDerivedValue<Transforms3d>(() =>
      headTransform(softX.get() * 0.6, softY.get() * 0.6),
    ),
    pupils: useDerivedValue<Transforms3d>(() =>
      pupilTransform(softX.get(), softY.get()),
    ),
    blink: useDerivedValue<Transforms3d>(() => [{ scaleY: lid.get() }]),
    curious: useDerivedValue(() => 0),
    wry: useDerivedValue(() => 0),
    smile: useDerivedValue(() => 1),
  };

  const choose = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChoose(helper.id);
  };

  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(220).easing(EASE)}
      exiting={reduced ? undefined : FadeOut.duration(200).easing(EASE)}
      accessibilityViewIsModal
      style={{ position: "absolute", inset: 0, zIndex: 60 }}
    >
      {native ? (
        <BlurView intensity={70} tint="light" style={{ position: "absolute", inset: 0 }} />
      ) : null}
      <View
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: native ? "rgba(255, 255, 255, 0.62)" : "#FBFBF9",
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close helpers"
        onPress={onClose}
        style={{ position: "absolute", inset: 0 }}
      />
      <GlassSurface
        style={{
          position: "absolute",
          top: stageTop + (STAGE - CARD) / 2,
          left: (width - CARD) / 2,
          width: CARD,
          height: CARD,
          borderRadius: 60,
        }}
      />
      <GestureDetector gesture={Gesture.Race(swipe, tap)}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`${helper.name}, ${helper.tagline}`}
          accessibilityValue={{ text: `${shown + 1} of ${swapHelpers.length}` }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(event) =>
            go(shown + (event.nativeEvent.actionName === "increment" ? 1 : -1))
          }
          style={{ position: "absolute", top: stageTop, left: 0, width, height: STAGE }}
        >
          <Canvas pointerEvents="none" style={{ width, height: STAGE }}>
            {swapHelpers.map((h, i) => (
              <Seat key={h.id} id={h.id} seat={i} index={index} width={width} rig={rig} />
            ))}
          </Canvas>
        </View>
      </GestureDetector>
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: stageTop + STAGE + 8,
          left: 24,
          right: 24,
          alignItems: "center",
        }}
      >
        <Animated.View
          key={helper.id}
          entering={reduced ? undefined : FadeIn.duration(160).easing(EASE)}
          pointerEvents="none"
          style={{ alignItems: "center" }}
        >
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={1.4}
            style={{
              fontSize: 40,
              lineHeight: 46,
              fontWeight: "700",
              letterSpacing: -1.2,
              color: theme.ink,
            }}
          >
            {helper.name}
          </Text>
          <Text
            maxFontSizeMultiplier={1.4}
            style={{ fontSize: 17, lineHeight: 23, color: theme.muted, marginTop: 4 }}
          >
            {helper.tagline}
          </Text>
        </Animated.View>
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          style={{ flexDirection: "row", gap: 8, marginTop: 20 }}
        >
          {swapHelpers.map((h, i) => (
            <Dot key={h.id} seat={i} index={index} />
          ))}
        </View>
      </View>
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", left: 24, right: 24, bottom: scene.bottom + 12 }}
      >
        <GlassSurface
          interactive
          style={{ height: 58, borderRadius: 29, overflow: "hidden" }}
        >
          <Touch
            label={`Choose ${helper.name}`}
            onPress={choose}
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 17, fontWeight: "600", color: theme.ink }}>
              Choose {helper.name}
            </Text>
          </Touch>
        </GlassSurface>
      </View>
    </Animated.View>
  );
}

/** One helper's place in the row: sharp and full size on the card, blurred and smaller beside it. */
function Seat({
  id,
  seat,
  index,
  width,
  rig,
}: {
  id: HelperId;
  seat: number;
  index: SharedValue<number>;
  width: number;
  rig: Rig;
}) {
  const Figure = figures[id];
  const palette = swapHelpers[seat].palette;
  const away = useDerivedValue(() => Math.abs(seat - index.get()));
  const transform = useDerivedValue<Transforms3d>(() => {
    const scale =
      interpolate(away.get(), [0, 1], [1, 0.7], Extrapolation.CLAMP) *
      (FIGURE_SIZE / 140);
    const size = 140 * scale;
    return [
      { translateX: width / 2 + (seat - index.get()) * STEP - size / 2 },
      { translateY: (STAGE - size) / 2 },
      { scale },
    ];
  });
  const opacity = useDerivedValue(() =>
    interpolate(away.get(), [1.2, 1.7], [1, 0], Extrapolation.CLAMP),
  );
  const blur = useDerivedValue(() =>
    interpolate(away.get(), [0.15, 1], [0, 7], Extrapolation.CLAMP),
  );
  return (
    <Group
      opacity={opacity}
      layer={
        <Paint>
          <Blur blur={blur} />
        </Paint>
      }
    >
      <Group transform={transform}>
        <Figure rig={rig} palette={palette} />
      </Group>
    </Group>
  );
}

function Dot({ seat, index }: { seat: number; index: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const near = interpolate(
      Math.abs(seat - index.get()),
      [0, 1],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return { opacity: 0.22 + near * 0.78, transform: [{ scale: 1 + near * 0.2 }] };
  });
  return (
    <Animated.View
      style={[
        { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.ink },
        style,
      ]}
    />
  );
}
