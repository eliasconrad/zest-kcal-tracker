/**
 * Accounts buy sync. The device stays the primary copy, so everything here is
 * quiet and best effort: being offline must never get in the way of logging.
 */
import { useDiary } from "../state/useDiary";
import { useProfile } from "../state/useProfile";
import { session } from "../state/useSession";
import { dayKey, loggedDays, relativeDay, totalOn, type Meal } from "./diary";
import { streak } from "./nutrition";

/** A photo is a path on this phone; it does not travel. */
const portable = (meal: Meal): Meal => ({
  ...meal,
  photo: meal.photo?.sample ? meal.photo : undefined,
});

export async function syncDiary() {
  if (!session.hasAccount()) return;
  const diary = useDiary.getState();
  const since = diary.lastSyncAt;
  const meals = [
    ...diary.meals
      .filter((meal) => (meal.updatedAt ?? 0) > since)
      .map((meal) => ({ id: meal.id, updatedAt: meal.updatedAt ?? Date.now(), data: portable(meal) })),
    ...diary.tombstones
      .filter((grave) => grave.at > since)
      .map((grave) => ({ id: grave.id, updatedAt: grave.at, deleted: true })),
  ];
  const result = await session.post<{
    meals: { id: string; data: Meal; deleted: boolean; updatedAt: number }[];
    serverTime: number;
  }>("/v1/sync/meals", { meals, since });
  useDiary.getState().merge(result.meals, result.serverTime);
}

/** What friends may see: the streak, and that today has a meal. */
export async function reportDay() {
  if (!session.hasAccount()) return;
  const { meals } = useDiary.getState();
  const today = dayKey();
  if (!meals.some((meal) => meal.date === today)) return;
  await session.post("/v1/me/day", {
    day: today,
    streak: streak(loggedDays(meals), today, relativeDay(-1)),
    total: totalOn(meals, today),
  });
}

export async function pushProfile() {
  if (!session.hasAccount()) return;
  const { save: _s, logWeight: _l, finishOnboarding: _f, reset: _r, ...profile } = useProfile.getState();
  await session.update({ profile, name: profile.name });
}

/** After a login on a new phone: bring the account's profile and diary here. */
export async function restoreAccount(remote: Record<string, unknown> | null) {
  if (remote) useProfile.getState().save({ ...remote, onboarded: true });
  await syncDiary();
}
