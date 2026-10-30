/**
 * The six helpers. Pure data and pure functions: no React, no network, so
 * tests run in Node and the Worker can mirror the voices by id alone.
 *
 * Each helper owns a palette (its drawing reads it), a voice (what it says in
 * the app without a model) and a persona line (what the model is told when a
 * reply streams from the Worker). The pick lives in the profile store.
 */
import type { MealType } from "./diary.ts";

export const helperIds = ["zest", "pebble", "fig", "mochi", "bao", "olive", "pip"] as const;
export type HelperId = (typeof helperIds)[number];

export type HelperPalette = {
  /** Main fur, feather or skin. */
  body: string;
  /** Darker shade for the far side, ears, markings. */
  shade: string;
  /** Belly, muzzle, face disc. */
  light: string;
  /** Line work, pupils, beak outline. */
  ink: string;
  /** One signature colour: beak, scarf, glasses, cheek. Also the analysing glow. */
  accent: string;
  cheek: string;
};

/** -1 well under the guide so far, 0 within it, 1 over it (see diary.intakeMood). */
export type IntakeMood = -1 | 0 | 1;

export type Helper = {
  id: HelperId;
  name: string;
  species: string;
  /** Two or three words, shown under the name when picking. */
  role: string;
  /** One lowercase line on who it is, shown under the name in the swap mode. */
  tagline: string;
  /** One sentence in the helper’s own voice, shown on its card. */
  pitch: string;
  palette: HelperPalette;
  /** The line beside the composer while a photo is being analysed. */
  thinking: string;
  /** The tag shown once setup is done; the lemon used to say "Let’s eat." */
  tag: string;
  /** What it says right after being picked, before the first question. */
  hello: (firstName: string) => string;
  /** The bubble over the setup sheet, by step; falls back to the lemon’s lines. */
  lines: Partial<Record<string, string>>;
  /** Reactions to a logged meal; picked by mood, then by meal type when given. */
  reactions: Record<IntakeMood, string[]> & { byType?: Partial<Record<MealType, string>> };
  /** How the model should sound; one or two sentences, no numbers. */
  persona: string;
};

export const helpers: Record<HelperId, Helper> = {
  zest: {
    id: "zest",
    name: "Zest",
    species: "lemon",
    role: "The original",
    tagline: "the original",
    pitch: "Show me the plate. I’ll do the sums.",
    palette: {
      body: "#F3CE48",
      shade: "#E6B838",
      light: "#FFE389",
      ink: "#35412E",
      accent: "#7D945F",
      cheek: "#D89A3B",
    },
    thinking: "Hmm, something tasty.",
    tag: "Let’s eat.",
    hello: (firstName) => (firstName ? `Nice to meet you, ${firstName}!` : "Hi! I’m Zest."),
    // No lines of its own: the sheet's original copy is the lemon's voice.
    lines: {},
    reactions: {
      [-1]: ["Noted. Plenty of room left.", "Good start."],
      [0]: ["Nicely done.", "That one’s in."],
      [1]: ["In the diary. Tomorrow’s a new page.", "Logged. No drama."],
    },
    persona: "You are Zest, a calm and friendly lemon.",
  },
  pebble: {
    id: "pebble",
    name: "Pebble",
    species: "penguin",
    role: "Calm coach",
    tagline: "the calm coach",
    pitch: "One meal at a time. We’ve got all day.",
    palette: {
      body: "#2E333B",
      shade: "#1F2329",
      light: "#F4F1EA",
      ink: "#1A1C20",
      accent: "#F0A23B",
      cheek: "#F2B8A2",
    },
    thinking: "Let me have a proper look.",
    tag: "Steady as we go.",
    hello: (name) => (name ? `Hi ${name}. I’m Pebble. No rush.` : "Hi. I’m Pebble. No rush."),
    lines: {
      name: "Hi. I’m Pebble.",
      goal: "Good. We’ll get there together.",
      body: "Just the basics. I don’t judge.",
      plan: "Here’s your guide. Breathe.",
    },
    reactions: {
      [-1]: ["Logged. Plenty of room left today.", "Good start. Keep going at your pace."],
      [0]: ["Nicely on track.", "That fits. Well done.", "Steady. That’s the whole trick."],
      [1]: ["Over today. Tomorrow is a fresh page.", "It happens. Water, a walk, and on we go."],
      byType: { Breakfast: "A calm start to the day." },
    },
    persona:
      "You are Pebble, a calm penguin coach. Speak slowly and kindly, short sentences, never alarmed, never gushing. You reassure and keep perspective.",
  },
  fig: {
    id: "fig",
    name: "Fig",
    species: "fox",
    role: "Strict",
    tagline: "the strict one",
    pitch: "I’ll tell you the truth. You’ll thank me later.",
    palette: {
      body: "#D9742B",
      shade: "#B5521C",
      light: "#F8E7D0",
      ink: "#3B2A1E",
      accent: "#B5451B",
      cheek: "#EFA27B",
    },
    thinking: "Hold still. I’m weighing this.",
    tag: "Discipline. Let’s go.",
    hello: (name) => (name ? `${name}. I’m Fig. I keep count.` : "I’m Fig. I keep count."),
    lines: {
      name: "I’m Fig. Precise answers, please.",
      goal: "Pick one and mean it.",
      body: "Numbers only. No stories.",
      plan: "This is the line. Stay on it.",
    },
    reactions: {
      [-1]: ["Logged. Don’t skip the next one.", "Fine. Under the line so far."],
      [0]: ["Acceptable. On the line.", "Good. Exactly what I expect.", "Logged. Stay like this."],
      [1]: ["Over. I noticed. So did you.", "That’s above the guide. Lighter dinner."],
      byType: { Snack: "A snack. Was it planned?" },
    },
    persona:
      "You are Fig, a strict fox. Be direct and brisk, no softening, no exclamation marks. You hold the person to their own guide and say so plainly, without cruelty.",
  },
  mochi: {
    id: "mochi",
    name: "Mochi",
    species: "cat",
    role: "Sassy",
    tagline: "the sassy one",
    pitch: "I count your calories. I also have opinions.",
    palette: {
      body: "#F2E9DC",
      shade: "#C8A27A",
      light: "#FFFBF4",
      ink: "#3A3532",
      accent: "#E88FA1",
      cheek: "#F5B8C1",
    },
    thinking: "Hmm. Interesting choices.",
    tag: "Finally. Feed me data.",
    hello: (name) => (name ? `${name}, hm? I’m Mochi. Impress me.` : "I’m Mochi. Impress me."),
    lines: {
      name: "I’m Mochi. Names first.",
      goal: "Bold. I like bold.",
      body: "I won’t tell anyone. Probably.",
      plan: "Your guide. Try to keep up.",
    },
    reactions: {
      [-1]: ["Logged. That’s it? Cute.", "Barely a bite. Noted."],
      [0]: ["Not bad. Not bad at all.", "On track. Don’t let it go to your head.", "Logged. I’m mildly impressed."],
      [1]: ["Over. Bold move.", "Well. That was a lot. Respect, sort of."],
      byType: { Dinner: "Dinner at last. I was starting to worry." },
    },
    persona:
      "You are Mochi, a sassy cat. Dry, witty, a little smug, warm underneath. One playful jab per reply at most, never about the person’s body, then the useful part.",
  },
  bao: {
    id: "bao",
    name: "Bao",
    species: "bear",
    role: "Chill",
    tagline: "the easygoing one",
    pitch: "Eat, log, nap. In any order.",
    palette: {
      body: "#8C6A4F",
      shade: "#6B4D36",
      light: "#E9D5BE",
      ink: "#3E2C21",
      accent: "#7FA37C",
      cheek: "#D9A08A",
    },
    thinking: "Oh nice. Gimme a sec.",
    tag: "All good. Let’s eat.",
    hello: (name) => (name ? `Hey ${name}. I’m Bao. Easy does it.` : "Hey. I’m Bao. Easy does it."),
    lines: {
      name: "Hey. I’m Bao.",
      goal: "Cool. Any of these works.",
      body: "No stress. Rough numbers are fine.",
      plan: "Here’s the plan. Pretty doable.",
    },
    reactions: {
      [-1]: ["Logged. Lots of room, no hurry.", "Light so far. All good."],
      [0]: ["Nice. Right in the zone.", "Logged. Chill.", "That works. Carry on."],
      [1]: ["Bit over. Happens. We’re fine.", "Over the guide. Nap it off, log the next."],
      byType: { Lunch: "Lunch. The best meal, honestly." },
    },
    persona:
      "You are Bao, a chill bear. Relaxed, friendly, low-key, like a good friend on a sofa. Short easy sentences, no pressure, no exclamation marks.",
  },
  olive: {
    id: "olive",
    name: "Olive",
    species: "owl",
    role: "Macro nerd",
    tagline: "the macro nerd",
    pitch: "Protein, carbs, fat. Let’s talk grams.",
    palette: {
      body: "#6F7A4A",
      shade: "#515A34",
      light: "#E9E4C9",
      ink: "#33351F",
      accent: "#D9A441",
      cheek: "#D9B79A",
    },
    thinking: "Estimating grams per component.",
    tag: "Data acquired.",
    hello: (name) => (name ? `${name}. Olive here. I love a spreadsheet.` : "Olive here. I love a spreadsheet."),
    lines: {
      name: "I’m Olive. Let’s get precise.",
      goal: "Each goal has its own macro split.",
      body: "These drive the resting energy estimate.",
      plan: "Here’s your guide, with the split.",
    },
    reactions: {
      [-1]: ["Logged. Protein target still open.", "Under so far. Room for a protein-heavy meal."],
      [0]: ["Logged. Macros look balanced.", "On target. Good ratio.", "That fits the split nicely."],
      [1]: ["Over the guide. Check the fat column.", "Above target. Tomorrow: more fibre, same protein."],
      byType: { Breakfast: "Breakfast logged. Protein first is a good habit." },
    },
    persona:
      "You are Olive, an owl who loves macros. Precise, curious, a bit nerdy; you mention protein, carbs and fat when it helps, in plain words. Friendly, never preachy.",
  },
  pip: {
    id: "pip",
    name: "Pip",
    species: "frog",
    role: "Hype",
    tagline: "the hype one",
    pitch: "You logged a meal? LEGEND.",
    palette: {
      body: "#5FBF5A",
      shade: "#3E9440",
      light: "#D9F0B8",
      ink: "#244B23",
      accent: "#FFD43B",
      cheek: "#F7B7A0",
    },
    thinking: "Ooh ooh ooh, what is it?!",
    tag: "LET'S GO!",
    hello: (name) => (name ? `${name.toUpperCase()}! I’m Pip! This is gonna be great!` : "I’m Pip! This is gonna be great!"),
    lines: {
      name: "I’m Pip! Who are you?!",
      goal: "Yes! Any of these! Pick!",
      body: "Quick quick, then the fun part!",
      plan: "YOUR GUIDE! Look at it!",
    },
    reactions: {
      [-1]: ["Logged! Warm-up meal! More later!", "Nice one! Plenty of room, let’s go!"],
      [0]: ["ON TRACK! You’re doing it!", "Logged! That’s the stuff!", "Perfect! High five!"],
      [1]: ["Over! Still a legend! Reset tomorrow!", "Big meal! Big energy! We go again!"],
      byType: { Snack: "Snack logged! Snacks count! Yes!" },
    },
    persona:
      "You are Pip, a hype frog. Enthusiastic, upbeat, playful, lots of energy, short bursts; one exclamation mark per sentence is plenty. Celebrate effort, never shame.",
  },
};

export const helperList: Helper[] = helperIds.map((id) => helpers[id]);

/** The six animals of the swap mode, in its order; the lemon stays the default and lives in the profile. */
export const swapHelpers: Helper[] = helperIds
  .filter((id) => id !== "zest")
  .map((id) => helpers[id]);
export const defaultHelper: HelperId = "zest";

export function isHelperId(value: unknown): value is HelperId {
  return typeof value === "string" && (helperIds as readonly string[]).includes(value);
}

/** The helper for an id, or the default for anything unknown or old. */
export function helperFor(id: unknown): Helper {
  return helpers[isHelperId(id) ? id : defaultHelper];
}

/** A deterministic pick so the same meal shows the same line on re-render. */
function pick<T>(list: T[], seed: number): T {
  return list[Math.abs(Math.floor(seed)) % list.length];
}

/**
 * What the helper says right after a meal is saved. `seed` keeps the choice
 * stable per meal; by-type lines win every third time so they do not drown
 * out the mood lines.
 */
export function helperReaction(
  helper: Helper,
  mood: IntakeMood,
  type?: MealType,
  seed = 0,
): string {
  const typed = type ? helper.reactions.byType?.[type] : undefined;
  if (typed && Math.abs(Math.floor(seed)) % 3 === 0) return typed;
  return pick(helper.reactions[mood], seed);
}

/** The bubble line over the setup sheet for a step, in the helper’s voice when it has one. */
export function helperLine(helper: Helper, step: string, fallback: string) {
  return helper.lines[step] ?? fallback;
}
