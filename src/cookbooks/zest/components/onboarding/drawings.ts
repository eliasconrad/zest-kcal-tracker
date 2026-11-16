import { Skia, type SkPath } from "@shopify/react-native-skia";

/**
 * Zest's own small drawings for the setup: flat shapes in a 64-point box, in the
 * mascot's colours. One set serves the option rows, the chips and the props
 * beside the mascot, so everything reads as drawn by one hand.
 */
const c = {
  gold: "#EDBE3C",
  goldD: "#C9962A",
  olive: "#7D945F",
  oliveD: "#566B3F",
  leaf: "#9DB87A",
  tomato: "#DB5B3C",
  tomatoD: "#B4432A",
  cream: "#F4E5C2",
  ink: "#35412E",
  teal: "#5FA89E",
  tealD: "#3F8278",
  orange: "#EF9B3D",
  tan: "#D9A866",
  brown: "#96663F",
  brownD: "#6F4A2C",
  grey: "#C9C8BF",
  white: "#FFFFFF",
};

const o = (x: number, y: number, r: number) => e(x, y, r, r);
function e(x: number, y: number, rx: number, ry: number) {
  return `M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
}
const q = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;

const drawings = {
  scale: [
    [q(10, 14, 44, 40, 12), c.cream],
    [o(32, 32, 13), c.white],
    ["M31 33L38 23l2.4 1.6L33 34.6Z", c.tomato],
    [q(20, 46, 24, 3, 1.5), c.goldD],
  ],
  balance: [
    [q(30, 16, 4, 32, 2), c.oliveD],
    [q(18, 48, 28, 5, 2.5), c.oliveD],
    [q(10, 18, 44, 4, 2), c.olive],
    ["M8 30h16a8 8 0 0 1-16 0Z", c.gold],
    ["M40 30h16a8 8 0 0 1-16 0Z", c.gold],
    [o(32, 18, 4), c.tomato],
  ],
  plateUp: [
    [o(32, 40, 20), c.cream],
    [o(32, 40, 12), c.white],
    ["M32 4l12 13h-8v12h-8V17h-8Z", c.olive],
  ],
  dumbbell: [
    [q(20, 28, 24, 8, 2), c.ink],
    [q(12, 18, 10, 28, 4), c.tomato],
    [q(42, 18, 10, 28, 4), c.tomato],
    [q(5, 24, 7, 16, 3), c.tomatoD],
    [q(52, 24, 7, 16, 3), c.tomatoD],
  ],
  sofa: [
    [q(10, 20, 44, 24, 8), c.teal],
    [q(6, 30, 12, 20, 5), c.tealD],
    [q(46, 30, 12, 20, 5), c.tealD],
    [q(16, 34, 32, 10, 3), c.cream],
    [q(13, 50, 5, 6, 2), c.brownD],
    [q(46, 50, 5, 6, 2), c.brownD],
  ],
  sneaker: [
    ["M8 40c0-8 2-18 8-20l6 6c4 3 8 4 14 6 8 2 20 3 20 12v2H8Z", c.orange],
    [q(6, 42, 52, 9, 4), c.cream],
    ["M24 28l5-3 2 3-5 3Z", c.white],
    ["M30 32l5-3 2 3-5 3Z", c.white],
  ],
  flame: [
    ["M32 6c2 10 16 16 16 32a16 16 0 0 1-32 0c0-8 4-12 6-16 2 5 5 6 6 4 2-6 2-12 4-20Z", c.tomato],
    ["M32 30c2 5 8 7 8 14a8 8 0 0 1-16 0c0-6 5-8 8-14Z", c.gold],
  ],
  leaf: [
    ["M54 8C28 8 12 20 12 40c0 4 1 8 3 11 3-13 12-23 25-28-10 7-18 16-21 31 3 1 6 2 9 2 20 0 26-26 26-48Z", c.olive],
  ],
  bolt: [["M36 4L14 36h14l-4 24 26-36H34Z", c.gold]],
  utensils: [
    ["M18 8v16c0 4 3 6 5 7v25h5V31c2-1 5-3 5-7V8h-4v14h-2V8h-4v14h-1V8Z", c.ink],
    ["M44 8c5 3 7 12 7 20l-5 3v25h-5V8Z", c.oliveD],
  ],
  carrot: [
    ["M40 20L14 54c-2 2-5 0-4-3L24 16c3-4 12-2 16 4Z", c.orange],
    ["M36 15c0-6 4-11 10-11 0 6-2 11-10 11Z", c.olive],
    ["M39 19c6-2 12 0 16 6-6 2-12 0-16-6Z", c.leaf],
  ],
  fish: [
    [e(28, 32, 20, 13), c.teal],
    ["M44 32l15-12v24Z", c.tealD],
    [o(18, 29, 3), c.white],
    [o(18, 29, 1.4), c.ink],
  ],
  moon: [
    ["M40 8a24 24 0 1 0 14 40A20 20 0 1 1 40 8Z", c.gold],
    ["M46 20l2.5 6 6.5.5-5 4 1.6 6.5L46 33l-5.5 3.5 1.5-6.5-5-4 6.5-.5Z", c.goldD],
  ],
  star: [
    ["M32 6l20 33H12Z", c.teal],
    ["M32 58L12 25h40Z", c.tealD],
  ],
  nut: [
    [q(30, 5, 4, 9, 2), c.brownD],
    ["M16 26h32c0 14-8 26-16 30-8-4-16-16-16-30Z", c.brown],
    ["M13 27c0-10 8-15 19-15s19 5 19 15Z", c.brownD],
  ],
  peanut: [
    [o(25, 22, 14), c.tan],
    [o(39, 42, 16), c.tan],
    ["M16 32L32 54 50 32 34 12Z", c.tan],
    [o(22, 20, 2), c.brown],
    [o(30, 27, 2), c.brown],
    [o(36, 40, 2), c.brown],
    [o(44, 46, 2), c.brown],
  ],
  wheat: [
    [q(30, 18, 4, 42, 2), c.goldD],
    ["M32 4c4 4 4 10 0 14-4-4-4-10 0-14Z", c.gold],
    ["M30 24c-6-2-10-6-10-12 6 0 10 6 10 12Z", c.gold],
    ["M34 24c0-6 4-12 10-12 0 6-4 10-10 12Z", c.gold],
    ["M30 38c-6-2-10-6-10-12 6 0 10 6 10 12Z", c.gold],
    ["M34 38c0-6 4-12 10-12 0 6-4 10-10 12Z", c.gold],
  ],
  milk: [
    ["M18 22l7-13h14l7 13v32a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4Z", c.cream],
    [q(18, 32, 28, 14, 0), c.teal],
    [q(25, 4, 14, 6, 2), c.tealD],
  ],
  egg: [
    ["M32 6c10 0 20 18 20 32a20 20 0 0 1-40 0C12 24 22 6 32 6Z", c.cream],
    [o(32, 40, 9), c.gold],
  ],
  soy: [
    ["M8 44C12 22 34 10 56 14 56 36 36 56 12 52c-3-1-5-4-4-8Z", c.leaf],
    [o(23, 39, 6), c.olive],
    [o(33, 30, 6), c.olive],
    [o(44, 22, 5), c.olive],
  ],
  shrimp: [
    ["M50 12C30 6 10 20 10 38c0 11 9 20 20 20 4 0 8-2 8-6s-3-6-7-6c-6 0-9-3-9-8 0-10 12-16 28-14 3-3 3-10 0-12Z", c.tomato],
    [o(46, 18, 2.4), c.ink],
  ],
  sesame: [
    [e(20, 20, 6, 9), c.goldD],
    [e(43, 16, 6, 9), c.gold],
    [e(32, 36, 6, 9), c.goldD],
    [e(15, 46, 6, 9), c.gold],
    [e(49, 42, 6, 9), c.goldD],
  ],
  stopwatch: [
    [q(27, 5, 10, 7, 2), c.tealD],
    [o(32, 36, 22), c.teal],
    [o(32, 36, 16), c.cream],
    [q(30.5, 24, 3, 13, 1.5), c.tomato],
  ],
  cloche: [
    [o(32, 18, 4), c.goldD],
    ["M10 44a22 22 0 0 1 44 0Z", c.gold],
    [q(6, 46, 52, 6, 3), c.brownD],
  ],
  cookie: [
    [o(32, 32, 24), c.tan],
    [o(24, 24, 4), c.brownD],
    [o(40, 22, 3.5), c.brownD],
    [o(43, 38, 4), c.brownD],
    [o(26, 43, 4), c.brownD],
    [o(33, 33, 3), c.brownD],
  ],
  battery: [
    [q(8, 20, 42, 26, 7), c.ink],
    [q(12, 24, 34, 18, 4), c.white],
    [q(15, 27, 9, 12, 2), c.tomato],
    [q(52, 27, 5, 12, 2), c.ink],
  ],
  question: [
    ["M12 10h40a6 6 0 0 1 6 6v24a6 6 0 0 1-6 6H30L18 56V46h-6a6 6 0 0 1-6-6V16a6 6 0 0 1 6-6Z", c.olive],
    ["M25 22c1-4 4-6 7-6 4 0 7 3 7 6 0 6-6 5-6 11h-5c0-8 6-7 6-11 0-1-1-2-2-2s-2 1-3 3Z", c.white],
    [o(30.5, 38, 3), c.white],
  ],
  calculator: [
    [q(14, 6, 36, 52, 7), c.teal],
    [q(20, 12, 24, 12, 2), c.cream],
    [q(20, 30, 6, 6, 1.5), c.white],
    [q(29, 30, 6, 6, 1.5), c.white],
    [q(38, 30, 6, 6, 1.5), c.white],
    [q(20, 40, 6, 6, 1.5), c.white],
    [q(29, 40, 6, 6, 1.5), c.white],
    [q(38, 40, 6, 6, 1.5), c.tomato],
  ],
  door: [
    [q(16, 6, 32, 54, 3), c.brownD],
    [q(20, 10, 24, 50, 2), c.teal],
    [q(25, 18, 14, 7, 1.5), c.cream],
    [o(38, 38, 2.4), c.gold],
  ],
  ruler: [
    [q(24, 4, 16, 56, 2), c.gold],
    [q(24, 11, 8, 2, 0), c.goldD],
    [q(24, 19, 5, 2, 0), c.goldD],
    [q(24, 27, 8, 2, 0), c.goldD],
    [q(24, 35, 5, 2, 0), c.goldD],
    [q(24, 43, 8, 2, 0), c.goldD],
    [q(24, 51, 5, 2, 0), c.goldD],
  ],
  hill: [
    ["M2 60c10-20 20-28 30-28s20 8 30 28Z", c.leaf],
    [q(31, 8, 3, 28, 1.5), c.ink],
    ["M34 8l17 7-17 8Z", c.tomato],
  ],
  bell: [
    [o(32, 7, 3), c.goldD],
    [o(32, 51, 6), c.goldD],
    ["M32 8c-10 0-16 8-16 18v12l-6 8h44l-6-8V26c0-10-6-18-16-18Z", c.gold],
  ],
  key: [
    ["M26 30L50 54l6-6-4-4 4-4-6-6-4 4-16-16Z", c.goldD],
    [o(18, 22, 14), c.gold],
    [o(18, 22, 5), c.white],
  ],
  phone: [
    [q(18, 4, 28, 56, 7), c.ink],
    [q(21, 9, 22, 44, 3), c.cream],
    [o(32, 31, 7), c.tomato],
  ],
  clipboard: [
    [q(12, 10, 40, 48, 6), c.brown],
    [q(17, 16, 30, 38, 3), c.white],
    [q(24, 6, 16, 10, 3), c.goldD],
    [q(22, 26, 20, 3, 1.5), c.grey],
    [q(22, 34, 20, 3, 1.5), c.grey],
    [q(22, 42, 13, 3, 1.5), c.grey],
  ],
  plate: [
    [o(32, 34, 24), c.cream],
    [o(32, 34, 16), c.white],
    [e(32, 34, 10, 8), c.tomato],
    [e(28, 31, 3, 2), c.gold],
  ],
} satisfies Record<string, readonly (readonly [string, string])[]>;

export type ArtId = keyof typeof drawings;

export const artShapes = Object.fromEntries(
  Object.entries(drawings).map(([id, shapes]) => [
    id,
    shapes.map(([d, color]) => ({ path: Skia.Path.MakeFromSVGString(d) as SkPath, color })),
  ]),
) as Record<ArtId, { path: SkPath; color: string }[]>;

/** The colour the little sparks around a chosen row take. */
export const artAccent = (id: ArtId) => artShapes[id][0].color;
