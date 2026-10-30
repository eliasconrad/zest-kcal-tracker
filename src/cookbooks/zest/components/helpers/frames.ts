import type { Transforms3d } from "@shopify/react-native-skia";

/**
 * Named frames: fixed rig values for a still drawing. The live companion
 * moves between these continuously; cards, the swap bar and the gallery show
 * one frame at a time.
 */
export type FrameId = "idle" | "blink" | "curious" | "wry" | "think" | "cheer" | "analysing";

export type Frame = {
  gazeX: number;
  gazeY: number;
  /** Head lean, -1..1, from the same gaze with a lag. */
  headX: number;
  headY: number;
  lid: number;
  curious: number;
  wry: number;
  /** 0..1 strength of the accent glow behind the body. */
  glow?: number;
};

export const frames: Record<FrameId, Frame> = {
  idle: { gazeX: 0, gazeY: 0, headX: 0, headY: 0, lid: 1, curious: 0, wry: 0 },
  blink: { gazeX: 0, gazeY: 0, headX: 0, headY: 0, lid: 0.07, curious: 0, wry: 0 },
  curious: { gazeX: -0.35, gazeY: -0.45, headX: -0.3, headY: -0.3, lid: 1, curious: 1, wry: 0 },
  wry: { gazeX: 0.5, gazeY: 0.1, headX: 0.4, headY: 0, lid: 1, curious: 0, wry: 1 },
  /** Looking down at the photo on the composer, brows lightly up. */
  think: { gazeX: 0.3, gazeY: 0.65, headX: 0.3, headY: 0.55, lid: 1, curious: 0.5, wry: 0 },
  /** Chin up, eyes wide: the hop after a logged meal. */
  cheer: { gazeX: 0, gazeY: -0.3, headX: 0, headY: -0.5, lid: 1, curious: 0.35, wry: 0 },
  /** The think frame with the accent glowing behind it: a photo is with the model. */
  analysing: { gazeX: 0.3, gazeY: 0.65, headX: 0.3, headY: 0.55, lid: 1, curious: 0.5, wry: 0, glow: 1 },
};

export const frameIds = Object.keys(frames) as FrameId[];

/** The head transform for a frame, as the live companion derives it. */
export function headTransform(headX: number, headY: number): Transforms3d {
  "worklet";
  return [{ translateX: headX * 3.6 }, { translateY: headY * 2 }, { rotate: headX * 0.035 }];
}

export function pupilTransform(gazeX: number, gazeY: number): Transforms3d {
  "worklet";
  return [{ translateX: gazeX * 3 }, { translateY: gazeY * 2.3 }];
}
