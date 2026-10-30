import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import {
  Canvas,
  Circle,
  Group,
  Path,
  Skia,
  type Transforms3d,
} from "@shopify/react-native-skia";
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { artShapes, type ArtId } from "./drawings";
import { theme } from "../../theme";

const EASE = Easing.bezier(0.23, 1, 0.32, 1);

/** One drawing at any size. */
export function ArtIcon({ id, size }: { id: ArtId; size: number }) {
  return (
    <Canvas pointerEvents="none" style={{ width: size, height: size }}>
      <Group transform={[{ scale: size / 64 }]}>
        {artShapes[id].map((shape, i) => (
          <Path key={i} path={shape.path} color={shape.color} />
        ))}
      </Group>
    </Canvas>
  );
}

/** The props beside the mascot on the sheet's edge; they rise from behind it, one after the other. */
export function StepStage({
  props,
  floor,
  reduced,
}: {
  props: ArtId[];
  floor: number;
  reduced: boolean;
}) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      style={{
        position: "absolute",
        left: 30,
        top: floor - 58,
        height: 62,
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 6,
      }}
    >
      {props.map((id, i) => (
        <Prop key={`${id}-${i}`} id={id} order={i} reduced={reduced} />
      ))}
    </View>
  );
}

function Prop({ id, order, reduced }: { id: ArtId; order: number; reduced: boolean }) {
  const rise = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    rise.set(
      withDelay(120 + order * 80, withSpring(1, { duration: 520, dampingRatio: 0.68 })),
    );
  }, [order, reduced, rise]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, rise.get() * 2),
    transform: [{ translateY: (1 - rise.get()) * 44 }],
  }));
  return (
    <Animated.View style={style}>
      <ArtIcon id={id} size={order === 0 ? 54 : 44} />
    </Animated.View>
  );
}

/** Short ticks that fly off the four corners of a row when it is chosen. */
export function TickBurst({ color, reduced }: { color: string; reduced: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.set(withTiming(1, { duration: 420, easing: EASE }));
  }, [reduced, t]);
  if (reduced) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      style={{ position: "absolute", inset: 0 }}
    >
      {[
        [0, 0, -1, -1],
        [1, 0, 1, -1],
        [0, 1, -1, 1],
        [1, 1, 1, 1],
      ].flatMap(([x, y, dx, dy]) =>
        [0, 1].map((second) => (
          <Tick
            key={`${x}${y}${second}`}
            t={t}
            x={x}
            y={y}
            dx={second ? dx * 0.45 : dx}
            dy={second ? dy : dy * 0.45}
            color={color}
          />
        )),
      )}
    </View>
  );
}

function Tick({
  t,
  x,
  y,
  dx,
  dy,
  color,
}: {
  t: SharedValue<number>;
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: string;
}) {
  const angle = `${(Math.atan2(dy, dx) * 180) / Math.PI}deg`;
  const style = useAnimatedStyle(() => ({
    opacity: t.get() < 0.05 ? 0 : 1 - t.get(),
    transform: [
      { translateX: dx * (2 + 12 * t.get()) },
      { translateY: dy * (2 + 12 * t.get()) },
      { rotate: angle },
    ],
  }));
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: x ? undefined : 4,
          right: x ? 4 : undefined,
          top: y ? undefined : 2,
          bottom: y ? 2 : undefined,
          width: 7,
          height: 2.5,
          borderRadius: 1.25,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

/** The way from today's weight to the target, drawn once when the pace changes. */
export function PaceCurve({
  from,
  to,
  fromLabel,
  toLabel,
  width,
  reduced,
}: {
  from: number;
  to: number;
  fromLabel: string;
  toLabel: string;
  width: number;
  reduced: boolean;
}) {
  const height = 96;
  const down = to < from;
  const startY = down ? 18 : height - 18;
  const endY = down ? height - 18 : 18;
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(10, startY);
    p.cubicTo(width * 0.34, startY, width * 0.56, endY, width - 10, endY);
    return p;
  }, [endY, startY, width]);
  const draw = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    draw.set(0);
    draw.set(withDelay(120, withTiming(1, { duration: 620, easing: EASE })));
  }, [draw, reduced, from, to, fromLabel, toLabel]);
  const dotOpacity = useDerivedValue(() => (draw.get() > 0.96 ? 1 : 0));
  return (
    <View style={{ height, marginBottom: 2 }}>
      <Canvas pointerEvents="none" style={{ width, height }}>
        <Path
          path={path}
          color={theme.soft}
          style="stroke"
          strokeWidth={5}
          strokeCap="round"
          end={draw}
        />
        <Circle cx={10} cy={startY} r={5} color={theme.ink} />
        <Circle cx={width - 10} cy={endY} r={7} color={theme.accent} opacity={dotOpacity} />
      </Canvas>
      <Text
        style={{
          position: "absolute",
          left: 0,
          top: down ? 28 : height - 44,
          fontSize: 12,
          color: theme.muted,
        }}
      >
        {fromLabel}
      </Text>
      <Text
        style={{
          position: "absolute",
          right: 0,
          top: down ? height - 44 : 28,
          fontSize: 13,
          fontWeight: "600",
          color: theme.ink,
        }}
      >
        {toLabel}
      </Text>
    </View>
  );
}

const ORBIT: { id: ArtId; ring: number; start: number; speed: number }[] = [
  { id: "egg", ring: 0, start: 0.2, speed: 0.5 },
  { id: "carrot", ring: 0, start: 3.4, speed: 0.5 },
  { id: "flame", ring: 1, start: 1.1, speed: -0.34 },
  { id: "fish", ring: 1, start: 3.2, speed: -0.34 },
  { id: "wheat", ring: 1, start: 5.2, speed: -0.34 },
  { id: "scale", ring: 2, start: 0.6, speed: 0.22 },
  { id: "sneaker", ring: 2, start: 2.7, speed: 0.22 },
  { id: "cookie", ring: 2, start: 4.8, speed: 0.22 },
];
const RINGS = [44, 70, 96];

/** What the plan is made of, circling the plate while the number climbs. */
export function PlanOrbit({ duration, reduced }: { duration: number; reduced: boolean }) {
  const size = 216;
  const middle = size / 2;
  const clock = useSharedValue(0);
  useFrameCallback((frame) => {
    if (reduced) return;
    clock.set(clock.get() + (frame.timeSincePreviousFrame ?? 16) / 1000);
  });
  const [percent, setPercent] = useState(reduced ? 100 : 0);
  useEffect(() => {
    if (reduced) return;
    const started = Date.now();
    const id = setInterval(() => {
      const progress = Math.min(1, (Date.now() - started) / duration);
      setPercent(Math.round(progress * 100));
    }, 60);
    return () => clearInterval(id);
  }, [duration, reduced]);
  return (
    <View style={{ alignItems: "center" }}>
      <Canvas pointerEvents="none" style={{ width: size, height: size }}>
        {RINGS.map((r) => (
          <Circle
            key={r}
            cx={middle}
            cy={middle}
            r={r}
            color="#25272012"
            style="stroke"
            strokeWidth={1}
          />
        ))}
        <Group transform={[{ translate: [middle - 26, middle - 26] }, { scale: 52 / 64 }]}>
          {artShapes.plate.map((shape, i) => (
            <Path key={i} path={shape.path} color={shape.color} />
          ))}
        </Group>
        {ORBIT.map((item) => (
          <Orbiter key={item.id} {...item} clock={clock} middle={middle} />
        ))}
      </Canvas>
      <Text
        style={{
          fontSize: 44,
          lineHeight: 50,
          fontWeight: "700",
          letterSpacing: -1.6,
          fontVariant: ["tabular-nums"],
          color: theme.accent,
        }}
      >
        {percent}%
      </Text>
    </View>
  );
}

function Orbiter({
  id,
  ring,
  start,
  speed,
  clock,
  middle,
}: {
  id: ArtId;
  ring: number;
  start: number;
  speed: number;
  clock: SharedValue<number>;
  middle: number;
}) {
  const icon = 24;
  const r = RINGS[ring];
  const transform = useDerivedValue<Transforms3d>(() => {
    const angle = start + clock.get() * speed;
    return [
      { translateX: middle + Math.cos(angle) * r - icon / 2 },
      { translateY: middle + Math.sin(angle) * r - icon / 2 },
      { scale: icon / 64 },
    ];
  });
  return (
    <Group transform={transform}>
      {artShapes[id].map((shape, i) => (
        <Path key={i} path={shape.path} color={shape.color} />
      ))}
    </Group>
  );
}
