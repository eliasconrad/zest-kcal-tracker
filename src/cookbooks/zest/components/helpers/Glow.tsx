import { BlurMask, Circle, Group, RadialGradient, vec, type Transforms3d } from "@shopify/react-native-skia";
import type { SharedValue } from "react-native-reanimated";

/**
 * The analysing glow: the helper's accent breathing behind it, drawn in the
 * 140-point figure space under the body. The live companion feeds it from
 * `energy` and `spin`; a still frame passes plain numbers.
 */
export function Glow({
  accent,
  opacity,
  transform,
}: {
  accent: string;
  opacity: number | Readonly<SharedValue<number>>;
  transform?: Transforms3d | Readonly<SharedValue<Transforms3d>>;
}) {
  // A Group given an origin without a transform shifts what follows it; only
  // pair the two when the pulse is live.
  const pulse = transform ? { transform, origin: vec(70, 80) } : {};
  return (
    <Group opacity={opacity} {...pulse}>
      <Circle cx={70} cy={80} r={66}>
        <RadialGradient
          c={vec(70, 80)}
          r={66}
          colors={[`${accent}B8`, `${accent}55`, `${accent}00`]}
          positions={[0, 0.55, 1]}
        />
        <BlurMask blur={6} style="normal" />
      </Circle>
    </Group>
  );
}
