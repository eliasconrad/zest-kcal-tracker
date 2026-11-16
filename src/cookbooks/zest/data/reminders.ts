import * as Notifications from "expo-notifications";
import { reminderTime, type MealType } from "./diary";

const body: Record<MealType, string> = {
  Breakfast: "Breakfast? Show me the plate.",
  Lunch: "Lunch? Show me the plate.",
  Snack: "A snack? It counts too.",
  Dinner: "Dinner? Show me the plate.",
};

/** The system ask. True when reminders may be scheduled. */
export async function askForReminders() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Replaces every scheduled reminder with one daily local notification per meal. */
export async function syncReminders(meals: MealType[]) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!meals.length) return;
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;
  await Promise.all(
    meals.map((meal) => {
      const [hour, minute] = reminderTime[meal];
      return Notifications.scheduleNotificationAsync({
        content: { title: "Zest", body: body[meal] },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });
    }),
  );
}
