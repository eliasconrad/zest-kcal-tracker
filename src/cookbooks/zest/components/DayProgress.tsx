import { useEffect } from "react";
import { Text, View } from "react-native";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import {
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { REPLY_EASE } from "./MealReply";
import type { Macros } from "../data/diary";
import { theme } from "../theme";

const ringColor = (ratio: number) => (ratio > 1 ? "#B49458" : "#85916C");

/** A Skia arc that fills with the day's share of the guide; over the guide it turns warm. */
export function CalorieRing({
  total,
  guide,
  size = 116,
  stroke = 11,
}: {
  total: number;
  guide: number;
  size?: number;
  stroke?: number;
}) {
  const reduced = useReducedMotion();
  const ratio = guide > 0 ? total / guide : 0;
  const progress = useSharedValue(reduced ? Math.min(1, ratio) : 0);
  useEffect(() => {
    progress.set(
      withTiming(Math.min(1, ratio), {
        duration: reduced ? 0 : 640,
        easing: REPLY_EASE,
      }),
    );
  }, [ratio, reduced, progress]);
  const inset = stroke / 2;
  const rect = Skia.XYWHRect(inset, inset, size - stroke, size - stroke);
  const track = Skia.Path.Make();
  track.addArc(rect, -90, 360);
  const arc = useDerivedValue(() => {
    const path = Skia.Path.Make();
    path.addArc(rect, -90, Math.max(0.001, progress.get()) * 360);
    return path;
  });
  const left = Math.max(0, guide - total);
  return (
    <View
      accessible
      accessibilityLabel={`${total} of ${guide} kilocalories, ${left} left`}
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <Canvas style={{ position: "absolute", width: size, height: size }}>
        <Path
          path={track}
          color="#25272012"
          style="stroke"
          strokeWidth={stroke}
          strokeCap="round"
        />
        <Path
          path={arc}
          color={ringColor(ratio)}
          style="stroke"
          strokeWidth={stroke}
          strokeCap="round"
        />
      </Canvas>
      <Text
        maxFontSizeMultiplier={1.3}
        style={{
          fontSize: size * 0.24,
          lineHeight: size * 0.28,
          fontWeight: "500",
          letterSpacing: -1,
          fontVariant: ["tabular-nums"],
          color: theme.ink,
        }}
      >
        {ratio > 1 ? `+${(total - guide).toLocaleString()}` : left.toLocaleString()}
      </Text>
      <Text style={{ fontSize: 11, color: theme.muted }}>{ratio > 1 ? "over" : "left"}</Text>
    </View>
  );
}

const macroRows: { key: keyof Macros; label: string; color: string }[] = [
  { key: "protein", label: "Protein", color: "#85916C" },
  { key: "carbs", label: "Carbs", color: "#C9AC50" },
  { key: "fat", label: "Fat", color: "#B08968" },
];

/** Three thin bars, grams against the day's targets. Unknown meals simply add nothing. */
export function MacroBars({
  logged,
  targets,
  compact = false,
}: {
  logged: Macros;
  targets: Macros;
  compact?: boolean;
}) {
  return (
    <View style={{ gap: compact ? 7 : 10 }}>
      {macroRows.map((row) => {
        const value = logged[row.key];
        const target = targets[row.key];
        const ratio = target > 0 ? Math.min(1, value / target) : 0;
        return (
          <View
            key={row.key}
            accessible
            accessibilityLabel={`${row.label} ${value} of ${target} grams`}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 3,
              }}
            >
              <Text style={{ fontSize: compact ? 11 : 12, color: theme.muted }}>
                {row.label}
              </Text>
              <Text
                style={{
                  fontSize: compact ? 11 : 12,
                  color: theme.ink,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {value}
                <Text style={{ color: theme.muted }}> / {target} g</Text>
              </Text>
            </View>
            <View
              style={{
                height: compact ? 4 : 6,
                borderRadius: 3,
                backgroundColor: "#25272012",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${ratio * 100}%`,
                  height: "100%",
                  borderRadius: 3,
                  backgroundColor: value > target ? "#B49458" : row.color,
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
