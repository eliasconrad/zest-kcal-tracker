/**
 * Six live vector drawings on one rig. Every figure is drawn in the lemon's
 * 140 × 140 space with its feet on the same ground line, so the scene moves
 * them all the same way: eyes first, head next, body last.
 *
 * A figure reads the rig's shared values straight from the UI thread; nothing
 * here causes a React render per frame. Frames (idle, blink, curious, wry,
 * think, cheer) are values on that rig, see `frames.ts`.
 */
import type { ReactNode } from "react";
import {
  Circle,
  Group,
  Oval,
  Path,
  RoundedRect,
  vec,
  type Transforms3d,
} from "@shopify/react-native-skia";
import type { SharedValue } from "react-native-reanimated";
import type { HelperId, HelperPalette } from "../../data/helpers";

type Live<T> = Readonly<SharedValue<T>>;

export type Rig = {
  /** Head translate and tilt, following the gaze with a short lag. */
  head: Live<Transforms3d>;
  /** Pupil offset inside the eye. */
  pupils: Live<Transforms3d>;
  /** `scaleY` of the eyes; 1 open, 0.07 shut. */
  blink: Live<Transforms3d>;
  /** 0..1 raised brows. */
  curious: Live<number>;
  /** 0..1 one brow up, mouth to the side. */
  wry: Live<number>;
  /** 0..1 the plain smile; fades as `wry` rises. */
  smile: Live<number>;
};

export type FigureProps = { rig: Rig; palette: HelperPalette };

/** The ground every figure stands on, and the shared head pivot. */
export const GROUND = 128;
const PIVOT = vec(70, 74);

function Shadow({ width = 60 }: { width?: number }) {
  return <Oval x={70 - width / 2} y={GROUND - 2} width={width} height={5} color="#272A2012" />;
}

/**
 * Two eyes with pupils and a highlight. Blink scales around the eye line.
 * `shape` round for owls and frogs, tall for the rest.
 */
function Eyes({
  rig,
  palette,
  left,
  right,
  y,
  width = 20,
  height = 26,
  round = false,
  white = "#FFFDF6",
}: {
  rig: Rig;
  palette: HelperPalette;
  left: number;
  right: number;
  y: number;
  width?: number;
  height?: number;
  round?: boolean;
  white?: string;
}) {
  const r = round ? width / 2 : width / 2;
  const pw = round ? width * 0.46 : width * 0.4;
  const ph = round ? width * 0.46 : height * 0.56;
  return (
    <Group origin={vec(70, y + height / 2)} transform={rig.blink}>
      {[left, right].map((x) => (
        <Group key={x}>
          <RoundedRect x={x} y={y} width={width} height={height} r={r} color={white} />
          <Group transform={rig.pupils}>
            <RoundedRect
              x={x + (width - pw) / 2}
              y={y + (height - ph) / 2 + (round ? 0 : height * 0.08)}
              width={pw}
              height={ph}
              r={pw / 2}
              color={palette.ink}
            />
            <Circle cx={x + width * 0.42} cy={y + height * 0.36} r={width * 0.11} color="white" />
          </Group>
        </Group>
      ))}
    </Group>
  );
}

/** Brows and mouth for the three expressions, placed around a face centre. */
function Face({
  rig,
  palette,
  cx = 70,
  browY = 50,
  mouthY = 90,
  spread = 22,
  mouthWidth = 20,
  mouth,
}: {
  rig: Rig;
  palette: HelperPalette;
  cx?: number;
  browY?: number;
  mouthY?: number;
  spread?: number;
  mouthWidth?: number;
  /** Drawn in place of the stroke smile when the species has its own mouth. */
  mouth?: ReactNode;
}) {
  const l = cx - spread;
  const r = cx + spread;
  const stroke = { color: palette.ink, style: "stroke" as const, strokeCap: "round" as const };
  return (
    <>
      <Group opacity={rig.curious}>
        <Path
          path={`M${l - 8} ${browY}Q${l} ${browY - 6} ${l + 9} ${browY - 2}M${r - 9} ${browY - 2}Q${r} ${browY - 6} ${r + 8} ${browY}`}
          {...stroke}
          strokeWidth={2.4}
        />
      </Group>
      <Group opacity={rig.wry}>
        <Path
          path={`M${l - 7} ${browY + 1}Q${l} ${browY} ${l + 9} ${browY + 3}M${r - 9} ${browY - 3}Q${r} ${browY - 9} ${r + 8} ${browY - 3}`}
          {...stroke}
          strokeWidth={2.7}
        />
        <Path
          path={`M${cx - mouthWidth / 2} ${mouthY + 3}Q${cx} ${mouthY + 8} ${cx + mouthWidth / 2} ${mouthY - 2}`}
          {...stroke}
          strokeWidth={2.7}
        />
      </Group>
      <Group opacity={rig.smile}>
        {mouth ?? (
          <Path
            path={`M${cx - mouthWidth / 2} ${mouthY}Q${cx} ${mouthY + 9} ${cx + mouthWidth / 2} ${mouthY}`}
            {...stroke}
            strokeWidth={2.7}
          />
        )}
      </Group>
    </>
  );
}

function Cheeks({ palette, y, cx = 70, spread = 33 }: { palette: HelperPalette; y: number; cx?: number; spread?: number }) {
  return (
    <>
      <Oval x={cx - spread - 5} y={y} width={11} height={5} color={palette.cheek} opacity={0.7} />
      <Oval x={cx + spread - 6} y={y} width={11} height={5} color={palette.cheek} opacity={0.7} />
    </>
  );
}

// MARK: Pebble, the penguin. One egg, white belly, orange beak and feet.

export function Pebble({ rig, palette }: FigureProps) {
  return (
    <>
      <Shadow width={64} />
      <Oval x={44} y={116} width={22} height={11} color={palette.accent} />
      <Oval x={74} y={116} width={22} height={11} color={palette.accent} />
      <Path path="M34 70Q30 128 70 127Q110 128 106 70Q104 22 70 22Q36 22 34 70Z" color={palette.body} />
      <Path path="M46 76Q44 122 70 121Q96 122 94 76Q92 50 70 50Q48 50 46 76Z" color={palette.light} />
      {/* Flippers rest on the belly, the far one a shade darker. */}
      <Path path="M34 70Q22 92 34 110Q42 104 42 78Z" color={palette.shade} />
      <Path path="M106 70Q118 92 106 110Q98 104 98 78Z" color={palette.shade} />
      <Group transform={rig.head} origin={PIVOT}>
        <Path path="M38 60Q40 26 70 26Q100 26 102 60Q96 74 70 74Q44 74 38 60Z" color={palette.body} />
        <Path path="M48 62Q50 40 70 42Q90 40 92 62Q86 70 70 70Q54 70 48 62Z" color={palette.light} />
        <Eyes rig={rig} palette={palette} left={52} right={72} y={44} width={16} height={22} />
        <Path path="M62 70L78 70L70 79Z" color={palette.accent} />
        <Cheeks palette={palette} y={66} spread={30} />
        <Face rig={rig} palette={palette} browY={41} mouthY={82} spread={18} mouthWidth={0} mouth={<></>} />
      </Group>
    </>
  );
}

// MARK: Fig, the fox. Pointed ears, cream muzzle, a tail with a white tip.

export function Fig({ rig, palette }: FigureProps) {
  return (
    <>
      <Shadow width={62} />
      <Path path="M92 104Q124 108 118 80Q114 66 104 72Q116 86 96 92Z" color={palette.body} />
      <Path path="M104 72Q116 86 96 92L98 100Q122 98 116 76Z" color={palette.light} opacity={0.9} />
      <Path path="M50 128Q46 90 70 86Q94 90 90 128Z" color={palette.body} />
      <Path path="M58 128Q56 100 70 98Q84 100 82 128Z" color={palette.light} />
      <Oval x={48} y={120} width={20} height={9} color={palette.shade} />
      <Oval x={72} y={120} width={20} height={9} color={palette.shade} />
      <Group transform={rig.head} origin={PIVOT}>
        <Path path="M34 48L46 20L60 44Z" color={palette.body} />
        <Path path="M106 48L94 20L80 44Z" color={palette.body} />
        <Path path="M40 46L47 30L56 44Z" color={palette.ink} opacity={0.55} />
        <Path path="M100 46L93 30L84 44Z" color={palette.ink} opacity={0.55} />
        <Path path="M30 62Q34 34 70 34Q106 34 110 62Q108 86 70 94Q32 86 30 62Z" color={palette.body} />
        <Path path="M44 76Q52 66 70 70Q88 66 96 76Q90 92 70 94Q50 92 44 76Z" color={palette.light} />
        <Eyes rig={rig} palette={palette} left={48} right={72} y={50} width={18} height={24} />
        <Path path="M64 76Q70 72 76 76Q70 82 64 76Z" color={palette.ink} />
        <Cheeks palette={palette} y={72} spread={34} />
        <Face rig={rig} palette={palette} browY={47} mouthY={84} spread={21} mouthWidth={14} />
      </Group>
    </>
  );
}

// MARK: Mochi, the cat. Round face, triangle ears, whiskers, a curled tail.

export function Mochi({ rig, palette }: FigureProps) {
  const whisker = { color: palette.ink, style: "stroke" as const, strokeWidth: 1.4, strokeCap: "round" as const, opacity: 0.55 };
  return (
    <>
      <Shadow width={60} />
      <Path path="M96 112Q126 112 122 92Q120 80 108 86Q116 96 100 100Z" color={palette.shade} />
      <Path path="M50 128Q46 92 70 88Q94 92 90 128Z" color={palette.body} />
      <Path path="M60 128Q58 104 70 102Q82 104 80 128Z" color={palette.light} />
      <Oval x={48} y={121} width={20} height={8} color={palette.shade} />
      <Oval x={72} y={121} width={20} height={8} color={palette.shade} />
      <Group transform={rig.head} origin={PIVOT}>
        <Path path="M36 56L42 24L62 42Z" color={palette.body} />
        <Path path="M104 56L98 24L78 42Z" color={palette.body} />
        <Path path="M42 52L45 34L56 44Z" color={palette.accent} opacity={0.7} />
        <Path path="M98 52L95 34L84 44Z" color={palette.accent} opacity={0.7} />
        <Path path="M32 66Q34 36 70 36Q106 36 108 66Q106 92 70 94Q34 92 32 66Z" color={palette.body} />
        <Path path="M40 46Q50 40 58 50Q48 48 40 46Z" color={palette.shade} opacity={0.5} />
        <Path path="M100 46Q90 40 82 50Q92 48 100 46Z" color={palette.shade} opacity={0.5} />
        <Eyes rig={rig} palette={palette} left={48} right={72} y={52} width={18} height={23} />
        <Path path="M66 78Q70 75 74 78Q70 82 66 78Z" color={palette.accent} />
        <Path path="M28 74L50 78M28 84L50 82" {...whisker} />
        <Path path="M112 74L90 78M112 84L90 82" {...whisker} />
        <Cheeks palette={palette} y={74} spread={34} />
        <Face
          rig={rig}
          palette={palette}
          browY={49}
          mouthY={82}
          spread={21}
          mouthWidth={12}
          mouth={
            <Path path="M63 82Q67 87 70 82Q73 87 77 82" color={palette.ink} style="stroke" strokeWidth={2.2} strokeCap="round" />
          }
        />
      </Group>
    </>
  );
}

// MARK: Bao, the bear. Round ears, a muzzle, a sage scarf.

export function Bao({ rig, palette }: FigureProps) {
  return (
    <>
      <Shadow width={66} />
      <Path path="M42 128Q36 86 70 84Q104 86 98 128Z" color={palette.body} />
      <Path path="M54 128Q52 100 70 98Q88 100 86 128Z" color={palette.light} />
      <Oval x={40} y={119} width={24} height={10} color={palette.shade} />
      <Oval x={76} y={119} width={24} height={10} color={palette.shade} />
      <Group transform={rig.head} origin={PIVOT}>
        <Circle cx={42} cy={38} r={13} color={palette.body} />
        <Circle cx={98} cy={38} r={13} color={palette.body} />
        <Circle cx={42} cy={38} r={7} color={palette.shade} />
        <Circle cx={98} cy={38} r={7} color={palette.shade} />
        <Path path="M30 66Q30 32 70 32Q110 32 110 66Q110 96 70 96Q30 96 30 66Z" color={palette.body} />
        {/* Scarf: accent band under the chin. */}
        <Path path="M40 90Q70 104 100 90Q96 100 70 102Q44 100 40 90Z" color={palette.accent} />
        <Path path="M54 86Q70 78 86 86Q84 98 70 98Q56 98 54 86Z" color={palette.light} />
        <Eyes rig={rig} palette={palette} left={48} right={72} y={52} width={18} height={22} />
        <Path path="M64 84Q70 80 76 84Q70 90 64 84Z" color={palette.ink} />
        <Cheeks palette={palette} y={74} spread={32} />
        <Face rig={rig} palette={palette} browY={49} mouthY={90} spread={21} mouthWidth={10} />
      </Group>
    </>
  );
}

// MARK: Olive, the owl. Face disc, round glasses, ear tufts, a small beak.

export function Olive({ rig, palette }: FigureProps) {
  const glass = { color: palette.accent, style: "stroke" as const, strokeWidth: 2.6 };
  return (
    <>
      <Shadow width={58} />
      <Path path="M38 128Q30 70 70 60Q110 70 102 128Z" color={palette.body} />
      <Path path="M52 126Q48 86 70 82Q92 86 88 126Z" color={palette.light} />
      <Path path="M56 92L60 100M64 92L68 100M72 92L76 100M80 92L84 100" color={palette.shade} style="stroke" strokeWidth={2} strokeCap="round" opacity={0.6} />
      <Path path="M38 84Q22 100 34 118Q42 110 44 88Z" color={palette.shade} />
      <Path path="M102 84Q118 100 106 118Q98 110 96 88Z" color={palette.shade} />
      <Oval x={50} y={122} width={18} height={8} color={palette.accent} />
      <Oval x={72} y={122} width={18} height={8} color={palette.accent} />
      <Group transform={rig.head} origin={PIVOT}>
        <Path path="M36 44L40 18L58 36Z" color={palette.body} />
        <Path path="M104 44L100 18L82 36Z" color={palette.body} />
        <Path path="M32 62Q32 30 70 30Q108 30 108 62Q108 86 70 90Q32 86 32 62Z" color={palette.body} />
        <Circle cx={54} cy={62} r={20} color={palette.light} />
        <Circle cx={86} cy={62} r={20} color={palette.light} />
        <Eyes rig={rig} palette={palette} left={44} right={76} y={52} width={20} height={20} round />
        <Circle cx={54} cy={62} r={13} {...glass} />
        <Circle cx={86} cy={62} r={13} {...glass} />
        <Path path="M67 62L73 62" {...glass} />
        <Path path="M66 72L74 72L70 80Z" color={palette.accent} />
        <Cheeks palette={palette} y={74} spread={36} />
        <Face rig={rig} palette={palette} browY={45} mouthY={84} spread={16} mouthWidth={0} mouth={<></>} />
      </Group>
    </>
  );
}

// MARK: Pip, the frog. Eyes on top, a wide grin, a pale belly, splayed feet.

export function Pip({ rig, palette }: FigureProps) {
  return (
    <>
      <Shadow width={70} />
      <Path path="M34 128Q40 118 56 120L62 128Z" color={palette.shade} />
      <Path path="M106 128Q100 118 84 120L78 128Z" color={palette.shade} />
      <Path path="M44 128Q40 92 70 90Q100 92 96 128Z" color={palette.body} />
      <Path path="M54 128Q52 104 70 102Q88 104 86 128Z" color={palette.light} />
      <Group transform={rig.head} origin={PIVOT}>
        <Circle cx={50} cy={42} r={16} color={palette.body} />
        <Circle cx={90} cy={42} r={16} color={palette.body} />
        <Path path="M28 70Q30 44 70 44Q110 44 112 70Q110 96 70 100Q30 96 28 70Z" color={palette.body} />
        <Path path="M40 78Q50 70 70 72Q90 70 100 78Q92 96 70 98Q48 96 40 78Z" color={palette.light} opacity={0.5} />
        <Eyes rig={rig} palette={palette} left={39} right={79} y={31} width={22} height={22} round />
        <Circle cx={62} cy={70} r={2} color={palette.ink} />
        <Circle cx={78} cy={70} r={2} color={palette.ink} />
        <Oval x={34} y={78} width={10} height={6} color={palette.accent} opacity={0.8} />
        <Oval x={96} y={78} width={10} height={6} color={palette.accent} opacity={0.8} />
        <Face
          rig={rig}
          palette={palette}
          browY={27}
          mouthY={84}
          spread={20}
          mouthWidth={34}
          mouth={<Path path="M48 82Q70 98 92 82" color={palette.ink} style="stroke" strokeWidth={2.8} strokeCap="round" />}
        />
      </Group>
    </>
  );
}

export const figures: Record<HelperId, (props: FigureProps) => React.JSX.Element> = {
  pebble: Pebble,
  fig: Fig,
  mochi: Mochi,
  bao: Bao,
  olive: Olive,
  pip: Pip,
};
