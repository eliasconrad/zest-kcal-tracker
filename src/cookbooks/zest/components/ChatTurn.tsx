import { Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { Thinking } from "./Thinking";
import { VisualAnswer } from "./VisualAnswer";
import { MealReply, REPLY_EASE } from "./MealReply";
import { MealImage } from "../data/photos";
import { Symbol, Touch } from "./ui/Touch";
import { totalOn, type Meal, type MealType } from "../data/diary";
import type { Turn } from "../data/conversation";
import { theme } from "../theme";

export function ChatTurn({
  turn,
  meals,
  guide,
  reduced,
  onChoose,
  onEdit,
  onCalendar,
  onAsk,
  onRetry,
  onManual,
}: {
  turn: Turn;
  meals: Meal[];
  guide: number;
  reduced: boolean;
  onChoose: (turn: Turn, type: MealType) => void;
  onEdit: (meal: Meal) => void;
  onCalendar: () => void;
  /** Sends a tapped follow-up question as if typed. */
  onAsk?: (question: string) => void;
  /** A failed estimate: send the same photo again. */
  onRetry?: (turn: Turn) => void;
  /** A failed estimate: type the name and number instead. */
  onManual?: (turn: Turn) => void;
}) {
  const streaming = turn.state === "thinking" && !!turn.text;
  return (
    <Animated.View
      key={
        turn.kind === "text" ? `${turn.id}-${turn.state ?? "sent"}` : turn.id
      }
      entering={
        turn.kind === "text" && !reduced
          ? FadeIn.delay(320).duration(140)
          : undefined
      }
      layout={
        (turn.kind === "question" || turn.kind === "meal") && !reduced
          ? LinearTransition.duration(280).easing(REPLY_EASE)
          : undefined
      }
      style={[
        { marginBottom: turn.role === "user" ? 20 : 24 },
        turn.role === "assistant" && {
          width:
            turn.state === "thinking" && turn.kind !== "meal" && !streaming
              ? 72
              : "92%",
          alignSelf: "flex-start",
          backgroundColor: "#FEFEFC",
          borderRadius: 28,
          borderCurve: "continuous",
          paddingHorizontal: 20,
          paddingVertical: 19,
          boxShadow: "0 3px 18px rgba(32, 35, 25, 0.035)",
        },
      ]}
    >
      {turn.kind === "photo" ? (
        <View
          style={{
            alignSelf: "flex-end",
            borderRadius: 22,
            padding: 5,
            transform: [{ rotate: "3deg" }],
            backgroundColor: "#FFFEF9",
            boxShadow: "0 4px 12px rgba(30, 34, 22, 0.09)",
          }}
        >
          <MealImage
            accessibilityLabel="Meal photo"
            photo={turn.photo}
            style={{ width: 168, height: 224, borderRadius: 17 }}
            contentFit="cover"
            transition={180}
          />
        </View>
      ) : turn.role === "user" ? (
        <View
          style={{
            alignSelf: "flex-end",
            backgroundColor: theme.heavy,
            paddingHorizontal: 17,
            paddingVertical: 12,
            borderRadius: 24,
            maxWidth: "90%",
          }}
        >
          <Text
            selectable
            style={{ fontSize: 17, lineHeight: 24, color: "white" }}
          >
            {turn.text}
          </Text>
        </View>
      ) : turn.kind === "question" && turn.state === "failed" ? (
        <View>
          <Text
            accessibilityLiveRegion="polite"
            style={{ fontSize: 17, lineHeight: 24, color: theme.ink }}
          >
            {turn.text}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
            <Touch
              label="Try the photo again"
              onPress={() => onRetry?.(turn)}
              style={{
                height: 44,
                paddingHorizontal: 18,
                borderRadius: 22,
                backgroundColor: theme.heavy,
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: theme.onHeavy,
                }}
              >
                Try again
              </Text>
            </Touch>
            <Touch
              label="Type the meal in"
              onPress={() => onManual?.(turn)}
              style={{
                height: 44,
                paddingHorizontal: 18,
                borderRadius: 22,
                backgroundColor: "#F3F3F0",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 15, color: theme.ink }}>Type it in</Text>
            </Touch>
          </View>
        </View>
      ) : turn.kind === "question" && turn.state === "thinking" ? (
        <Thinking />
      ) : turn.kind === "question" || turn.kind === "meal" ? (
        (() => {
          const saved = meals.find((meal) => meal.id === turn.mealId);
          if (turn.kind === "meal" && turn.state === "complete" && !saved)
            return (
              <Text style={{ color: theme.muted, fontSize: 16 }}>
                Meal removed from your diary.
              </Text>
            );
          const meal =
            turn.kind === "meal" || turn.state === "confirming"
              ? (saved ?? turn.pendingMeal)
              : undefined;
          return (
            <MealReply
              key={turn.id}
              prompt={turn.text ?? "Which meal?"}
              selecting={turn.state === "confirming"}
              meal={meal}
              complete={turn.state === "complete"}
              total={meal ? totalOn(meals, meal.date) : 0}
              guide={guide}
              thinking={
                // BitePal's "Hmm, something tasty." while estimating: the
                // lemon's own line sits beside the dots until the number lands.
                <View style={{ gap: 4 }}>
                  <Thinking />
                  {turn.live && (
                    <Text style={{ fontSize: 13, color: theme.muted }}>
                      Hmm, something tasty.
                    </Text>
                  )}
                </View>
              }
              note={turn.note}
              onChoose={(type) => onChoose(turn, type)}
              onEdit={() => {
                if (saved) onEdit(saved);
              }}
              onCalendar={onCalendar}
            />
          );
        })()
      ) : turn.state === "thinking" && !streaming ? (
        <Thinking />
      ) : (
        <View>
          {turn.answer ? (
            <VisualAnswer answer={turn.answer} />
          ) : (
            <Text
              selectable
              accessibilityLiveRegion={streaming ? "polite" : "none"}
              style={{
                fontSize: 20,
                lineHeight: 28,
                letterSpacing: -0.25,
                color: theme.ink,
              }}
            >
              {turn.text}
            </Text>
          )}
          {streaming && (
            <View style={{ marginTop: 8 }}>
              <Thinking />
            </View>
          )}
          {turn.state === "complete" && !!turn.followups?.length && onAsk && (
            <View style={{ marginTop: 14 }}>
              {turn.followups.map((question, index) => (
                <Touch
                  key={question}
                  label={`Ask: ${question}`}
                  onPress={() => onAsk(question)}
                  style={{
                    minHeight: 44,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 8,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: theme.line,
                  }}
                >
                  <Symbol
                    name="arrow.turn.down.right"
                    size={13}
                    color={theme.muted}
                  />
                  <Text
                    style={{ flex: 1, fontSize: 15, color: theme.ink }}
                    numberOfLines={2}
                  >
                    {question}
                  </Text>
                </Touch>
              ))}
            </View>
          )}
          {turn.state === "stopped" && (
            <Text
              style={{
                color: theme.muted,
                marginTop: 10,
                fontSize: 13,
              }}
            >
              Response stopped.
            </Text>
          )}
          {turn.state === "complete" && (
            <Touch
              label="Copy Zest’s answer"
              onPress={() => void Clipboard.setStringAsync(turn.text ?? "")}
              style={{
                width: 44,
                height: 44,
                justifyContent: "center",
                alignItems: "center",
                alignSelf: "flex-end",
                marginTop: 0,
              }}
            >
              <Symbol name="square.on.square" size={16} color={theme.muted} />
            </Touch>
          )}
        </View>
      )}
    </Animated.View>
  );
}
