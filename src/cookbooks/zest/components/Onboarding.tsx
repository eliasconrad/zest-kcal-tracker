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
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ZoomIn,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
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
import { Selectable, SelectableText } from "./ui/Selectable";
import { FoodSticker, type StickerKind } from "./Stickers";
import { Thinking } from "./Thinking";
import { cardFloor, FIGURE, SCALE } from "../hooks/useScene";
import {
  activities,
  activityLabel,
  ageOf,
  allergens,
  birthDateProblem,
  MIN_AGE,
  dietLabel,
  diets,
  obstacles,
  parseBirthDate,
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
import { helperFor, helperLine, helperList, type HelperId } from "../data/helpers";
import { StaticHelper } from "./helpers/StaticHelper";
import { ArtIcon, PaceCurve, PlanOrbit, StepStage, TickBurst } from "./onboarding/Art";
import { Intro } from "./onboarding/Intro";
import { artAccent, type ArtId } from "./onboarding/drawings";
import {
  mealTypes,
  reminderTime,
  validEmail,
  type MealType,
} from "../data/diary";
import { askForReminders } from "../data/reminders";
import { AppleButton } from "./AccountSheet";
import { session } from "../state/useSession";
import { theme } from "../theme";
import type { Scene } from "../hooks/useScene";

export type OnboardingStep =
  | "intro"
| "name"
  | "helper"
  | "goal"
  | "body"
  | "target"
  | "activity"
  | "pace"
  | "diet"
  | "allergies"
  | "meals"
  | "obstacles"
  | "reminders"
  | "account"
  | "plan";

const order: OnboardingStep[] = [
  "intro",
  "name",
  "goal",
  "body",
  "target",
  "activity",
  "pace",
  "diet",
  "allergies",
  "meals",
  "obstacles",
  "reminders",
  "account",
  "plan",
];

/** The drawing beside each answer. */
const goalArt: Record<Goal, ArtId> = { lose: "scale", maintain: "balance", gain: "plateUp", muscle: "dumbbell" };
const activityArt: Record<string, ArtId> = { sedentary: "sofa", light: "sneaker", active: "dumbbell", athletic: "flame" };
const paceArt: Record<Pace, ArtId> = { slow: "leaf", steady: "sneaker", fast: "bolt" };
const dietArt: Record<string, ArtId> = { none: "utensils", vegetarian: "carrot", vegan: "leaf", pescatarian: "fish", halal: "moon", kosher: "star" };
const allergenArt: Record<string, ArtId> = {
  "Tree nuts": "nut",
  Peanuts: "peanut",
  Gluten: "wheat",
  Lactose: "milk",
  Egg: "egg",
  Soy: "soy",
  Fish: "fish",
  Shellfish: "shrimp",
  Sesame: "sesame",
};
const obstacleArt: Record<string, ArtId> = {
  "Not enough time": "stopwatch",
  "Eating out a lot": "cloche",
  Cravings: "cookie",
  "Losing motivation": "battery",
  "Not knowing what to eat": "question",
  "Counting felt like work": "calculator",
};
/** The props beside the mascot on each step. */
const stepProps: Partial<Record<OnboardingStep, ArtId[]>> = {
  name: ["door"],
  goal: ["hill", "scale"],
  body: ["ruler", "scale"],
  target: ["hill"],
  activity: ["sneaker", "dumbbell"],
  pace: ["stopwatch", "leaf"],
  diet: ["carrot", "fish"],
  allergies: ["peanut", "egg"],
  meals: ["plate", "utensils"],
  obstacles: ["cookie", "stopwatch"],
  reminders: ["bell", "phone"],
  account: ["key", "phone"],
  plan: ["clipboard", "plate"],
};

/** One line of the plan checks off per interval. */
const PLAN_ITEM_MS = 1500;
/** Eight characters, as the references ask; the lemon says so plainly. */
const PASSWORD_MIN = 8;
/** The keyboard toolbar and some air, so a focused field never sits under it. */
const KEYBOARD_CLEARANCE = 84;
/** Steps with several fields: the sheet rises over the mascot while the keyboard is up. */
const LIFTING_STEPS: OnboardingStep[] = ["body", "account"];

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
  onLift,
  onLogin,
  revealing = false,
  burst = false,
  onHelper,
}: {
  scene: Scene;
  profile: Profile;
  startAt?: OnboardingStep;
  /** Editing one step from the profile: save and close after that step. */
  editing?: boolean;
  /** The password travels beside the profile; it is kept in the keychain, not the store. */
  onDone: (fields: Partial<Profile>, secrets?: { password?: string }) => void;
  onCancel?: () => void;
  /** The sheet rose over the mascot for the keyboard, or came back down. */
  onLift?: (lifted: boolean) => void;
  /** "I already have an account": hands over to the account sheet. */
  onLogin?: () => void;
  /** The lemon is still hidden behind the sheet; no bubble yet. */
  revealing?: boolean;
  /** Food stickers scatter from the sheet edge as the lemon pops out. */
  burst?: boolean;
  /** A helper was tapped on its card: the companion on the sheet edge swaps at once. */
  onHelper?: (helper: HelperId) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [draft, setDraft] = useState<Profile>(profile);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [step, setStep] = useState<OnboardingStep>(startAt ?? "intro");
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
  // A step change needs 400 ms before the next; a repeated return key or a
  // double tap must not skip questions.
  const lastGo = useRef(0);
  const go = (direction: 1 | -1, fields: Partial<Profile> = {}) => {
    const now = Date.now();
    if (now - lastGo.current < 400) return;
    lastGo.current = now;
    Keyboard.dismiss();
    const secrets = { password: password || undefined };
    const finished = { ...draft, ...fields };
    if (editing) {
      if (direction === -1) onCancel?.();
      else onDone(finished, secrets);
      return;
    }
    const next = steps[index + direction];
    if (!next) {
      if (direction === 1) onDone(finished, secrets);
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
  /** The explanation came first; only now the system asks. A refusal simply means no reminders. */
  const acceptReminders = async () => {
    const granted = await askForReminders().catch(() => false);
    const reminders = granted ? draft.reminders : [];
    set({ reminders });
    go(1, { reminders });
  };
  const intro = step === "intro";
  const firstName = draft.name.trim().split(/\s+/)[0] || "";
  const helper = helperFor(draft.helper);
  const plain = editing
    ? "Let’s adjust that."
    : step === "name" || intro
      ? "Hi! I’m Zest."
      : step === "helper"
        ? helper.hello(firstName)
        : step === "goal"
          ? interlude
            ? firstName
              ? `Nice to meet you, ${firstName}!`
              : "Nice to meet you!"
            : helperLine(helper, "goal", "This sets your daily guide.")
        : step === "body"
          ? "Just the basics. No judgement."
          : step === "target"
            ? "Pick a number that feels kind."
            : step === "activity"
              ? "Honest answers make better guides."
              : step === "pace"
                ? "Steady wins. I’m patient."
                : step === "diet"
                  ? "Eat how you eat."
                  : step === "allergies"
                    ? "I’ll keep those off your plate."
                    : step === "meals"
                      ? "When does the kitchen open?"
                      : step === "obstacles"
                        ? "No shame. Just useful."
                        : step === "reminders"
                          ? "A small nudge, if you like."
                          : step === "account"
                            ? "Your diary, your key."
                            : preparing
                  ? "Working it out…"
                  : firstName
                    ? `Here’s your guide, ${firstName}.`
                    : "Here’s your guide.";
  // The helper speaks in its own voice where it has a line; the interlude,
  // the editing line and the plan-in-progress line stay as they are.
  const line =
    editing || preparing || step === "helper" || (step === "goal" && interlude)
      ? plain
      : helperLine(helper, step, plain);

  const ready = (() => {
    switch (step) {
      case "name":
        return draft.name.trim().length > 0;
      case "account":
        return (
          validEmail(draft.email) &&
          (password.length >= PASSWORD_MIN ||
            (editing && password.length === 0))
        );
      case "meals":
        return draft.usualMeals.length > 0;
      case "body":
        return (
          !!draft.birthDate &&
          draft.heightCm >= limits.heightCm.min &&
          draft.heightCm <= limits.heightCm.max &&
          draft.weightKg >= limits.weightKg.min &&
          draft.weightKg <= limits.weightKg.max
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
  // On a step with several fields the mascot makes room: there is too little left
  // between its feet and the keyboard to see the field being typed in.
  const lift = useSharedValue(intro ? 1 : 0);
  // The first screen has the whole sheet; the mascot arrives with the first question.
  useEffect(() => {
    if (!intro) return;
    lift.set(1);
    onLift?.(true);
    return () => {
      lift.set(withTiming(0, { duration: scene.reduced ? 0 : 300, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
      onLift?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intro]);
  const canLift = LIFTING_STEPS.includes(step);
  useEffect(() => {
    if (!canLift) return;
    const move = (up: boolean) => {
      lift.set(withTiming(up ? 1 : 0, { duration: scene.reduced ? 0 : 250, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
      onLift?.(up);
    };
    const show = Keyboard.addListener("keyboardWillShow", () => move(true));
    const hide = Keyboard.addListener("keyboardWillHide", () => move(false));
    return () => {
      show.remove();
      hide.remove();
      move(false);
    };
    // onLift is a stable setter from the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLift, lift, scene.reduced]);
  const liftedTop = scene.top + 52;
  const panelLift = useAnimatedStyle(() => ({
    top: panelTop + (liftedTop - panelTop) * lift.get(),
  }));
  const bubbleFade = useAnimatedStyle(() => ({ opacity: 1 - lift.get() }));
  const current = plan(
    {
      sex: draft.sex,
      birthYear: draft.birthYear,
      birthDate: draft.birthDate,
      heightCm: draft.heightCm,
      weightKg: draft.weightKg,
    },
    draft.goal,
    draft.activity,
    draft.pace,
    new Date(),
    draft.diet,
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
      {burst && !scene.reduced && (
        <RevealBurst top={cardFloor(height) - 30} right={48} />
      )}
      <Animated.View
        pointerEvents="none"
        style={[{ position: "absolute", inset: 0 }, bubbleFade]}
      >
        <LemonBubble
          speaker={helper.name}
          text={revealing ? "" : line}
          thinking={false}
          top={cardFloor(height) - FIGURE.hero * SCALE.card - 8}
          right={118}
          reduced={scene.reduced}
        />
        {!editing && stepProps[step] && (
          <StepStage
            key={step}
            props={stepProps[step]}
            floor={panelTop}
            reduced={scene.reduced}
          />
        )}
      </Animated.View>
      <Animated.View
        entering={scene.reduced ? undefined : FadeIn.duration(260)}
        exiting={scene.reduced ? undefined : FadeOut.duration(200)}
        style={[
          {
            position: "absolute",
            left: 16,
            right: 16,
            bottom: insets.bottom + 16,
          },
          panelLift,
        ]}
      >
        <GlassSurface style={{ flex: 1, borderRadius: 36 }}>
          <View style={{ flex: 1, borderRadius: 36, overflow: "hidden" }}>
            {!intro && (
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
                  layout={scene.reduced ? undefined : LinearTransition.duration(320)}
                  style={{
                    width: `${editing ? 100 : ((index + 1) / steps.length) * 100}%`,
                    height: "100%",
                    borderRadius: 2,
                    backgroundColor: theme.ink,
                  }}
                />
              </View>
            </View>
            )}
            {/* The list scrolls the focused field above the keyboard and its toolbar;
                the button stays under it, so a long list never pushes it off the screen. */}
            <KeyboardAwareScrollView
              ref={scroll}
              bottomOffset={KEYBOARD_CLEARANCE}
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
                entering={scene.reduced ? undefined : FadeIn.duration(220)}
                exiting={scene.reduced ? undefined : FadeOut.duration(120)}
              >
                {interlude && step === "goal" && (
                  <Question
                    title={
                      <Typewriter
                        text={
                          firstName
                            ? `Nice to meet you, ${firstName}.`
                            : "Nice to meet you."
                        }
                        reduced={scene.reduced}
                      />
                    }
                    detail="Three short questions, then a guide that fits you."
                  >
                    <View style={{ alignItems: "center", minHeight: 120 }}>
                      <FoodSticker kind="Breakfast" size={110} angle={-6} />
                    </View>
                  </Question>
                )}
                {intro && <Intro height={Math.max(240, height - insets.top - insets.bottom - 415)} />}
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
                      autoCorrect={false}
                      spellCheck={false}
                      textContentType="givenName"
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
                {step === "helper" && (
                  <Question
                    title="Pick your mascot"
                    detail="The lemon, or one of six friends. The app icon changes with your pick. Hold your mascot on the home screen to swap any time."
                  >
                    <HelperGrid
                      // Sheet inset 16 and content padding 22 on both sides, two 10 pt gaps.
                      cardWidth={Math.floor((width - 76 - 20) / 3)}
                      selected={helperFor(draft.helper).id}
                      onPick={(id) => {
                        update({ helper: id });
                        onHelper?.(id);
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
                        art={goalArt[goal]}
                        order={goals.indexOf(goal)}
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
                    <BirthDateField
                      draft={draft}
                      onChange={(birthDate, birthYear) =>
                        set({ birthDate, birthYear })
                      }
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
                        art={activityArt[activity]}
                        order={activities.indexOf(activity)}
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
                {step === "diet" && (
                  <Question
                    title="Do you follow a way of eating?"
                    detail="It shifts your macros and what I’ll suggest."
                  >
                    {diets.map((diet) => (
                      <Choice
                        key={diet}
                        label={dietLabel[diet]}
                        art={dietArt[diet]}
                        order={diets.indexOf(diet)}
                        selected={draft.diet === diet}
                        onPress={() => update({ diet })}
                      />
                    ))}
                  </Question>
                )}
                {step === "allergies" && (
                  <Question
                    title="Anything your body says no to?"
                    detail="Pick any that apply, or none. I won’t suggest them, but always check a label yourself."
                  >
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {allergens.map((item) => (
                        <TagChip
                          key={item}
                          label={item}
                          art={allergenArt[item]}
                          selected={draft.allergies.includes(item)}
                          onPress={() =>
                            update({ allergies: toggle(draft.allergies, item) })
                          }
                        />
                      ))}
                    </View>
                    <TextField
                      label="Other"
                      value={draft.allergyNote}
                      onChange={(allergyNote) => set({ allergyNote })}
                      placeholder="Something else"
                      capitalize
                    />
                  </Question>
                )}
                {step === "meals" && (
                  <Question
                    title="Which meals are usually yours?"
                    detail="The camera starts on the right one for the time of day."
                  >
                    {mealTypes.map((meal) => (
                      <Choice
                        key={meal}
                        label={meal}
                        leading={<FoodSticker kind={meal} size={36} angle={-4} />}
                        order={mealTypes.indexOf(meal)}
                        selected={draft.usualMeals.includes(meal)}
                        onPress={() =>
                          update({
                            usualMeals: toggle(draft.usualMeals, meal),
                            reminders: draft.reminders.filter((r) => r !== meal),
                          })
                        }
                      />
                    ))}
                  </Question>
                )}
                {step === "obstacles" && (
                  <Question
                    title="What got in the way before?"
                    detail="Pick any, or none. It only changes what I say to you."
                  >
                    {obstacles.map((item) => (
                      <Choice
                        key={item}
                        label={item}
                        art={obstacleArt[item]}
                        order={obstacles.indexOf(item)}
                        selected={draft.pastObstacles.includes(item)}
                        onPress={() =>
                          update({
                            pastObstacles: toggle(draft.pastObstacles, item),
                          })
                        }
                      />
                    ))}
                  </Question>
                )}
                {step === "reminders" && (
                  <Question
                    title="Want a nudge at mealtimes?"
                    detail="One quiet line per meal. Streaks are easier when something reminds you."
                  >
                    <NudgePreview helper={draft.helper} name={helper.name} />
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {draft.usualMeals.map((meal) => (
                        <TagChip
                          key={meal}
                          label={`${meal} ${reminderLabel(meal)}`}
                          selected={draft.reminders.includes(meal)}
                          onPress={() =>
                            update({ reminders: toggle(draft.reminders, meal) })
                          }
                        />
                      ))}
                    </View>
                  </Question>
                )}
                {step === "account" && (
                  <Question
                    title="Keep your diary yours"
                    detail="An account lets your diary follow you to a new phone and lets friends find you. You can also start without one."
                  >
                    {!editing && (
                      <AppleButton
                        onDone={() => {
                          go(1, { email: session.user()?.email ?? draft.email });
                        }}
                        onError={setAccountError}
                      />
                    )}
                    <TextField
                      label="E-mail"
                      value={draft.email}
                      onChange={(email) => set({ email })}
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      autoComplete="email"
                      autoFocus={!editing || !draft.email}
                    />
                    <TextField
                      label="Password"
                      value={password}
                      onChange={setPassword}
                      placeholder={editing ? "Unchanged" : `${PASSWORD_MIN}+ characters`}
                      secure={!showPassword}
                      textContentType="none"
                      autoComplete="off"
                      trailing={{
                        icon: showPassword ? "eye.slash" : "eye",
                        label: showPassword ? "Hide password" : "Show password",
                        onPress: () => setShowPassword((v) => !v),
                      }}
                    />
                    {!!accountError && (
                      <Text style={{ color: "#A63A26", fontSize: 14 }}>
                        {accountError}
                      </Text>
                    )}
                    {password.length > 0 && password.length < PASSWORD_MIN && (
                      <Text
                        style={{ color: theme.muted, fontSize: 13, marginTop: 2 }}
                      >
                        {PASSWORD_MIN - password.length} more to go.
                      </Text>
                    )}
                  </Question>
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
            </KeyboardAwareScrollView>
            <View style={{ paddingHorizontal: 22, paddingTop: 10, paddingBottom: 12 }}>
              {preparing ? null : intro ? (
                <View style={{ gap: 2 }}>
                  <ContinueButton
                    label="Get started"
                    ready
                    reduced={scene.reduced}
                    onPress={() => go(1)}
                  />
                  {onLogin && (
                    <Touch
                      label="I already have an account"
                      onPress={onLogin}
                      style={{ height: 44, alignItems: "center", justifyContent: "center" }}
                    >
                      <Text style={{ fontSize: 15, color: theme.muted }}>
                        I already have an account
                      </Text>
                    </Touch>
                  )}
                </View>
              ) : step === "plan" && !editing && !preparing ? (
                <HoldToStart reduced={scene.reduced} onCommit={() => go(1)} />
              ) : step === "account" && !editing ? (
                <View style={{ gap: 2 }}>
                  <ContinueButton
                    label="Continue"
                    ready={ready}
                    reduced={scene.reduced}
                    onPress={() => go(1)}
                  />
                  <Touch
                    label="Skip for now"
                    onPress={() => {
                      setPassword("");
                      set({ email: "" });
                      go(1, { email: "" });
                    }}
                    style={{
                      height: 44,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 15, color: theme.muted }}>
                      Skip for now
                    </Text>
                  </Touch>
                  {onLogin && (
                    <Touch
                      label="I already have an account"
                      onPress={onLogin}
                      style={{
                        height: 44,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 15, color: theme.muted }}>
                        I already have an account
                      </Text>
                    </Touch>
                  )}
                </View>
              ) : step === "reminders" ? (
                <View style={{ gap: 6 }}>
                  <ContinueButton
                    label="Remind me"
                    ready={draft.reminders.length > 0}
                    reduced={scene.reduced}
                    onPress={() => void acceptReminders()}
                  />
                  <Touch
                    label="Not now"
                    onPress={() => {
                      set({ reminders: [] });
                      go(1, { reminders: [] });
                    }}
                    style={{
                      height: 44,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 15, color: theme.muted }}>
                      Not now
                    </Text>
                  </Touch>
                </View>
              ) : (
                <ContinueButton
                  label={
                    step === "plan" ? "Save" : editing ? "Save" : "Continue"
                  }
                  ready={ready}
                  reduced={scene.reduced}
                  onPress={() => go(1)}
                />
              )}
            </View>
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

/**
 * Two rows of three: a still drawing, the name, the role. The chosen card
 * turns heavy like every other choice on the sheet; the pitch line under the
 * grid is the helper's own, so the voice is heard before it is picked.
 */
function HelperGrid({
  cardWidth,
  selected,
  onPick,
}: {
  cardWidth: number;
  selected: HelperId;
  onPick: (id: HelperId) => void;
}) {
  const chosen = helperFor(selected);
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {helperList.map((helper) => {
          const on = helper.id === selected;
          return (
            <Touch
              key={helper.id}
              label={`${helper.name} the ${helper.species}, ${helper.role}`}
              onPress={() => onPick(helper.id)}
              selected={on}
              style={{ width: cardWidth }}
            >
              <View
                style={{
                  borderRadius: 20,
                  borderCurve: "continuous",
                  paddingTop: 10,
                  paddingBottom: 12,
                  alignItems: "center",
                  backgroundColor: on ? theme.heavy : "#FFFFFF",
                }}
              >
                <StaticHelper id={helper.id} size={72} frame={on ? "cheer" : "idle"} />
                <Text
                  style={{
                    marginTop: 2,
                    fontSize: 15,
                    fontWeight: "600",
                    letterSpacing: -0.2,
                    color: on ? theme.onHeavy : theme.ink,
                  }}
                >
                  {helper.name}
                </Text>
                <Text style={{ fontSize: 12, marginTop: 1, color: on ? "#D9DAD3" : theme.muted }}>
                  {helper.role}
                </Text>
              </View>
            </Touch>
          );
        })}
      </View>
      <Text
        key={chosen.id}
        accessibilityLiveRegion="polite"
        style={{ fontSize: 15, lineHeight: 21, color: theme.muted, fontStyle: "italic" }}
      >
        “{chosen.pitch}”
      </Text>
    </View>
  );
}

function toggle<T>(list: T[], item: T) {
  return list.includes(item)
    ? list.filter((value) => value !== item)
    : [...list, item];
}

function reminderLabel(meal: MealType) {
  const [hour, minute] = reminderTime[meal];
  return `${hour}:${String(minute).padStart(2, "0")}`;
}

/** Day, month and year as three small fields; the age appears once the date is real. */
function BirthDateField({
  draft,
  onChange,
}: {
  draft: Profile;
  onChange: (birthDate: string, birthYear: number) => void;
}) {
  const [y, m, d] = draft.birthDate ? draft.birthDate.split("-") : [];
  const [day, setDay] = useState(d ? String(Number(d)) : "");
  const [month, setMonth] = useState(m ? String(Number(m)) : "");
  const [year, setYear] = useState(
    y ?? (draft.onboarded ? String(draft.birthYear) : ""),
  );
  const commit = (nextDay: string, nextMonth: string, nextYear: string) => {
    const iso = parseBirthDate(Number(nextDay), Number(nextMonth), Number(nextYear));
    onChange(iso ?? "", iso ? Number(nextYear) : draft.birthYear);
  };
  const part = (
    label: string,
    placeholder: string,
    value: string,
    width: number,
    set: (text: string) => void,
  ) => (
    <TextInput
      accessibilityLabel={label}
      placeholder={placeholder}
      placeholderTextColor={theme.faint}
      value={value}
      onChangeText={(text) => set(text.replace(/\D/g, ""))}
      keyboardType="number-pad"
      selectTextOnFocus
      maxLength={placeholder.length}
      // Tabular digits on an empty field drop the placeholder below its baseline
      // while it has focus, so they only come in with the first digit.
      style={{
        width,
        height: 44,
        fontSize: 26,
        fontWeight: "500",
        color: theme.ink,
        fontVariant: value ? ["tabular-nums"] : undefined,
        paddingVertical: 0,
      }}
    />
  );
  // Only once the date is finished: nobody should be told off halfway through typing.
  const problem =
    day && month && year.length === 4
      ? birthDateProblem(Number(day), Number(month), Number(year))
      : null;
  return (
    <View>
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 0.5,
        borderColor: problem ? "#A63A26" : theme.line,
        minHeight: 56,
      }}
    >
      <View accessible={false} style={{ width: 104 }}>
        <Text style={{ fontSize: 15, color: theme.muted }}>Born</Text>
        {!!draft.birthDate && (
          <Text style={{ fontSize: 13, color: theme.faint, marginTop: 1 }}>
            {ageOf(draft)} years
          </Text>
        )}
      </View>
      <View style={{ flex: 1, flexDirection: "row", gap: 8 }}>
        {part("Birth day", "DD", day, 48, (text) => {
          setDay(text);
          commit(text, month, year);
        })}
        {part("Birth month", "MM", month, 56, (text) => {
          setMonth(text);
          commit(day, text, year);
        })}
        {part("Birth year", "YYYY", year, 84, (text) => {
          setYear(text);
          commit(day, month, text);
        })}
      </View>
    </View>
    {problem && (
      <Animated.Text
        entering={FadeIn.duration(160)}
        accessibilityLiveRegion="polite"
        style={{ fontSize: 14, lineHeight: 19, color: "#A63A26", marginTop: 8 }}
      >
        {problem === "young"
          ? `Zest is for people ${MIN_AGE} and over. A calorie plan isn’t made for a body that’s still growing.`
          : "That date doesn’t look right. Check the day, month and year."}
      </Animated.Text>
    )}
    </View>
  );
}

/** A compact on-off chip for lists that may wrap. */
function TagChip({
  label,
  art,
  selected,
  onPress,
}: {
  label: string;
  art?: ArtId;
  selected: boolean;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  return (
    <Touch
      label={label}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      selected={selected}
      expand
    >
      <View
        style={{
          height: 48,
          borderRadius: 24,
          paddingLeft: art ? 10 : 16,
          paddingRight: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: selected ? "#FFFFFF" : "#2527200A",
          boxShadow: selected ? "0 4px 14px rgba(37, 39, 32, 0.10)" : undefined,
        }}
      >
        {art && <ArtIcon id={art} size={28} />}
        <Text style={{ fontSize: 15, fontWeight: "500", color: theme.ink }}>
          {label}
        </Text>
        {selected && <Symbol name="checkmark" size={11} weight="bold" color={theme.accent} />}
        {selected && (
          <TickBurst color={art ? artAccent(art) : theme.soft} reduced={reduced} />
        )}
      </View>
    </Touch>
  );
}

/** The primary button settles between dim and ready over 220 ms rather than snapping. */
function ContinueButton({
  label,
  ready,
  reduced,
  onPress,
}: {
  label: string;
  ready: boolean;
  reduced: boolean;
  onPress: () => void;
}) {
  const enabled = useSharedValue(ready ? 1 : 0);
  useEffect(() => {
    enabled.set(
      reduced ? (ready ? 1 : 0) : withTiming(ready ? 1 : 0, { duration: 220 }),
    );
  }, [ready, reduced, enabled]);
  const fade = useAnimatedStyle(() => ({
    opacity: 0.35 + enabled.get() * 0.65,
  }));
  return (
    <Animated.View style={fade}>
      <Touch
        label={label}
        onPress={onPress}
        disabled={!ready}
        style={{
          height: 52,
          borderRadius: 26,
          backgroundColor: theme.heavy,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "600", color: "white" }}>
          {label}
        </Text>
      </Touch>
    </Animated.View>
  );
}

/** A labelled text row in the same hairline style as the number fields. */
function TextField({
  label,
  value,
  onChange,
  placeholder,
  secure = false,
  autoFocus = false,
  capitalize = false,
  keyboardType,
  textContentType,
  autoComplete,
  trailing,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  secure?: boolean;
  autoFocus?: boolean;
  capitalize?: boolean;
  keyboardType?: React.ComponentProps<typeof TextInput>["keyboardType"];
  textContentType?: React.ComponentProps<typeof TextInput>["textContentType"];
  autoComplete?: React.ComponentProps<typeof TextInput>["autoComplete"];
  trailing?: { icon: "eye" | "eye.slash"; label: string; onPress: () => void };
}) {
  const input = useRef<TextInput>(null);
  return (
    // The eye toggle is a sibling of the focusing row, not a child: a Touch
    // inside the row's Pressable never received its tap.
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 0.5,
        borderColor: theme.line,
        minHeight: 56,
      }}
    >
      <Pressable
        accessible={false}
        onPress={() => input.current?.focus()}
        style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
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
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={theme.faint}
          secureTextEntry={secure}
          autoFocus={autoFocus}
          autoCapitalize={capitalize ? "sentences" : "none"}
          autoCorrect={false}
          spellCheck={false}
          keyboardType={keyboardType}
          textContentType={textContentType}
          autoComplete={autoComplete}
          returnKeyType="next"
          style={{
            flex: 1,
            fontSize: 19,
            fontWeight: "500",
            color: theme.ink,
            paddingVertical: 8,
          }}
        />
      </Pressable>
      {trailing && (
        <Touch
          label={trailing.label}
          onPress={trailing.onPress}
          style={{
            width: 40,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Symbol name={trailing.icon} size={16} color={theme.muted} />
        </Touch>
      )}
    </View>
  );
}

function Question({
  title,
  detail,
  children,
}: React.PropsWithChildren<{ title: React.ReactNode; detail?: string }>) {
  return (
    <View>
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.4}
        style={{
          fontSize: 28,
          lineHeight: 33,
          fontWeight: "700",
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
  art,
  leading,
  order = 0,
  selected,
  onPress,
}: {
  label: string;
  detail?: string;
  art?: ArtId;
  leading?: React.ReactNode;
  /** Rows rise one after the other, 70 ms apart. */
  order?: number;
  selected: boolean;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={
        reduced
          ? undefined
          : FadeInDown.delay(60 + order * 70)
              .duration(300)
              .easing(Easing.bezier(0.23, 1, 0.32, 1))
              .withInitialValues({ opacity: 0, transform: [{ translateY: 14 }] })
      }
    >
      <Touch
        label={label}
        onPress={() => {
          void Haptics.selectionAsync();
          onPress();
        }}
        expand
        selected={selected}
      >
        <View
          style={{
            minHeight: 62,
            borderRadius: 22,
            borderCurve: "continuous",
            paddingLeft: 14,
            paddingRight: 14,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            backgroundColor: selected ? "#FFFFFF" : "#2527200A",
            boxShadow: selected ? "0 6px 18px rgba(37, 39, 32, 0.10)" : undefined,
          }}
        >
          {art ? <ArtIcon id={art} size={34} /> : leading}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: "600", letterSpacing: -0.2, color: theme.ink }}>
              {label}
            </Text>
            {detail && (
              <Text style={{ fontSize: 13, marginTop: 2, color: theme.muted }}>
                {detail}
              </Text>
            )}
          </View>
          <Radio selected={selected} />
          {selected && (
            <TickBurst color={art ? artAccent(art) : theme.soft} reduced={reduced} />
          )}
        </View>
      </Touch>
    </Animated.View>
  );
}

function Radio({ selected }: { selected: boolean }) {
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: selected ? 0 : 1.5,
        borderColor: "#25272030",
        backgroundColor: selected ? theme.accent : "transparent",
      }}
    >
      {selected && (
        <Animated.View entering={ZoomIn.duration(160)}>
          <Symbol name="checkmark" size={12} weight="bold" color="#FFFFFF" />
        </Animated.View>
      )}
    </View>
  );
}

/** What a reminder will look like, before the system asks. */
function NudgePreview({ helper, name }: { helper: HelperId; name: string }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(120).duration(320)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 12,
        borderRadius: 20,
        borderCurve: "continuous",
        backgroundColor: "#FFFFFF",
        boxShadow: "0 6px 18px rgba(37, 39, 32, 0.08)",
      }}
    >
      <StaticHelper id={helper} size={42} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: theme.ink }}>{name}</Text>
        <Text style={{ fontSize: 14, color: theme.muted }}>
          Lunch? One photo is enough.
        </Text>
      </View>
      <Text style={{ fontSize: 12, color: theme.faint }}>now</Text>
    </Animated.View>
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
      <Selectable
        selected={selected}
        style={{
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SelectableText
          numberOfLines={1}
          style={{ fontSize: 13, fontWeight: "500" }}
        >
          {label}
        </SelectableText>
      </Selectable>
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
  const reduced = useReducedMotion();
  const [chartWidth, setChartWidth] = useState(0);
  const weeks = weeksToTarget(draft.weightKg, draft.targetWeightKg, draft.pace);
  const eta = targetDate(weeks);
  const current = plan(
    {
      sex: draft.sex,
      birthYear: draft.birthYear,
      birthDate: draft.birthDate,
      heightCm: draft.heightCm,
      weightKg: draft.weightKg,
    },
    draft.goal,
    draft.activity,
    draft.pace,
    new Date(),
    draft.diet,
  );
  return (
    <Question
      title="How quickly?"
      detail="A steadier pace is easier to keep. The lemon is patient."
    >
      <View onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}>
        {chartWidth > 0 && (
          <PaceCurve
            from={draft.weightKg}
            to={draft.targetWeightKg}
            fromLabel={`Today · ${formatWeight(draft.weightKg, draft.units)}`}
            toLabel={`${formatWeight(draft.targetWeightKg, draft.units)} · ${eta.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
            width={chartWidth}
            reduced={reduced}
          />
        )}
      </View>
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
                paddingVertical: 12,
                alignItems: "center",
                backgroundColor: draft.pace === pace ? theme.heavy : "#FFFFFF",
              }}
            >
              <View style={{ marginBottom: 4 }}>
                <ArtIcon id={paceArt[pace]} size={28} />
              </View>
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
  const reduced = useReducedMotion();
  if (preparing)
    return (
      <Question
        title="Working it out…"
        detail="Adding up your body, your days and your goal."
      >
        <PlanOrbit duration={items.length * PLAN_ITEM_MS + 400} reduced={reduced} />
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
                  minHeight: 36,
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
    { label: "Protein", value: p.protein, art: "egg" as const },
    { label: "Carbs", value: p.carbs, art: "wheat" as const },
    { label: "Fat", value: p.fat, art: "nut" as const },
  ];
  return (
    <Question
      title={`${draft.name.trim() || "There"}, here’s your guide.`}
      detail="An estimate to lean on, not a grade or medical advice. Edit it any time from your profile."
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
            <View style={{ marginBottom: 6 }}>
              <ArtIcon id={row.art} size={30} />
            </View>
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
  speaker = "Zest",
  text,
  thinking,
  top,
  right,
  reduced,
}: {
  speaker?: string;
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
        thinking ? `${speaker} is working it out` : `${speaker} says: ${text}`
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

/**
 * Three stickers fly out of the sheet edge as the lemon pops up, the way
 * BitePal's banana and fish bones leave the can: 0.8 s arcs, then they fade.
 */
function RevealBurst({ top, right }: { top: number; right: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }));
  }, [p]);
  const pieces: {
    kind: StickerKind;
    dir: number;
    lift: number;
    spin: number;
  }[] = [
    { kind: "Snack", dir: -1, lift: 150, spin: -40 },
    { kind: "Breakfast", dir: -0.45, lift: 190, spin: 25 },
    { kind: "Lunch", dir: 0.35, lift: 120, spin: 50 },
  ];
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      style={{ position: "absolute", top, right, width: 160, height: 160 }}
    >
      {pieces.map((piece) => (
        <Piece key={piece.kind} progress={p} {...piece} />
      ))}
    </View>
  );
}

function Piece({
  progress,
  kind,
  dir,
  lift,
  spin,
}: {
  progress: SharedValue<number>;
  kind: StickerKind;
  dir: number;
  lift: number;
  spin: number;
}) {
  const style = useAnimatedStyle(() => {
    const t = progress.get();
    return {
      opacity: t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3),
      transform: [
        { translateX: dir * 120 * t },
        { translateY: -lift * Math.sin(t * Math.PI) + 70 * t },
        { rotate: `${spin * t}deg` },
        { scale: 0.5 + 0.5 * Math.min(1, t * 5) },
      ],
    };
  });
  return (
    <Animated.View
      style={[{ position: "absolute", right: 40, top: 60 }, style]}
    >
      <FoodSticker kind={kind} size={46} />
    </Animated.View>
  );
}

/** A title that types in one word every 170 ms, as BitePal's "Let's meet your virtual pet!" does. */
function Typewriter({ text, reduced }: { text: string; reduced: boolean }) {
  const words = text.split(" ");
  const [shown, setShown] = useState(reduced ? words.length : 0);
  useEffect(() => {
    if (reduced || shown >= words.length) return;
    const timer = setTimeout(() => setShown((n) => n + 1), 170);
    return () => clearTimeout(timer);
  }, [shown, words.length, reduced]);
  return (
    <Text accessibilityLabel={text}>
      {words.map((word, i) => (
        <Text key={i} style={{ opacity: i < shown ? 1 : 0 }}>
          {word}
          {i < words.length - 1 ? " " : ""}
        </Text>
      ))}
    </Text>
  );
}

/**
 * Hold to commit, YAZIO's closing gesture: a fill grows across the button for
 * 1.3 s (about 40 frames in the recording) and releases into the diary.
 * Letting go early springs it back. With Reduce Motion a tap is enough.
 */
function HoldToStart({
  reduced,
  onCommit,
}: {
  reduced: boolean;
  onCommit: () => void;
}) {
  const HOLD_MS = 1300;
  const fill = useSharedValue(0);
  const done = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = () => {
    if (done.current) return;
    if (reduced) {
      done.current = true;
      onCommit();
      return;
    }
    void Haptics.selectionAsync();
    fill.set(withTiming(1, { duration: HOLD_MS, easing: Easing.linear }));
    timer.current = setTimeout(() => {
      done.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCommit();
    }, HOLD_MS);
  };
  const cancel = () => {
    if (done.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    fill.set(withTiming(0, { duration: 220 }));
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const grow = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Start logging"
      accessibilityHint="Touch and hold for a moment"
      onPressIn={start}
      onPressOut={cancel}
      style={{
        height: 52,
        borderRadius: 26,
        backgroundColor: theme.heavy,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            backgroundColor: theme.soft,
          },
          grow,
        ]}
      />
      <Text style={{ fontSize: 16, fontWeight: "600", color: "white" }}>
        Hold to start logging
      </Text>
    </Pressable>
  );
}
