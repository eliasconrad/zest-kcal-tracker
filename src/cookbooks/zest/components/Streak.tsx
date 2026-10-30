import { useState } from "react";
import { Text, View } from "react-native";
import {
  Canvas,
  Group,
  Oval,
  Path,
  Skia,
  usePathInterpolation,
} from "@shopify/react-native-skia";
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import { Touch } from "./ui/Touch";
import { theme } from "../theme";

/**
 * The streak flame, drawn in Zest's gold instead of Duolingo's orange. The
 * silhouette and the motion follow the frame-by-frame read of Duolingo's
 * streak reveal (docs/MOTION_SPEC.md, "Streak"): a grey outline holds, squashes
 * into a bead, turns gold, pops, stretches, bursts and settles while the
 * counter flips from the old number to the new one.
 */
export const streakColors = {
  lit: theme.soft, // outer flame
  core: "#F4E7BF", // inner tongue
  dim: "#DAD9D2", // unlit outer
  dimCore: theme.paper, // unlit inner
};

const FLAME = Skia.Path.MakeFromSVGString(
  // 100 x 100 box; tip at top, round belly, one trailing ear on the left.
  "M50 2 C58 18 76 28 76 52 C76 70 64 82 50 82 C36 82 24 70 24 52 C24 44 28 38 31 34 C33 44 38 48 42 46 C38 34 42 18 50 2 Z",
)!;
const CORE = Skia.Path.MakeFromSVGString(
  "M50 42 C56 50 62 54 62 62 C62 69 56 74 50 74 C44 74 38 69 38 62 C38 56 44 50 50 42 Z",
)!;
// The squashed flame: a soft pill on the same base, drawn with the same segments
// as FLAME and CORE so one morphs into the other.
const BEAD = Skia.Path.MakeFromSVGString(
  "M50 38 C66 38 84 42 84 60 C84 74 66 82 50 82 C34 82 16 74 16 60 C16 53 18 48 22 45 C28 41 34 39 40 38.5 C43 38 47 38 50 38 Z",
)!;
const BEAD_CORE = Skia.Path.MakeFromSVGString(
  "M34 50 C40 46 50 46 54 50 C56 55 50 60 42 60 C36 60 30 58 30 54 C30 52 32 51 34 50 Z",
)!;

export function StreakFlame({
  size,
  lit,
  progress,
}: {
  size: number;
  /** 0 grey, 1 gold; animated by the celebration, fixed elsewhere. */
  lit: number | SharedValue<number>;
  /** Optional squash/stretch driver: -1 squashed flat, 0 rest, 1 stretched tall. */
  progress?: SharedValue<number>;
}) {
  const litValue = useDerivedValue(() =>
    typeof lit === "number" ? lit : lit.get(),
  );
  // 0 is the flame, 1 the bead; the bead is reached before the deepest squash.
  const morph = useDerivedValue(() =>
    Math.min(1, Math.max(0, -(progress?.get() ?? 0) / 0.85)),
  );
  const outerPath = usePathInterpolation(morph, [0, 1], [FLAME, BEAD]);
  const innerPath = usePathInterpolation(morph, [0, 1], [CORE, BEAD_CORE]);
  const outer = useDerivedValue(() =>
    litValue.get() > 0.5 ? streakColors.lit : streakColors.dim,
  );
  const inner = useDerivedValue(() =>
    litValue.get() > 0.5 ? streakColors.core : streakColors.dimCore,
  );
  // Scale about the flame's base; `origin` handles the pivot, so the transform
  // holds only the scales (a manual translate pair here double-applied the pivot).
  const transform = useDerivedValue(() => {
    const p = progress?.get() ?? 0;
    const deep = Math.min(0, p + 0.85);
    const sx = p < 0 ? 1 - deep * 0.2 : 1 - p * 0.18;
    const sy = p < 0 ? 1 + deep * 0.5 : 1 + p * 0.3;
    return [{ scaleX: sx }, { scaleY: sy }];
  });
  const shadow = useDerivedValue(() =>
    litValue.get() > 0.5 ? "#F4E7BF" : "#E9E8E2",
  );
  const shadowWidth = useDerivedValue(() => [
    { scaleX: 1 + morph.get() * 0.5 },
  ]);
  return (
    <Canvas style={{ width: size, height: size }}>
      <Group transform={[{ scale: size / 100 }]}>
        {progress && (
          <Group transform={shadowWidth} origin={{ x: 50, y: 84 }}>
            <Oval x={28} y={79} width={44} height={10} color={shadow} />
          </Group>
        )}
        <Group transform={transform} origin={{ x: 50, y: 82 }}>
          <Path path={outerPath} color={outer} />
          <Path path={innerPath} color={inner} />
        </Group>
      </Group>
    </Canvas>
  );
}

/** Gold sparks that fly out of the flame on the pop; 8 frames in the reference. */
function Sparks({ fire, size }: { fire: SharedValue<number>; size: number }) {
  const dots = [
    [-1, -0.9],
    [1, -0.8],
    [-0.8, 0.3],
    [0.9, 0.2],
    [-0.4, -1.2],
    [0.5, -1.1],
    [-1.1, -0.2],
    [1.2, -0.3],
  ];
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {dots.map(([dx, dy], i) => (
        <Spark key={i} fire={fire} dx={dx} dy={dy} size={size} />
      ))}
    </View>
  );
}

function Spark({
  fire,
  dx,
  dy,
  size,
}: {
  fire: SharedValue<number>;
  dx: number;
  dy: number;
  size: number;
}) {
  const style = useAnimatedStyle(() => {
    const t = fire.get();
    return {
      opacity: t <= 0 ? 0 : 1 - t * t,
      // They leave from the flame's edge, so they show from the first frame.
      transform: [
        { translateX: dx * size * (0.3 + 0.4 * t) },
        { translateY: dy * size * (0.3 + 0.4 * t) + size * 0.12 * t * t },
        { scale: 1 - t * 0.5 },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: size * 0.07,
          height: size * 0.07,
          borderRadius: size * 0.035,
          backgroundColor: streakColors.lit,
        },
        style,
      ]}
    />
  );
}

/** The number under the flame; the old one squashes down and the new one rises, as the counter does. */
function Counter({
  from,
  to,
  flip,
  color,
}: {
  from: number;
  to: number;
  flip: SharedValue<number>;
  color: SharedValue<string>;
}) {
  const oldStyle = useAnimatedStyle(() => ({
    opacity: flip.get() < 0.5 ? 1 : 0,
    transform: [{ scaleY: 1 - flip.get() * 2 }],
  }));
  const newStyle = useAnimatedStyle(() => ({
    opacity: flip.get() >= 0.5 ? 1 : 0,
    transform: [
      { translateY: (1 - flip.get()) * 24 },
      { scaleY: Math.min(1, (flip.get() - 0.5) * 2) },
    ],
  }));
  const text = useAnimatedStyle(() => ({ color: color.get() }));
  const base = {
    fontSize: 72,
    lineHeight: 80,
    fontWeight: "600" as const,
    letterSpacing: -3,
    fontVariant: ["tabular-nums" as const],
  };
  return (
    <View style={{ height: 80, alignItems: "center" }}>
      <Animated.Text style={[base, { position: "absolute" }, oldStyle, text]}>
        {from}
      </Animated.Text>
      <Animated.Text style={[base, { position: "absolute" }, newStyle, text]}>
        {to}
      </Animated.Text>
    </View>
  );
}

// Duolingo's reveal, counted frame by frame at 30 fps (docs/MOTION_SPEC.md). The
// fade crosses the receipt, so the grey reads from its middle; a beat starts a
// frame before it shows, which is why the bead counts one less than the recording.
const FADE = 6;
const HOLD = FADE + 15;
const SQUASH = 4;
const BEAD_HOLD = 7;
const POP = 1;
const HOLD2 = 5;
const STRETCH = 2;
const BURST_AT = HOLD + SQUASH + BEAD_HOLD + POP + HOLD2 + STRETCH;
const LIT_AT = HOLD + SQUASH;
const END = BURST_AT + 14;
const SHAPE_AT = [
  0,
  HOLD,
  HOLD + SQUASH / 2,
  HOLD + SQUASH,
  HOLD + SQUASH + BEAD_HOLD,
  HOLD + SQUASH + BEAD_HOLD + POP,
  BURST_AT - STRETCH,
  BURST_AT,
  BURST_AT + 1,
  BURST_AT + 5,
  BURST_AT + 8,
];
const SHAPE = [0, 0, -0.25, -1, -0.85, 0, 0, 1, -0.3, 0.06, 0];

/**
 * Full-screen streak celebration. One clock counts the frames of the reference
 * at 30 fps, see the constants above; the button follows the sparks.
 */
export function StreakCelebration({
  from,
  to,
  loggedWeek,
  reduced,
  onDone,
}: {
  from: number;
  to: number;
  /** Seven booleans, Monday first, for the week strip. */
  loggedWeek: boolean[];
  reduced: boolean;
  onDone: () => void;
}) {
  // One clock, counted in frames of the 30 fps reference. It advances by at most
  // one display frame's worth per tick: after a stall the animation carries on
  // where it was instead of jumping, so no beat can be skipped by a slow frame.
  const clock = useSharedValue(reduced ? END : 0);
  useFrameCallback((frame) => {
    if (clock.get() >= END) return;
    const elapsed = Math.min(frame.timeSincePreviousFrame ?? 16.7, 34);
    clock.set(clock.get() + elapsed / (1000 / 30));
  });
  const lit = useDerivedValue<number>(() => (clock.get() >= LIT_AT ? 1 : 0));
  const shape = useDerivedValue(() =>
    interpolate(clock.get(), SHAPE_AT, SHAPE, Extrapolation.CLAMP),
  );
  const fire = useDerivedValue(() =>
    interpolate(clock.get(), [BURST_AT, BURST_AT + 13], [0, 1], Extrapolation.CLAMP),
  );
  const flip = useDerivedValue(() =>
    interpolate(clock.get(), [BURST_AT, BURST_AT + 3], [0, 1], Extrapolation.CLAMP),
  );
  const [ready, setReady] = useState(reduced);
  const [headline, setHeadline] = useState(reduced);
  const color = useDerivedValue(() =>
    lit.get() > 0.5 ? theme.accent : streakColors.dim,
  );
  // Plain JS callbacks: a worklet may only hand scheduleOnRN a function it
  // captured from JS. Building the arrow inside the reaction would capture the
  // Haptics module, which cannot cross to the UI runtime and aborts the app.
  const buzz = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  const land = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setHeadline(true);
  };
  useAnimatedReaction(
    () => lit.get() > 0.5,
    (on, was) => {
      if (on && !was) scheduleOnRN(buzz);
    },
  );
  useAnimatedReaction(
    () => flip.get() > 0,
    (on, was) => {
      if (on && !was) scheduleOnRN(land);
    },
  );
  useAnimatedReaction(
    () => fire.get() >= 1,
    (on, was) => {
      if (on && !was) scheduleOnRN(setReady, true);
    },
  );
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const todayIndex = (new Date().getDay() + 6) % 7;
  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(200)}
      exiting={reduced ? undefined : FadeOut.duration(200)}
      accessibilityViewIsModal
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 60,
        backgroundColor: theme.paper,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 28,
      }}
    >
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <StreakFlame size={176} lit={lit} progress={shape} />
        <Sparks fire={fire} size={176} />
      </View>
      <Counter from={from} to={to} flip={flip} color={color} />
      <Text
        accessibilityLiveRegion="polite"
        style={{
          marginTop: 6,
          fontSize: 24,
          fontWeight: "600",
          letterSpacing: -0.6,
          color: headline ? theme.ink : "transparent",
        }}
      >
        {to === 1 ? "day streak!" : "day streak!"}
      </Text>
      <Text
        style={{
          marginTop: 8,
          fontSize: 15,
          lineHeight: 21,
          textAlign: "center",
          color: headline ? theme.muted : "transparent",
        }}
      >
        {to === 1
          ? "Log a meal every day to keep it lit."
          : "Keep it going. One plate a day is enough."}
      </Text>
      <View
        accessible
        accessibilityLabel={`This week: ${loggedWeek.filter(Boolean).length} of 7 days logged`}
        style={{
          flexDirection: "row",
          gap: 10,
          marginTop: 28,
          padding: 14,
          borderRadius: 22,
          borderCurve: "continuous",
          backgroundColor: "#FFFFFF",
        }}
      >
        {days.map((d, i) => (
          <View key={i} style={{ alignItems: "center", gap: 6, width: 34 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: i === todayIndex ? "700" : "500",
                color: i === todayIndex ? theme.accent : theme.faint,
              }}
            >
              {d}
            </Text>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: loggedWeek[i] ? "#F6EFD6" : "#25272009",
              }}
            >
              {loggedWeek[i] ? (
                <StreakFlame size={20} lit={i === todayIndex ? lit : 1} />
              ) : null}
            </View>
          </View>
        ))}
      </View>
      <View
        accessibilityElementsHidden={!ready}
        style={{ position: "absolute", left: 24, right: 24, bottom: 48 }}
      >
        <Touch
          label="Keep it going"
          onPress={onDone}
          disabled={!ready}
          style={{
            height: 52,
            borderRadius: 26,
            backgroundColor: theme.heavy,
            alignItems: "center",
            justifyContent: "center",
            opacity: ready ? 1 : 0,
          }}
        >
          <Text
            style={{ fontSize: 16, fontWeight: "600", color: theme.onHeavy }}
          >
            Keep it going
          </Text>
        </Touch>
      </View>
    </Animated.View>
  );
}

/** Duolingo's streak header, in gold: the number, the word, the flame badge, and a week strip. */
export function StreakBand({
  days,
  loggedWeek,
}: {
  days: number;
  loggedWeek: boolean[];
}) {
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  const todayIndex = (new Date().getDay() + 6) % 7;
  const lit = days > 0;
  return (
    <View
      accessible
      accessibilityLabel={`${days} day logging streak, ${loggedWeek.filter(Boolean).length} of 7 days this week`}
      style={{
        borderRadius: 24,
        borderCurve: "continuous",
        overflow: "hidden",
        backgroundColor: lit ? theme.soft : "#E6E5DE",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingTop: 18,
          paddingBottom: 14,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 56,
              lineHeight: 60,
              fontWeight: "600",
              letterSpacing: -2.4,
              fontVariant: ["tabular-nums"],
              color: lit ? "#FFFFFF" : theme.muted,
            }}
          >
            {days}
          </Text>
          <Text
            style={{
              fontSize: 17,
              fontWeight: "600",
              marginTop: -2,
              color: lit ? "#FFFFFF" : theme.muted,
            }}
          >
            {days === 1 ? "day streak!" : "day streak!"}
          </Text>
        </View>
        <View
          style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            backgroundColor: lit ? "#FFFFFF22" : "#FFFFFF66",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <StreakFlame size={60} lit={lit ? 1 : 0} />
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          backgroundColor: "#FFFFFF",
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        {labels.map((d, i) => (
          <View key={i} style={{ alignItems: "center", gap: 5, width: 36 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: i === todayIndex ? "700" : "500",
                color: i === todayIndex ? theme.accent : theme.faint,
              }}
            >
              {d}
            </Text>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: loggedWeek[i] ? "#F6EFD6" : "#25272009",
              }}
            >
              {loggedWeek[i] ? <StreakFlame size={18} lit={1} /> : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
