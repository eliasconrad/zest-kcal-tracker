import { createStore } from "zustand/vanilla";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import type { MealType } from "../data/diary.ts";
import { defaultHelper, type HelperId } from "../data/helpers.ts";
import {
  plan,
  type Activity,
  type Diet,
  type Goal,
  type Obstacle,
  type Pace,
  type Plan,
  type Sex,
  type Units,
} from "../data/nutrition.ts";

export type WeightEntry = { date: string; kg: number };

export type Profile = {
  onboarded: boolean;
  name: string;
  /** Account e-mail; the password lives in the keychain (state/secrets.ts), never here. */
  email: string;
  sex: Sex;
  birthYear: number;
  /** ISO date; empty until the onboarding asks. `birthYear` follows it. */
  birthDate: string;
  heightCm: number;
  weightKg: number;
  /** Only meaningful for lose/gain; equals weightKg otherwise. */
  targetWeightKg: number;
  goal: Goal;
  activity: Activity;
  pace: Pace;
  units: Units;
  diet: Diet;
  /** Picked from `allergens`; kept off anything the model suggests. */
  allergies: string[];
  /** Anything the list misses, in the person's own words. */
  allergyNote: string;
  /** The meals this person usually eats; the camera's default stays inside them. */
  usualMeals: MealType[];
  /** What got in the way before. Only ever changes the lemon's lines. */
  pastObstacles: Obstacle[];
  /** Meals with a daily local reminder. */
  reminders: MealType[];
  /** Recipe ids, from the recipes sheet. */
  favouriteRecipes: string[];
  /** When set, replaces the computed daily guide. */
  manualGuide?: number;
  weights: WeightEntry[];
  /** The last day the streak celebration was shown, so it plays once a day. */
  celebratedDay?: string;
  /** Which of the six helpers sits on the composer; picked in setup, swapped by holding it. */
  helper: HelperId;
};

export type ProfileState = Profile & {
  save: (fields: Partial<Profile>) => void;
  logWeight: (entry: WeightEntry) => void;
  finishOnboarding: () => void;
  reset: () => void;
};

export const defaultProfile: Profile = {
  onboarded: false,
  name: "",
  email: "",
  sex: "unspecified",
  birthYear: new Date().getFullYear() - 30,
  birthDate: "",
  heightCm: 170,
  weightKg: 70,
  targetWeightKg: 70,
  goal: "maintain",
  activity: "light",
  pace: "steady",
  units: "metric",
  diet: "none",
  allergies: [],
  allergyNote: "",
  usualMeals: ["Breakfast", "Lunch", "Dinner"],
  pastObstacles: [],
  reminders: [],
  favouriteRecipes: [],
  weights: [],
  helper: defaultHelper,
};

/** The plan for a profile; the manual guide overrides only the calorie line. */
export function profilePlan(profile: Profile, now = new Date()): Plan {
  const computed = plan(
    {
      sex: profile.sex,
      birthYear: profile.birthYear,
      birthDate: profile.birthDate,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
    },
    profile.goal,
    profile.activity,
    profile.pace,
    now,
    profile.diet,
  );
  if (!profile.manualGuide) return computed;
  const guide = profile.manualGuide;
  const protein = Math.round(Math.min(computed.protein, (guide * 0.4) / 4));
  const fat = Math.round((guide * 0.28) / 9);
  const carbs = Math.max(0, Math.round((guide - protein * 4 - fat * 9) / 4));
  return { ...computed, guide, protein, carbs, fat, floored: false };
}

/** Isolated store with an injected storage boundary, mirroring the diary. */
export function createProfileStore(storage: StateStorage) {
  return createStore<ProfileState>()(
    persist(
      (set) => ({
        ...defaultProfile,
        save: (fields) => set((s) => ({ ...s, ...fields })),
        logWeight: (entry) =>
          set((s) => ({
            weightKg: entry.kg,
            weights: [...s.weights.filter((w) => w.date !== entry.date), entry].sort((a, b) =>
              a.date.localeCompare(b.date),
            ),
          })),
        finishOnboarding: () => set({ onboarded: true }),
        reset: () => set({ ...defaultProfile, weights: [] }),
      }),
      {
        name: "zest-profile",
        storage: createJSONStorage(() => storage),
        partialize: ({ save, logWeight, finishOnboarding, reset, ...profile }) => profile,
      },
    ),
  );
}
