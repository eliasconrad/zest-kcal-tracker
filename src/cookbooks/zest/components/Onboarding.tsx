import { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInRight,
  FadeOut,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import {
  KeyboardAwareScrollView,
  KeyboardToolbar,
} from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassSurface } from "./ui/GlassSurface";
import { Symbol, Touch } from "./ui/Touch";
import { FoodSticker } from "./Stickers";
import { Thinking } from "./Thinking";
import { cardFloor, FIGURE, SCALE } from "../hooks/useScene";
import {
  activities,
  activityLabel,
  age,
  cmToFeetInches,
  feetInchesToCm,
  formatHeight,
  formatWeight,
  goalLabel,
  goals,
  kgToLb,
  lbToKg,
  limits,
  paceKgPerWeek,
  paceLabel,
  paces,
  plan,
  sexes,
  targetDate,
  weeksToTarget,
  type Goal,
  type Pace,
  type Sex,
  type Units,
} from "../data/nutrition";
import { type Profile } from "../state/profileStore";
import { theme } from "../theme";
import type { Scene } from "../hooks/useScene";

export type OnboardingStep =
  "name" | "goal" | "body" | "target" | "activity" | "pace" | "plan";

const order: OnboardingStep[] = [
  "name",
  "goal",
  "body",
  "target",
  "activity",
  "pace",
  "plan",
];

function stepsFor(goal: Goal): OnboardingStep[] {
  return goal === "lose" || goal === "gain"
    ? order
    : order.filter((step) => step !== "target" && step !== "pace");
}

const sexLabel: Record<Sex, string> = {
  female: "Female",
  male: "Male",
  unspecified: "Rather not say",
};

/**
 * One question per screen, a thin progress line, the lemon perched beside the
 * sheet. Values are held locally and written once at the end (or on save when
 * editing a single step from the profile).
 */
export function Onboarding({
  scene,
  profile,
  startAt,
  editing = false,
  onDone,
  onCancel,
}: {
  scene: Scene;
  profile: Profile;
  startAt?: OnboardingStep;
  /** Editing one step from the profile: save and close after that step. */
  editing?: boolean;
  onDone: (fields: Partial<Profile>) => void;
  onCancel?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [draft, setDraft] = useState<Profile>(profile);
  const [step, setStep] = useState<OnboardingStep>(startAt ?? "name");
  const steps = useMemo(() => stepsFor(draft.goal), [draft.goal]);
  const index = Math.max(0, steps.indexOf(step));
  const scroll =
    useRef<React.ComponentRef<typeof KeyboardAwareScrollView>>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [step]);
  const set = (fields: Partial<Profile>) =>
    setDraft((old) => ({ ...old, ...fields }));
  const update = (fields: Partial<Profile>) => {
    set(fields);
    void Haptics.selectionAsync();
  };

  // Timings measured frame by frame from the YAZIO and BitePal onboarding
  // recordings (docs/MOTION_SPEC.md): a greeting interlude of 1.3 s, a plan
  // computation of four items at 1.5 s each, a 0.3 s push between questions.
  const GREETING_MS = 1300;
  const PLAN_ITEM_MS = 1500;
  const planItems = [
    "Resting energy",
    "Daily activity",
    draft.goal === "lose" || draft.goal === "gain" ? "Your pace" : "Your goal",
    "Macro split",
  ];
  const [interlude, setInterlude] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [doneItems, setDoneItems] = useState(0);
  const hop = (times = 1) =>
    scene.hop.set(
      times === 2
        ? withSequence(
            withTiming(0.4, { duration: 130 }),
            withTiming(0, { duration: 180 }),
            withTiming(0.3, { duration: 120 }),
            withTiming(0, { duration: 200 }),
          )
        : withSequence(
            withTiming(0.25, { duration: 120 }),
            withTiming(0, { duration: 190 }),
          ),
    );
  // The greeting interlude holds, then the first question arrives.
  useEffect(() => {
    if (!interlude) return;
    const timer = setTimeout(() => setInterlude(false), GREETING_MS);
    return () => clearTimeout(timer);
  }, [interlude]);
  // The plan checks off one item per interval; the last one reveals the guide.
  useEffect(() => {
    if (!preparing) return;
    const timers = planItems.map((_, i) =>
      setTimeout(() => setDoneItems(i + 1), PLAN_ITEM_MS * (i + 1)),
    );
    const finish = setTimeout(
      () => {
        setPreparing(false);
        hop(2);
      },
      PLAN_ITEM_MS * planItems.length + 400,
    );
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preparing]);
  const go = (direction: 1 | -1) => {
    Keyboard.dismiss();
    if (editing) {
      if (direction === -1) onCancel?.();
      else onDone(draft);
      return;
    }
    const next = steps[index + direction];
    if (!next) {
      if (direction === 1) onDone(draft);
      else onCancel?.();
      return;
    }
    setStep(next);
    if (!scene.reduced) {
      if (next === "plan" && direction === 1) {
        setDoneItems(0);
        setPreparing(true);
      } else if (next === "goal" && direction === 1) {
        setInterlude(true);
        hop(1);
      } else hop(1);
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const firstName = draft.name.trim().split(/\s+/)[0] || "";
  const line = editing
    ? "Let’s adjust that."
    : step === "name"
      ? "Hi! I’m Zest."
      : step === "goal"
        ? firstName
          ? `Nice to meet you, ${firstName}!`
          : "Nice to meet you!"
        : step === "body"
          ? "Just the basics. No judgement."
          : step === "target"
            ? "Pick a number that feels kind."
            : step === "activity"
              ? "Honest answers make better guides."
              : step === "pace"
                ? "Steady wins. I’m patient."
                : preparing
                  ? "Working it out…"
                  : firstName
                    ? `Here’s your guide, ${firstName}.`
                    : "Here’s your guide.";

  const ready = (() => {
    switch (step) {
      case "name":
        return draft.name.trim().length > 0;
      case "body":
        return (
          draft.heightCm >= limits.heightCm.min &&
          draft.heightCm <= limits.heightCm.max &&
          draft.weightKg >= limits.weightKg.min &&
          draft.weightKg <= limits.weightKg.max &&
          draft.birthYear >= limits.birthYear().min &&
          draft.birthYear <= limits.birthYear().max
        );
      case "target":
        return (
          draft.targetWeightKg >= limits.weightKg.min &&
          draft.targetWeightKg <= limits.weightKg.max &&
          (draft.goal === "lose"
            ? draft.targetWeightKg < draft.weightKg
            : draft.targetWeightKg > draft.weightKg)
        );
      default:
        return true;
    }
  })();

  const panelTop = Math.max(180, height - 616);
  const current = plan(
    {
      sex: draft.sex,
      birthYear: draft.birthYear,
      heightCm: draft.heightCm,
      weightKg: draft.weightKg,
    },
    draft.goal,
    draft.activity,
    draft.pace,
  );

  return (
    <View
      accessibilityViewIsModal
      style={{ position: "absolute", inset: 0, zIndex: 40 }}
    >
      {step === "plan" && !preparing && !scene.reduced && (
        <Sparkles
          top={cardFloor(height) - FIGURE.hero * SCALE.card - 20}
          right={24}
        />
      )}
      <LemonBubble
        text={line}
        thinking={false}
        top={cardFloor(height) - FIGURE.hero * SCALE.card - 8}
        right={118}
        reduced={scene.reduced}
      />
      <Animated.View
        entering={scene.reduced ? undefined : FadeIn.duration(260)}
        exiting={scene.reduced ? undefined : FadeOut.duration(200)}
        style={[
          {
            position: "absolute",
            top: panelTop,
            left: 16,
            right: 16,
            bottom: insets.bottom + 16,
          },
        ]}
      >
        <GlassSurface style={{ flex: 1, borderRadius: 36 }}>
          <View style={{ flex: 1, borderRadius: 36, overflow: "hidden" }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingTop: 14,
                paddingHorizontal: 12,
                gap: 6,
              }}
            >
              <Touch
                label={index === 0 || editing ? "Cancel" : "Back"}
                onPress={() => go(-1)}
                disabled={index === 0 && !editing && !onCancel}
                style={{
                  width: 44,
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: index === 0 && !editing && !onCancel ? 0 : 1,
                }}
              >
                <Symbol
                  name={editing ? "xmark" : "chevron.left"}
                  size={16}
                  color={theme.ink}
                />
              </Touch>
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={`Step ${index + 1} of ${steps.length}`}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: "#25272012",
                  overflow: "hidden",
                  marginRight: 14,
                }}
              >
                <Animated.View
                  style={{
                    width: `${editing ? 100 : ((index + 1) / steps.length) * 100}%`,
                    height: "100%",
                    borderRadius: 2,
                    backgroundColor: theme.ink,
                  }}
                />
              </View>
            </View>
            {/* The list scrolls the focused field above the keyboard; the button
                follows the content so it never covers a field. */}
            <KeyboardAwareScrollView
              ref={scroll}
              bottomOffset={28}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 22,
                paddingTop: 10,
                paddingBottom: 24,
              }}
            >
              <Animated.View
                key={`${step}-${interlude ? "hello" : "ask"}`}
                entering={scene.reduced ? undefined : FadeInRight.duration(280)}
              >
                {interlude && step === "goal" && (
                  <Question
                    title={
                      firstName
                        ? `Nice to meet you, ${firstName}.`
                        : "Nice to meet you."
                    }
                    detail="Three short questions, then a guide that fits you."
                  >
                    <View style={{ alignItems: "center", minHeight: 120 }}>
                      <FoodSticker kind="Breakfast" size={110} angle={-6} />
                    </View>
                  </Question>
                )}
                {step === "name" && (
                  <Question
                    title="What should I call you?"
                    detail="One lemon, a diary made of stickers, and your name on the door."
                  >
                    <TextInput
                      accessibilityLabel="Your name"
                      placeholder="Your name"
                      value={draft.name}
                      onChangeText={(name) => set({ name })}
                      autoFocus
                      autoCapitalize="words"
                      returnKeyType="done"
                      onSubmitEditing={() => ready && go(1)}
                      maxLength={40}
                      style={{
                        minHeight: 58,
                        fontSize: 30,
                        fontWeight: "500",
                        letterSpacing: -0.8,
                        color: theme.ink,
                        borderBottomWidth: 0.5,
                        borderColor: theme.line,
                      }}
                    />
                  </Question>
                )}
                {step === "goal" && !interlude && (
                  <Question
                    title="What are you here for?"
                    detail="This sets your daily guide. You can change it any time."
                  >
                    {goals.map((goal) => (
                      <Choice
                        key={goal}
                        label={goalLabel[goal]}
                        selected={draft.goal === goal}
                        onPress={() =>
                          update({
                            goal,
                            targetWeightKg:
                              goal === "lose"
                                ? Math.min(
                                    draft.targetWeightKg,
                                    draft.weightKg - 1,
                                  )
                                : goal === "gain"
                                  ? Math.max(
                                      draft.targetWeightKg,
                                      draft.weightKg + 1,
                                    )
                                  : draft.weightKg,
                          })
                        }
                      />
                    ))}
                  </Question>
                )}
                {step === "body" && (
                  <Question
                    title="A little about you"
                    detail="Used only to estimate how much energy your body uses."
                  >
                    <View
                      style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}
                    >
                      {sexes.map((sex) => (
                        <Chip
                          key={sex}
                          label={sexLabel[sex]}
                          selected={draft.sex === sex}
                          onPress={() => update({ sex })}
                        />
                      ))}
                    </View>
                    <UnitsToggle
                      units={draft.units}
                      onChange={(units) => update({ units })}
                    />
                    <NumberField
                      label="Birth year"
                      value={String(draft.birthYear)}
                      unit={`${age(draft.birthYear)} years`}
                      maxLength={4}
                      onChange={(text) => set({ birthYear: Number(text) || 0 })}
                    />
                    {draft.units === "metric" ? (
                      <NumberField
                        label="Height"
                        value={
                          draft.heightCm
                            ? String(Math.round(draft.heightCm))
                            : ""
                        }
                        unit="cm"
                        maxLength={3}
                        onChange={(text) =>
                          set({ heightCm: Number(text) || 0 })
                        }
                      />
                    ) : (
                      <ImperialHeight
                        cm={draft.heightCm}
                        onChange={(heightCm) => set({ heightCm })}
                      />
                    )}
                    <WeightField
                      key={draft.units}
                      label="Weight"
                      kg={draft.weightKg}
                      units={draft.units}
                      onChange={(weightKg) => set({ weightKg })}
                    />
                  </Question>
                )}
                {step === "target" && (
                  <Question
                    title={
                      draft.goal === "lose"
                        ? "Where would you like to land?"
                        : "What are you aiming for?"
                    }
                    detail={`You’re at ${formatWeight(draft.weightKg, draft.units)} now.`}
                  >
                    <WeightField
                      key={draft.units}
                      label="Target weight"
                      kg={draft.targetWeightKg}
                      units={draft.units}
                      onChange={(targetWeightKg) => set({ targetWeightKg })}
                    />
                    {!ready && (
                      <Text
                        style={{
                          color: theme.muted,
                          fontSize: 13,
                          marginTop: 6,
                        }}
                      >
                        {draft.goal === "lose"
                          ? "Pick something below your current weight."
                          : "Pick something above your current weight."}
                      </Text>
                    )}
                  </Question>
                )}
                {step === "activity" && (
                  <Question
                    title="How do your weeks move?"
                    detail="Pick what’s usual, not what you hope for."
                  >
                    {activities.map((activity) => (
                      <Choice
                        key={activity}
                        label={activityLabel[activity].title}
                        detail={activityLabel[activity].detail}
                        selected={draft.activity === activity}
                        onPress={() => update({ activity })}
                      />
                    ))}
                  </Question>
                )}
                {step === "pace" && (
                  <PaceStep
                    draft={draft}
                    onChange={(pace) => update({ pace })}
                  />
                )}
                {step === "plan" && (
                  <PlanStep
                    draft={draft}
                    plan={current}
                    preparing={preparing}
                    items={planItems}
                    doneItems={doneItems}
                  />
                )}
              </Animated.View>
              <View style={{ marginTop: 26 }}>
                <Touch
                  label={
                    step === "plan"
                      ? editing
                        ? "Save"
                        : "Start logging"
                      : editing
                        ? "Save"
                        : "Continue"
                  }
                  onPress={() => go(1)}
                  disabled={!ready}
                  style={{
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: theme.heavy,
                    justifyContent: "center",
                    alignItems: "center",
                    opacity: ready ? 1 : 0.35,
                  }}
                >
                  <Text
                    style={{ fontSize: 16, fontWeight: "600", color: "white" }}
                  >
                    {step === "plan"
                      ? editing
                        ? "Save"
                        : "Start logging"
                      : editing
                        ? "Save"
                        : "Continue"}
                  </Text>
                </Touch>
              </View>
            </KeyboardAwareScrollView>
          </View>
        </GlassSurface>
      </Animated.View>
      {/* Numeric pads have no return key; the toolbar gives every field Next and Done. */}
      <KeyboardToolbar
        doneText="Done"
        opacity="FF"
        theme={{
          light: {
            primary: theme.ink,
            disabled: theme.faint,
            background: "#F3F3F0",
            ripple: "#00000010",
          },
          dark: {
            primary: theme.ink,
            disabled: theme.faint,
            background: "#F3F3F0",
            ripple: "#00000010",
          },
        }}
      />
    </View>
  );
}

function Question({
  title,
  detail,
  children,
}: React.PropsWithChildren<{ title: string; detail?: string }>) {
  return (
    <View>
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.4}
        style={{
          fontSize: 28,
          lineHeight: 33,
          fontWeight: "600",
          letterSpacing: -0.9,
          color: theme.ink,
        }}
      >
        {title}
      </Text>
      {detail && (
        <Text
          style={{
            fontSize: 15,
            lineHeight: 21,
            color: theme.muted,
            marginTop: 6,
          }}
        >
          {detail}
        </Text>
      )}
      <View style={{ marginTop: 20, gap: 10 }}>{children}</View>
    </View>
  );
}

function Choice({
  label,
  detail,
  selected,
  onPress,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Touch label={label} onPress={onPress} expand selected={selected}>
      <View
        style={{
          minHeight: 58,
          borderRadius: 20,
          borderCurve: "continuous",
          paddingHorizontal: 18,
          paddingVertical: 14,
          backgroundColor: selected ? theme.heavy : "#FFFFFF",
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 17,
              fontWeight: "500",
              color: selected ? theme.onHeavy : theme.ink,
            }}
          >
            {label}
          </Text>
          {detail && (
            <Text
              style={{
                fontSize: 13,
                marginTop: 2,
                color: selected ? "#D9DAD3" : theme.muted,
              }}
            >
              {detail}
            </Text>
          )}
        </View>
        {selected && (
          <Symbol name="checkmark" size={14} color={theme.onHeavy} />
        )}
      </View>
    </Touch>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Touch
      label={label}
      onPress={onPress}
      selected={selected}
      style={{ flex: 1 }}
    >
      <View
        style={{
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: selected ? theme.heavy : "#FFFFFF",
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            fontSize: 13,
            fontWeight: "500",
            color: selected ? theme.onHeavy : theme.ink,
          }}
        >
          {label}
        </Text>
      </View>
    </Touch>
  );
}

function UnitsToggle({
  units,
  onChange,
}: {
  units: Units;
  onChange: (u: Units) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "flex-end",
        marginBottom: 4,
      }}
    >
      {(["metric", "imperial"] as const).map((option) => (
        <Touch
          key={option}
          label={
            option === "metric" ? "Use metric units" : "Use imperial units"
          }
          onPress={() => onChange(option)}
          selected={units === option}
          style={{
            paddingHorizontal: 10,
            minHeight: 32,
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: units === option ? "600" : "400",
              color: units === option ? theme.ink : theme.faint,
            }}
          >
            {option === "metric" ? "kg · cm" : "lb · ft"}
          </Text>
        </Touch>
      ))}
    </View>
  );
}

function NumberField({
  label,
  value,
  unit,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  unit: string;
  maxLength: number;
  onChange: (text: string) => void;
}) {
  const input = useRef<TextInput>(null);
  return (
    // The whole row focuses the field, so the label is as tappable as the digits.
    <Pressable
      accessible={false}
      onPress={() => input.current?.focus()}
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 0.5,
        borderColor: theme.line,
        minHeight: 56,
      }}
    >
      <Text
        accessible={false}
        style={{ width: 104, fontSize: 15, color: theme.muted }}
      >
        {label}
      </Text>
      <TextInput
        ref={input}
        accessibilityLabel={label}
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^\d.]/g, ""))}
        keyboardType="decimal-pad"
        selectTextOnFocus
        maxLength={maxLength}
        style={{
          flex: 1,
          fontSize: 26,
          fontWeight: "500",
          color: theme.ink,
          fontVariant: ["tabular-nums"],
          paddingVertical: 8,
        }}
      />
      <Text style={{ fontSize: 14, color: theme.muted }}>{unit}</Text>
    </Pressable>
  );
}

function WeightField({
  label,
  kg,
  units,
  onChange,
}: {
  label: string;
  kg: number;
  units: Units;
  onChange: (kg: number) => void;
}) {
  // Mounted with key={units} by its parent, so a unit flip remounts with fresh text.
  const [text, setText] = useState(() =>
    kg
      ? String(
          units === "metric"
            ? Math.round(kg * 10) / 10
            : Math.round(kgToLb(kg)),
        )
      : "",
  );
  return (
    <NumberField
      label={label}
      value={text}
      unit={units === "metric" ? "kg" : "lb"}
      maxLength={5}
      onChange={(next) => {
        setText(next);
        const n = Number(next);
        onChange(Number.isFinite(n) ? (units === "metric" ? n : lbToKg(n)) : 0);
      }}
    />
  );
}

function ImperialHeight({
  cm,
  onChange,
}: {
  cm: number;
  onChange: (cm: number) => void;
}) {
  const initial = cmToFeetInches(cm);
  const [feet, setFeet] = useState(String(initial.feet));
  const [inches, setInches] = useState(String(initial.inches));
  const commit = (f: string, i: string) =>
    onChange(feetInchesToCm(Number(f) || 0, Number(i) || 0));
  return (
    <View style={{ flexDirection: "row", gap: 14 }}>
      <View style={{ flex: 1 }}>
        <NumberField
          label="Height"
          value={feet}
          unit="ft"
          maxLength={1}
          onChange={(t) => {
            setFeet(t);
            commit(t, inches);
          }}
        />
      </View>
      <View style={{ width: 120 }}>
        <NumberField
          label=""
          value={inches}
          unit="in"
          maxLength={2}
          onChange={(t) => {
            setInches(t);
            commit(feet, t);
          }}
        />
      </View>
    </View>
  );
}

function PaceStep({
  draft,
  onChange,
}: {
  draft: Profile;
  onChange: (pace: Pace) => void;
}) {
  const weeks = weeksToTarget(draft.weightKg, draft.targetWeightKg, draft.pace);
  const eta = targetDate(weeks);
  const current = plan(
    {
      sex: draft.sex,
      birthYear: draft.birthYear,
      heightCm: draft.heightCm,
      weightKg: draft.weightKg,
    },
    draft.goal,
    draft.activity,
    draft.pace,
  );
  return (
    <Question
      title="How quickly?"
      detail="A steadier pace is easier to keep. The lemon is patient."
    >
      <View style={{ flexDirection: "row", gap: 8 }}>
        {paces.map((pace) => (
          <Touch
            key={pace}
            label={`${paceLabel[pace]}, ${paceKgPerWeek[pace]} kilograms a week`}
            onPress={() => onChange(pace)}
            selected={draft.pace === pace}
            style={{ flex: 1 }}
          >
            <View
              style={{
                borderRadius: 20,
                borderCurve: "continuous",
                paddingVertical: 14,
                alignItems: "center",
                backgroundColor: draft.pace === pace ? theme.heavy : "#FFFFFF",
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "500",
                  color: draft.pace === pace ? theme.onHeavy : theme.ink,
                }}
              >
                {paceLabel[pace]}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  marginTop: 2,
                  color: draft.pace === pace ? "#D9DAD3" : theme.muted,
                }}
              >
                {draft.units === "metric"
                  ? `${paceKgPerWeek[pace]} kg`
                  : `${Math.round(kgToLb(paceKgPerWeek[pace]) * 10) / 10} lb`}
                /week
              </Text>
            </View>
          </Touch>
        ))}
      </View>
      <View
        style={{
          marginTop: 8,
          padding: 18,
          borderRadius: 22,
          borderCurve: "continuous",
          backgroundColor: "#FFFFFF",
        }}
      >
        <Text style={{ fontSize: 15, color: theme.ink }}>
          {weeks
            ? `About ${weeks} ${weeks === 1 ? "week" : "weeks"}, around ${eta.toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`
            : "You’re already there."}
        </Text>
        <Text style={{ fontSize: 13, color: theme.muted, marginTop: 4 }}>
          Daily guide {current.guide.toLocaleString()} kcal
          {current.floored ? " (held at a safe floor)" : ""}
        </Text>
      </View>
    </Question>
  );
}

function PlanStep({
  draft,
  plan: p,
  preparing,
  items,
  doneItems,
}: {
  draft: Profile;
  plan: ReturnType<typeof plan>;
  preparing: boolean;
  items: string[];
  doneItems: number;
}) {
  if (preparing)
    return (
      <Question
        title="Working it out…"
        detail="Adding up your body, your days and your goal."
      >
        <View
          style={{
            borderRadius: 24,
            borderCurve: "continuous",
            backgroundColor: "#FFFFFF",
            paddingHorizontal: 18,
            paddingVertical: 8,
          }}
        >
          {items.map((item, i) => {
            const done = i < doneItems;
            const active = i === doneItems;
            return (
              <View
                key={item}
                accessible
                accessibilityLabel={`${item}: ${done ? "done" : active ? "in progress" : "waiting"}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  minHeight: 44,
                  gap: 12,
                  opacity: done || active ? 1 : 0.45,
                }}
              >
                <View style={{ width: 28, alignItems: "center" }}>
                  {done ? (
                    <Symbol
                      name="checkmark.circle.fill"
                      size={18}
                      color="#85916C"
                    />
                  ) : active ? (
                    <Thinking />
                  ) : (
                    <Symbol name="circle" size={16} color={theme.faint} />
                  )}
                </View>
                <Text style={{ fontSize: 15, color: theme.ink }}>{item}</Text>
              </View>
            );
          })}
        </View>
      </Question>
    );
  const weeks =
    draft.goal === "lose" || draft.goal === "gain"
      ? weeksToTarget(draft.weightKg, draft.targetWeightKg, draft.pace)
      : 0;
  const rows = [
    { label: "Protein", value: p.protein, color: "#85916C" },
    { label: "Carbs", value: p.carbs, color: "#C9AC50" },
    { label: "Fat", value: p.fat, color: "#B08968" },
  ];
  return (
    <Question
      title={`${draft.name.trim() || "There"}, here’s your guide.`}
      detail="An estimate to lean on, not a grade. Edit it any time from your profile."
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          padding: 18,
          borderRadius: 24,
          borderCurve: "continuous",
          backgroundColor: "#FFFFFF",
        }}
      >
        <View style={{ marginLeft: -8 }}>
          <FoodSticker kind="Lunch" size={84} angle={-6} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: theme.muted }}>Every day</Text>
          <View
            style={{ flexDirection: "row", alignItems: "baseline", gap: 5 }}
          >
            <Text
              style={{
                fontSize: 44,
                lineHeight: 52,
                fontWeight: "500",
                letterSpacing: -2,
                fontVariant: ["tabular-nums"],
                color: theme.ink,
              }}
            >
              {p.guide.toLocaleString()}
            </Text>
            <Text style={{ fontSize: 15, color: theme.muted }}>kcal</Text>
          </View>
          <Text style={{ fontSize: 12, color: theme.muted }}>
            {goalLabel[draft.goal]} ·{" "}
            {activityLabel[draft.activity].title.toLowerCase()}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {rows.map((row) => (
          <View
            key={row.label}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 20,
              borderCurve: "continuous",
              backgroundColor: "#FFFFFF",
            }}
          >
            <View
              style={{
                width: 22,
                height: 4,
                borderRadius: 2,
                backgroundColor: row.color,
                marginBottom: 8,
              }}
            />
            <Text
              style={{
                fontSize: 22,
                fontWeight: "500",
                letterSpacing: -0.6,
                fontVariant: ["tabular-nums"],
                color: theme.ink,
              }}
            >
              {row.value}
              <Text style={{ fontSize: 13, color: theme.muted }}> g</Text>
            </Text>
            <Text style={{ fontSize: 12, color: theme.muted }}>
              {row.label}
            </Text>
          </View>
        ))}
      </View>
      <Text style={{ fontSize: 14, lineHeight: 20, color: theme.muted }}>
        {weeks
          ? `Target ${formatWeight(draft.targetWeightKg, draft.units)} in about ${weeks} weeks at ${paceLabel[draft.pace].toLowerCase()} pace. `
          : ""}
        Resting energy about {p.resting.toLocaleString()} kcal, maintenance
        about {p.maintenance.toLocaleString()} kcal. Height{" "}
        {formatHeight(draft.heightCm, draft.units)}.
      </Text>
    </Question>
  );
}

/** The lemon's speech bubble: pops in on every new line, points at the figure on the sheet. */
function LemonBubble({
  text,
  thinking,
  top,
  right,
  reduced,
}: {
  text: string;
  thinking: boolean;
  top: number;
  right: number;
  reduced: boolean;
}) {
  if (!text && !thinking) return null;
  return (
    <Animated.View
      key={thinking ? "thinking" : text}
      entering={reduced ? undefined : FadeIn.duration(300)}
      exiting={reduced ? undefined : FadeOut.duration(200)}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessible
      accessibilityLabel={
        thinking ? "Zest is working it out" : `Zest says: ${text}`
      }
      style={{
        position: "absolute",
        top,
        right,
        maxWidth: 230,
        transformOrigin: "right bottom",
      }}
    >
      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 20,
          borderCurve: "continuous",
          borderBottomRightRadius: 6,
          paddingHorizontal: 15,
          paddingVertical: 11,
          boxShadow: "0 4px 16px rgba(32, 35, 25, 0.07)",
        }}
      >
        {thinking ? (
          <Thinking />
        ) : (
          <Text
            style={{
              fontSize: 16,
              lineHeight: 21,
              fontWeight: "500",
              letterSpacing: -0.3,
              color: theme.ink,
            }}
          >
            {text}
          </Text>
        )}
      </View>
      <View
        style={{
          position: "absolute",
          right: -6,
          bottom: 6,
          width: 12,
          height: 12,
          backgroundColor: "#FFFFFF",
          transform: [{ rotate: "45deg" }],
          borderRadius: 2,
        }}
      />
    </Animated.View>
  );
}

/**
 * Twinkle marks around the lemon when the guide is revealed. The references
 * reposition their sparkles every ~200 ms for about two seconds; same here.
 */
function Sparkles({ top, right }: { top: number; right: number }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (tick >= 12) return;
    const timer = setTimeout(() => setTick((t) => t + 1), 200);
    return () => clearTimeout(timer);
  }, [tick]);
  if (tick >= 12) return null;
  const spots = [
    [8, 4],
    [96, 18],
    [20, 70],
    [110, 86],
    [60, -10],
  ];
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      style={{ position: "absolute", top, right, width: 130, height: 130 }}
    >
      {spots.map(([x, y], i) => {
        const phase = (tick + i * 2) % 4;
        const size = phase === 0 ? 0 : phase === 1 ? 10 : phase === 2 ? 15 : 9;
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: x + ((tick + i) % 3) * 3,
              top: y - ((tick + i * 3) % 3) * 2,
              opacity: size ? 1 : 0,
            }}
          >
            <Symbol
              name="sparkle"
              size={Math.max(size, 1)}
              color={theme.soft}
            />
          </View>
        );
      })}
    </View>
  );
}
