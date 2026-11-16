import { createStore } from "zustand/vanilla";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import {
  plan,
  type Activity,
  type Allergen,
  type Blocker,
  type Diet,
  type Goal,
  type MealClock,
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
  /** ISO `YYYY-MM-DD`. Age uses this when it is set; birthYear stays for older saves. */
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
  allergies: Allergen[];
  /** Free text when "other" is chosen; empty otherwise. */
  allergyNote: string;
  mealsPerDay: number;
  mealTimes: MealClock;
  blockers: Blocker[];
  /** True after the person asks for a reminder. Skipping leaves this false. */
  reminders: boolean;
  /** When set, replaces the computed daily guide. */
  manualGuide?: number;
  weights: WeightEntry[];
  /** The last day the streak celebration was shown, so it plays once a day. */
  celebratedDay?: string;
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
  birthDate: `${new Date().getFullYear() - 30}-01-01`,
  heightCm: 170,
  weightKg: 70,
  targetWeightKg: 70,
  goal: "maintain",
  activity: "light",
  pace: "steady",
  units: "metric",
  diet: "omnivore",
  allergies: [],
  allergyNote: "",
  mealsPerDay: 3,
  mealTimes: { breakfast: "08:00", lunch: "13:00", dinner: "19:30" },
  blockers: [],
  reminders: false,
  weights: [],
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
    profile.diet ?? "omnivore",
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
