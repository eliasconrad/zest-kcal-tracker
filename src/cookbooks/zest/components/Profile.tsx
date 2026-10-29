import { Alert, ScrollView, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { GlassSurface } from "./ui/GlassSurface";
import { GlassButton } from "./ui/GlassButton";
import { Symbol, Touch } from "./ui/Touch";
import { CalorieRing, MacroBars } from "./DayProgress";
import { dayKey, loggedDays, macrosOn, relativeDay, totalOn, type Meal } from "../data/diary";
import {
  activityLabel,
  age,
  formatHeight,
  formatWeight,
  goalLabel,
  kgToLb,
  lbToKg,
  paceLabel,
  streak,
  weeksToTarget,
} from "../data/nutrition";
import { profilePlan, type Profile as ProfileData } from "../state/profileStore";
import type { OnboardingStep } from "./Onboarding";
import { theme } from "../theme";
import type { Scene } from "../hooks/useScene";

/**
 * The profile sheet: today at a glance, progress toward the target, the goals
 * that produce the guide, and the few settings a diary needs. Same geometry
 * and material as the calendar so the lemon perches in the same place.
 */
export function ProfileSheet({
  scene,
  open,
  meals,
  profile,
  apiConfigured,
  onClose,
  onEdit,
  onName,
  onGuide,
  onLogWeight,
  onReset,
}: {
  scene: Scene;
  open: boolean;
  meals: Meal[];
  profile: ProfileData;
  apiConfigured: boolean;
  onClose: () => void;
  onEdit: (step: OnboardingStep) => void;
  onName: (name: string) => void;
  onGuide: (guide: number | undefined) => void;
  onLogWeight: (kg: number) => void;
  onReset: () => void;
}) {
  const today = dayKey();
  const plan = profilePlan(profile);
  const total = totalOn(meals, today);
  const macros = macrosOn(meals, today);
  const days = streak(loggedDays(meals), today, relativeDay(-1));
  const { pick, reduced } = scene;
  const panelTop = Math.max(180, scene.height - 616);
  const slide = useAnimatedStyle(() => {
    const p = open ? pick.get() : 0;
    return {
      transform: [
        {
          translateY: reduced
            ? p < 0.01
              ? scene.height
              : 0
            : (1 - p) * (scene.height - panelTop + 20),
        },
      ],
    };
  });
  const blur = useAnimatedStyle(() => ({
    opacity: open ? Math.max(0, Math.min(1, pick.get())) : 0,
  }));
  const closeControl = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - (open ? pick.get() : 0)) * -130 }],
  }));
  const tracking = profile.goal === "lose" || profile.goal === "gain";
  const start = profile.weights[0]?.kg ?? profile.weightKg;
  const span = Math.abs(profile.targetWeightKg - start);
  const done = Math.max(0, Math.min(1, span ? Math.abs(profile.weightKg - start) / span : 0));
  const weeks = tracking ? weeksToTarget(profile.weightKg, profile.targetWeightKg, profile.pace) : 0;
  const initial = (profile.name.trim()[0] ?? "Z").toUpperCase();

  const promptWeight = () =>
    Alert.prompt(
      "Today’s weight",
      profile.units === "metric" ? "In kilograms" : "In pounds",
      (text) => {
        const n = Number(String(text).replace(",", "."));
        if (!Number.isFinite(n) || n <= 0) return;
        onLogWeight(profile.units === "metric" ? n : lbToKg(n));
      },
      "plain-text",
      profile.units === "metric"
        ? String(Math.round(profile.weightKg * 10) / 10)
        : String(Math.round(kgToLb(profile.weightKg))),
      "decimal-pad",
    );
  const promptName = () =>
    Alert.prompt("Your name", undefined, (text) => text?.trim() && onName(text.trim()), "plain-text", profile.name);
  const promptGuide = () =>
    Alert.prompt(
      "Daily guide",
      "Leave empty to go back to the computed guide.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: (text?: string) => {
            const n = Number.parseInt(String(text ?? ""), 10);
            onGuide(Number.isFinite(n) && n >= 800 && n <= 6000 ? n : undefined);
          },
        },
      ],
      "plain-text",
      profile.manualGuide ? String(profile.manualGuide) : "",
      "number-pad",
    );
  const confirmReset = () =>
    Alert.alert("Start over?", "This clears your profile and every logged meal on this device.", [
      { text: "Keep everything", style: "cancel" },
      { text: "Clear all", style: "destructive", onPress: onReset },
    ]);

  return (
    <View
      pointerEvents={open ? "box-none" : "none"}
      accessibilityViewIsModal={open}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? "auto" : "no-hide-descendants"}
      style={{ position: "absolute", inset: 0, zIndex: 30 }}
    >
      <Animated.View pointerEvents="none" style={[{ position: "absolute", inset: 0 }, blur]}>
        <BlurView intensity={65} tint="light" style={{ flex: 1 }} />
      </Animated.View>
      <Animated.View style={[{ position: "absolute", top: scene.top, right: 18 }, closeControl]}>
        <GlassButton name="xmark" label="Close profile" onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          {
            position: "absolute",
            top: panelTop,
            left: 16,
            right: 16,
            height: scene.height - panelTop - scene.bottom - 16,
          },
          slide,
        ]}
      >
        <GlassSurface style={{ flex: 1, borderRadius: 36 }}>
          <View style={{ flex: 1, borderRadius: 36, overflow: "hidden" }}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 30 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <Touch label="Change your name" onPress={promptName}>
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: theme.soft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 24, fontWeight: "600", color: theme.ink }}>{initial}</Text>
                  </View>
                </Touch>
                <View style={{ flex: 1 }}>
                  <Text
                    accessibilityRole="header"
                    numberOfLines={1}
                    style={{ fontSize: 26, fontWeight: "600", letterSpacing: -0.7, color: theme.ink }}
                  >
                    {profile.name.trim() || "You"}
                  </Text>
                  <Text style={{ fontSize: 13, color: theme.muted, marginTop: 1 }}>
                    {age(profile.birthYear)} years · {goalLabel[profile.goal]}
                    {days > 1 ? ` · ${days}-day streak` : ""}
                  </Text>
                </View>
                {days > 0 && (
                  <View
                    accessible
                    accessibilityLabel={`${days} day logging streak`}
                    style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                  >
                    <Symbol name="flame.fill" size={15} color={theme.accent} />
                    <Text style={{ fontSize: 15, fontWeight: "600", color: theme.ink }}>{days}</Text>
                  </View>
                )}
              </View>

              <Card title="Today">
                <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
                  <CalorieRing total={total} guide={plan.guide} />
                  <View style={{ flex: 1 }}>
                    <MacroBars
                      logged={macros}
                      targets={{ protein: plan.protein, carbs: plan.carbs, fat: plan.fat }}
                      compact
                    />
                  </View>
                </View>
                <Text style={{ fontSize: 12, color: theme.muted, marginTop: 12 }}>
                  {total.toLocaleString()} of {plan.guide.toLocaleString()} kcal
                  {profile.manualGuide ? " · manual guide" : ""}
                </Text>
              </Card>

              {tracking && (
                <Card
                  title="Progress"
                  action={{ label: "Log weight", onPress: promptWeight }}
                >
                  <Text style={{ fontSize: 17, fontWeight: "500", color: theme.ink }}>
                    {Math.abs(profile.weightKg - start) < 0.05
                      ? "Just getting started."
                      : `${profile.goal === "lose" ? "Down" : "Up"} ${formatWeight(Math.abs(profile.weightKg - start), profile.units)} so far.`}
                  </Text>
                  <Text style={{ fontSize: 13, color: theme.muted, marginTop: 2 }}>
                    {weeks ? `About ${weeks} ${weeks === 1 ? "week" : "weeks"} to go at ${paceLabel[profile.pace].toLowerCase()} pace.` : "You’re at your target."}
                  </Text>
                  <View
                    style={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: "#25272012",
                      marginTop: 14,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        width: `${Math.max(3, done * 100)}%`,
                        height: "100%",
                        borderRadius: 3,
                        backgroundColor: "#85916C",
                      }}
                    />
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                    <Text style={{ fontSize: 12, color: theme.muted }}>{formatWeight(start, profile.units)}</Text>
                    <Text style={{ fontSize: 12, fontWeight: "500", color: theme.ink }}>
                      now {formatWeight(profile.weightKg, profile.units)}
                    </Text>
                    <Text style={{ fontSize: 12, color: theme.muted }}>{formatWeight(profile.targetWeightKg, profile.units)}</Text>
                  </View>
                </Card>
              )}

              <Card title="Your plan">
                <Row label="Goal" value={goalLabel[profile.goal]} onPress={() => onEdit("goal")} />
                <Row
                  label="Body"
                  value={`${formatHeight(profile.heightCm, profile.units)} · ${formatWeight(profile.weightKg, profile.units)} · ${age(profile.birthYear)} y`}
                  onPress={() => onEdit("body")}
                />
                {tracking && (
                  <Row label="Target" value={formatWeight(profile.targetWeightKg, profile.units)} onPress={() => onEdit("target")} />
                )}
                <Row label="Activity" value={activityLabel[profile.activity].title} onPress={() => onEdit("activity")} />
                {tracking && <Row label="Pace" value={paceLabel[profile.pace]} onPress={() => onEdit("pace")} />}
                <Row
                  label="Daily guide"
                  value={`${plan.guide.toLocaleString()} kcal${profile.manualGuide ? " (manual)" : ""}`}
                  onPress={promptGuide}
                  last
                />
              </Card>

              <Card title="Targets">
                <Row label="Protein" value={`${plan.protein} g`} />
                <Row label="Carbs" value={`${plan.carbs} g`} />
                <Row label="Fat" value={`${plan.fat} g`} last />
                <Text style={{ fontSize: 12, lineHeight: 17, color: theme.muted, marginTop: 10 }}>
                  Protein leads, fat takes a fixed share, carbs fill the rest. A guide, not a grade.
                </Text>
              </Card>

              <Card title="This device">
                <Text style={{ fontSize: 13, lineHeight: 19, color: theme.muted }}>
                  {apiConfigured
                    ? "Meal photos are sent to the configured model to estimate calories; the diary itself stays on this phone."
                    : "Everything stays on this phone. No account, no upload."}
                </Text>
                <Touch
                  label="Clear profile and diary"
                  onPress={confirmReset}
                  style={{ minHeight: 44, justifyContent: "center", marginTop: 6 }}
                >
                  <Text style={{ fontSize: 14, color: "#936355" }}>Start over</Text>
                </Touch>
              </Card>
            </ScrollView>
          </View>
        </GlassSurface>
      </Animated.View>
    </View>
  );
}

function Card({
  title,
  action,
  children,
}: React.PropsWithChildren<{ title: string; action?: { label: string; onPress: () => void } }>) {
  return (
    <View style={{ marginTop: 22 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", letterSpacing: 0.2, color: theme.muted }}>
          {title.toUpperCase()}
        </Text>
        {action && (
          <Touch label={action.label} onPress={action.onPress} style={{ minHeight: 32, justifyContent: "center" }}>
            <Text style={{ fontSize: 13, fontWeight: "500", color: theme.accent }}>{action.label}</Text>
          </Touch>
        )}
      </View>
      <View
        style={{
          borderRadius: 24,
          borderCurve: "continuous",
          backgroundColor: "#FFFFFF",
          paddingHorizontal: 18,
          paddingVertical: 16,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  onPress,
  last = false,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  last?: boolean;
}) {
  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 44,
        borderBottomWidth: last ? 0 : 0.5,
        borderColor: theme.line,
        gap: 10,
      }}
    >
      <Text style={{ fontSize: 15, color: theme.muted, width: 92 }}>{label}</Text>
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, color: theme.ink, textAlign: "right" }}>
        {value}
      </Text>
      {onPress && <Symbol name="chevron.right" size={12} color={theme.faint} />}
    </View>
  );
  return onPress ? (
    <Touch label={`${label}: ${value}. Edit`} onPress={onPress}>
      {body}
    </Touch>
  ) : (
    body
  );
}
