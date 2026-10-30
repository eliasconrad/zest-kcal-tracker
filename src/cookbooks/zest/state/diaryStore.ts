import { createStore } from "zustand/vanilla";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import { demoMeals, type Meal } from "../data/diary.ts";

export type Tombstone = { id: string; at: number };

export type Diary = {
  meals: Meal[];
  guide: number;
  /** Deleted meal ids, so a deletion reaches the account's other phones. */
  tombstones: Tombstone[];
  lastSyncAt: number;
  /** Takes in what the server sent; the newer version of a meal wins. */
  merge: (
    remote: { id: string; data: Meal; deleted: boolean; updatedAt: number }[],
    serverTime: number,
  ) => void;
  add: (meal: Meal) => void;
  edit: (id: string, fields: Pick<Meal, "name" | "kcal">) => void;
  remove: (id: string) => void;
  setGuide: (guide: number) => void;
  seedDemo: () => void;
  reset: () => void;
};

/** An isolated store with an injected storage boundary; native files live in useDiary. */
export function createDiaryStore(storage: StateStorage) {
  return createStore<Diary>()(
    persist(
      (set) => ({
        meals: [],
        guide: 2000,
        tombstones: [],
        lastSyncAt: 0,
        add: (meal) =>
          set((s) => ({
            meals: s.meals.some((m) => m.id === meal.id)
              ? s.meals
              : [...s.meals, { ...meal, updatedAt: Date.now() }],
          })),
        edit: (id, fields) =>
          set((s) => ({
            meals: s.meals.map((m) =>
              m.id === id ? { ...m, ...fields, updatedAt: Date.now() } : m,
            ),
          })),
        remove: (id) =>
          set((s) => ({
            meals: s.meals.filter((m) => m.id !== id),
            tombstones: [...s.tombstones, { id, at: Date.now() }],
          })),
        merge: (remote, serverTime) =>
          set((s) => {
            const meals = new Map(s.meals.map((m) => [m.id, m]));
            const graves = new Map(s.tombstones.map((g) => [g.id, g.at]));
            for (const item of remote) {
              const local = meals.get(item.id);
              const newest = Math.max(local?.updatedAt ?? 0, graves.get(item.id) ?? 0);
              if (item.updatedAt < newest) continue;
              if (item.deleted) {
                meals.delete(item.id);
                graves.set(item.id, item.updatedAt);
              } else {
                // A photo on this phone stays with its meal; the server has no copy.
                meals.set(item.id, {
                  ...item.data,
                  photo: local?.photo ?? item.data.photo,
                  id: item.id,
                  updatedAt: item.updatedAt,
                });
              }
            }
            return {
              meals: [...meals.values()],
              tombstones: [...graves].map(([id, at]) => ({ id, at })),
              lastSyncAt: serverTime,
            };
          }),
        setGuide: (guide) => set({ guide }),
        seedDemo: () => set({ meals: demoMeals(), guide: 2000 }),
        reset: () => set({ meals: [], guide: 2000, tombstones: [], lastSyncAt: 0 }),
      }),
      {
        name: "zest-diary",
        storage: createJSONStorage(() => storage),
        partialize: (s) => ({
          meals: s.meals,
          guide: s.guide,
          tombstones: s.tombstones,
          lastSyncAt: s.lastSyncAt,
        }),
      },
    ),
  );
}
