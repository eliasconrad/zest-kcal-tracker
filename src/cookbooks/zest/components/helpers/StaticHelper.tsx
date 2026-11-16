import { useMemo } from "react";
import { Canvas, Group, type Transforms3d } from "@shopify/react-native-skia";
import { useSharedValue } from "react-native-reanimated";
import { figures, type Rig } from "./Figures";
import { Glow } from "./Glow";
import { frames, headTransform, pupilTransform, type FrameId } from "./frames";
import { helpers, type HelperId } from "../../data/helpers";

/** A rig frozen on one frame; cards, the swap bar and the gallery use it. */
export function useStillRig(frame: FrameId): Rig {
  const f = frames[frame];
  const head = useSharedValue<Transforms3d>(headTransform(f.headX, f.headY));
  const pupils = useSharedValue<Transforms3d>(pupilTransform(f.gazeX, f.gazeY));
  const blink = useSharedValue<Transforms3d>([{ scaleY: f.lid }]);
  const curious = useSharedValue(f.curious);
  const wry = useSharedValue(f.wry);
  const smile = useSharedValue(1 - f.wry);
  return useMemo(
    () => ({ head, pupils, blink, curious, wry, smile }),
    // Shared values are stable; the frame picks their initial values once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frame],
  );
}

/**
 * One helper, still, at any size. The drawing space is 140 points; the
 * canvas scales it so lines stay crisp at 48 and at 240.
 */
export function StaticHelper({
  id,
  size = 96,
  frame = "idle",
}: {
  id: HelperId;
  size?: number;
  frame?: FrameId;
}) {
  const rig = useStillRig(frame);
  const Figure = figures[id];
  const glow = frames[frame].glow ?? 0;
  return (
    <Canvas pointerEvents="none" style={{ width: size, height: size }}>
      <Group transform={[{ scale: size / 140 }]}>
        {glow > 0 && <Glow accent={helpers[id].palette.accent} opacity={glow} />}
        <Figure rig={rig} palette={helpers[id].palette} />
      </Group>
    </Canvas>
  );
}
