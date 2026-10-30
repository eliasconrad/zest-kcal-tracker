import { useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { FoodSticker } from "./Stickers";
import { Symbol, Touch } from "./ui/Touch";
import type { Dish } from "../data/recipeRules";
import { theme } from "../theme";

/** A dish inside an answer: what it is, what it costs, and logging it in one tap. */
export function DishCard({
  dish,
  order,
  reduced,
  onOpen,
  onLog,
}: {
  dish: Dish;
  order: number;
  reduced: boolean;
  onOpen?: (recipeId: string) => void;
  onLog: (dish: Dish) => void;
}) {
  const [logged, setLogged] = useState(false);
  const facts = [
    `${dish.kcal.toLocaleString()} kcal`,
    `${dish.protein} g protein`,
    dish.minutes ? `${dish.minutes} min` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.delay(order * 90).duration(280)}
      style={{ marginTop: 12 }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          padding: 12,
          borderRadius: 22,
          borderCurve: "continuous",
          backgroundColor: "#F5F4EE",
        }}
      >
        <Touch
          label={`${dish.name}, ${facts}`}
          onPress={() => dish.recipeId && onOpen?.(dish.recipeId)}
          disabled={!dish.recipeId}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}
        >
          <FoodSticker kind={dish.type} size={62} angle={-4} />
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={2}
              style={{ fontSize: 16, lineHeight: 20, fontWeight: "600", letterSpacing: -0.2, color: theme.ink }}
            >
              {dish.name}
            </Text>
            <Text style={{ fontSize: 13, lineHeight: 18, marginTop: 2, color: theme.muted }}>
              {facts}
              {dish.recipeId ? "" : " · estimated"}
            </Text>
          </View>
        </Touch>
        <Touch
          label={logged ? `${dish.name} logged` : `Log ${dish.name}`}
          disabled={logged}
          expand
          onPress={() => {
            setLogged(true);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onLog(dish);
          }}
        >
          <View
            style={{
              height: 36,
              minWidth: 56,
              paddingHorizontal: 13,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: logged ? "transparent" : theme.heavy,
            }}
          >
            {logged ? (
              <Symbol name="checkmark" size={15} weight="bold" color={theme.accent} />
            ) : (
              <Text style={{ fontSize: 14, fontWeight: "600", color: theme.onHeavy }}>Log</Text>
            )}
          </View>
        </Touch>
      </View>
    </Animated.View>
  );
}
