import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Keyboard, Pressable, Text, View } from "react-native";
import {
  KeyboardController,
  KeyboardEvents,
} from "react-native-keyboard-controller";
import { scheduleOnRN } from "react-native-worklets";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { File, Paths } from "expo-file-system";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedReaction,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  GlassThemeProvider,
  GlassSurface,
} from "../components/ui/GlassSurface";
import { GlassButton } from "../components/ui/GlassButton";
import { ProgressiveBlur } from "../components/ui/ProgressiveBlur";
import { Symbol, Touch } from "../components/ui/Touch";
import { useScene } from "../hooks/useScene";
import { ZestBackdrop } from "../components/Backdrop";
import { Lemon } from "../components/Lemon";
import { ZestComposer } from "../components/Composer";
import { CalorieCalendar } from "../components/Calendar";
import { MealEditor, type EditRequest } from "../components/MealEditor";
import { useDiary } from "../state/useDiary";
import {
  answerAbout,
  dayKey,
  intakeMood,
  totalOn,
  sampleEstimates,
  type Meal,
  type MealPhoto,
  type MealType,
} from "../data/diary";
import { theme } from "../theme";
import { MealPhotosProvider } from "../data/photos";
import { MealCamera } from "../components/MealCamera";
import { clearPassword, hasPassword, savePassword } from "../state/secrets";
import { ZestChatScroll } from "../components/ChatScroll";
import { CHOICE_RETIRE_MS } from "../components/MealReply";

import { ChatTurn } from "../components/ChatTurn";
import type { Turn } from "../data/conversation";
import { ApiError, apiConfigured, askZest, estimateMeal } from "../data/api";
import { diaryContext } from "../data/context";
import { isDiaryQuestion } from "../data/replies";
import { useProfile } from "../state/useProfile";
import { profilePlan, type Profile } from "../state/profileStore";
import { Onboarding, type OnboardingStep } from "../components/Onboarding";
import { ProfileSheet } from "../components/Profile";
import { goalLabel, loggedThisWeek, streak } from "../data/nutrition";
import { StreakCelebration } from "../components/Streak";
import { loggedDays, relativeDay } from "../data/diary";

/** Short, honest copy for the two ways a model call can fail. */
function failureText(error: unknown) {
  const kind = error instanceof ApiError ? error.kind : "server";
  return kind === "offline"
    ? "I can’t reach the kitchen right now. Check your connection and try again."
    : "Something went wrong on my side. Try again in a moment.";
}

function greetingFor(date: Date) {
  const hour = date.getHours();
  return hour < 5
    ? "Still up"
    : hour < 12
      ? "Good morning"
      : hour < 18
        ? "Good afternoon"
        : "Good evening";
}

let eventSequence = 0;
/** Called by event handlers; the sequence also distinguishes rapid attachments. */
function eventId(prefix: string) {
  return `${prefix}-${Date.now()}-${++eventSequence}`;
}
export function ZestScreen({
  demo = false,
  displayName = "Jaimin",
}: {
  demo?: boolean;
  displayName?: string;
}) {
  const scene = useScene();
  const meals = useDiary((s) => s.meals);
  const guide = useDiary((s) => s.guide);
  const profile = useProfile((s) => s);
  const plan = profilePlan(profile);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [calendar, setCalendar] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  /** First-launch setup, or one step re-opened from the profile. */
  /** A two-word tag from the lemon right after setup, like the references' "You're awesome!" */
  const [tag, setTag] = useState("");
  /** Streak celebration after the first logged meal of a day; plays once per day. */
  const [celebration, setCelebration] = useState<{
    from: number;
    to: number;
  } | null>(null);
  const celebrateIfNewDay = (before: Meal[]) => {
    const today = dayKey();
    const after = useDiary.getState().meals;
    const hadToday = before.some((m) => m.date === today);
    if (hadToday || useProfile.getState().celebratedDay === today) return;
    const from = streak(loggedDays(before), relativeDay(-1), relativeDay(-2));
    const to = streak(loggedDays(after), today, relativeDay(-1));
    useProfile.getState().save({ celebratedDay: today });
    // Duolingo shows the streak 0.7 s after the lesson-complete card settles.
    later(() => setCelebration({ from, to: Math.max(1, to) }), 700);
  };
  const [setup, setSetup] = useState<{
    step?: OnboardingStep;
    editing: boolean;
  } | null>(() => (!profile.onboarded && !demo ? { editing: false } : null));
  const [photoMenu, setPhotoMenu] = useState(false);
  /** The branded camera: live feed, or the bundled plate for the demo and simulators. */
  const [camera, setCamera] = useState<"live" | "sample" | null>(null);
  const [passwordSet, setPasswordSet] = useState(false);
  useEffect(() => {
    void hasPassword().then(setPasswordSet);
  }, []);
  const [editor, setEditor] = useState<EditRequest | null>(null);
  const [focused, setFocused] = useState(false);
  const [inputHeight, setInputHeight] = useState(108);
  const [conversation, setConversation] = useState(0);
  const generation = useRef(0);
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const pending = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** The one in-flight model request; stop/new-conversation abort it. */
  const request = useRef<AbortController | null>(null);
  const list = useRef<FlashListRef<Turn>>(null);
  const touching = useRef(false);
  const touches = useRef(0);
  const hasTurns = turns.length > 0;
  const {
    pick,
    perch,
    dockY,
    composerHeight,
    energy,
    mood,
    release,
    expression,
  } = scene;
  const clearTimers = useCallback(() => {
    pending.current.forEach(clearTimeout);
    pending.current = [];
    request.current?.abort();
    request.current = null;
  }, []);
  useEffect(() => clearTimers, [clearTimers]);
  const beginRequest = () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    return controller;
  };
  const endRequest = (controller: AbortController) => {
    if (request.current === controller) request.current = null;
  };
  useEffect(() => {
    if (demo) useDiary.getState().seedDemo();
    // The showcase skips setup; a default profile keeps the greeting and guide stable.
    if (demo && !useProfile.getState().onboarded)
      useProfile.getState().save({ onboarded: true, name: displayName });
  }, [demo, displayName]);
  // The sheet sits where the calendar sits; the lemon climbs onto it the same way.
  /**
   * First launch: the lemon is hidden behind the sheet and revealed the way
   * BitePal's pet leaves its can, measured at 30 fps: a 0.3 s peek, a 1.0 s
   * pause with a wobble, a 0.07 s pop, 0.5 s to settle, scattered food for
   * 0.8 s. Editing from the profile and Reduce Motion skip all of it.
   */
  const [revealing, setRevealing] = useState(
    () => !profile.onboarded && !demo && !scene.reduced,
  );
  const [burst, setBurst] = useState(false);
  // A cold start can sit on a blank frame for seconds before the first draw;
  // the reveal waits until frames are actually being produced.
  const [live, setLive] = useState(false);
  useAnimatedReaction(
    () => scene.frames.get() >= 6,
    (ready, before) => {
      if (ready && !before) scheduleOnRN(setLive, true);
    },
  );
  // Never let the reveal wait forever if frame reporting is unavailable.
  useEffect(() => {
    if (!revealing || live) return;
    const fallback = setTimeout(() => setLive(true), 4000);
    return () => clearTimeout(fallback);
  }, [revealing, live]);
  useEffect(() => {
    if (!setup) return;
    if (setup.editing || scene.reduced || !revealing) {
      scene.reveal.set(1);
      pick.set(withSpring(1, { damping: 26, stiffness: 180, mass: 0.9 }));
      return;
    }
    scene.reveal.set(0);
    pick.set(withSpring(1, { damping: 26, stiffness: 180, mass: 0.9 }));
    if (!live) return;
    const peek = setTimeout(() => {
      // The leaf shows above the edge (lid lifts), then sinks back (wobble).
      scene.reveal.set(
        withSequence(
          withTiming(0.44, { duration: 300 }),
          withTiming(0.3, { duration: 300 }),
          withTiming(0.38, { duration: 200 }),
          withTiming(0.3, { duration: 200 }),
        ),
      );
    }, 600);
    const pop = setTimeout(() => {
      scene.reveal.set(
        withSpring(1, { damping: 14, stiffness: 420, mass: 0.7 }),
      );
      scene.hop.set(
        withSequence(
          withTiming(0.5, { duration: 70 }),
          withTiming(0, { duration: 430 }),
        ),
      );
      setBurst(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 1600);
    const settle = setTimeout(() => setRevealing(false), 2200);
    const clear = setTimeout(() => setBurst(false), 2600);
    return () => {
      clearTimeout(peek);
      clearTimeout(pop);
      clearTimeout(settle);
      clearTimeout(clear);
    };
    // Runs once the page is live, then once per setup session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup, pick, scene.reduced, live]);
  useEffect(() => {
    if (!calendar)
      expression.set(
        withTiming(intakeMood(totalOn(meals, dayKey()), guide), {
          duration: 220,
        }),
      );
  }, [calendar, meals, guide, expression]);
  const later = (fn: () => void, ms: number) => {
    pending.current.push(setTimeout(fn, ms));
  };
  // A single native scroll follows measured content changes. No delayed
  // scrollToEnd calls compete with keyboard-controlled content insets.
  const followContent = () => {
    if (!touching.current && !KeyboardController.isVisible())
      list.current
        ?.getNativeScrollRef()
        ?.scrollToEnd({ animated: !scene.reduced });
  };
  useEffect(() => {
    const show = KeyboardEvents.addListener("keyboardDidShow", () =>
      setFocused(true),
    );
    const hide = KeyboardEvents.addListener("keyboardDidHide", () =>
      setFocused(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const activity = (value: boolean) => {
    active.current = value;
    setBusy(value);
  };
  useEffect(() => {
    perch.set(
      withSpring(hasTurns ? 1 : 0, { damping: 25, stiffness: 170, mass: 0.95 }),
    );
  }, [hasTurns, perch]);
  useEffect(() => {
    mood.set(busy ? 2 : focused ? 1 : 0);
    energy.set(withTiming(busy ? 0.65 : 0, { duration: busy ? 850 : 220 }));
    if (!busy) release.set(withTiming(1, { duration: 650 }));
    else release.set(0);
  }, [busy, focused, energy, mood, release]);
  const openCalendar = () => {
    Keyboard.dismiss();
    setPhotoMenu(false);
    setCalendar(true);
    pick.set(withSpring(1, { damping: 26, stiffness: 180, mass: 0.9 }));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const closeCalendar = () => {
    // Preserve the native sheet tree until it has left the screen. React
    // unmounts/accessibility updates must not compete with the exit animation.
    pick.set(
      withSpring(0, { damping: 27, stiffness: 230, mass: 0.85 }, (finished) => {
        if (finished) scheduleOnRN(setCalendar, false);
      }),
    );
  };
  const openProfile = () => {
    if (calendar) return;
    Keyboard.dismiss();
    setPhotoMenu(false);
    setProfileOpen(true);
    pick.set(withSpring(1, { damping: 26, stiffness: 180, mass: 0.9 }));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const closeProfile = () => {
    pick.set(
      withSpring(0, { damping: 27, stiffness: 230, mass: 0.85 }, (finished) => {
        if (finished) scheduleOnRN(setProfileOpen, false);
      }),
    );
  };
  const finishSetup = (
    fields: Partial<Profile>,
    secrets?: { password?: string },
  ) => {
    const store = useProfile.getState();
    store.save(fields);
    if (secrets?.password) {
      setPasswordSet(true);
      void savePassword(secrets.password);
    }
    if (!setup?.editing) store.finishOnboarding();
    // The diary's guide follows the plan unless a manual guide is set.
    const next = profilePlan(useProfile.getState());
    useDiary.getState().setGuide(next.guide);
    setSetup(null);
    if (!setup?.editing) {
      // Measured on the reference diary: the tag appears about a second after
      // the page settles and stays briefly.
      later(() => setTag("Let’s eat."), 1000);
      later(() => setTag(""), 2400);
    }
    if (!profileOpen)
      pick.set(withSpring(0, { damping: 27, stiffness: 230, mass: 0.85 }));
    scene.hop.set(
      withSequence(
        withTiming(0.45, { duration: 140 }),
        withTiming(0, { duration: 200 }),
        withTiming(0.3, { duration: 120 }),
        withTiming(0, { duration: 220 }),
      ),
    );
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
  const cancelSetup = () => {
    setSetup(null);
    if (!profileOpen)
      pick.set(withSpring(0, { damping: 27, stiffness: 230, mass: 0.85 }));
  };
  const anySheet = calendar || profileOpen || !!setup;
  // What the lemon would say about today: the diary's numbers, never a verdict.
  const todayTotal = totalOn(meals, dayKey());
  const days = streak(loggedDays(meals), dayKey(), relativeDay(-1));
  const lemonLine = !todayTotal
    ? days > 1
      ? `${days} days in a row. Nothing yet today.`
      : "Nothing logged yet. Show me a plate."
    : `${todayTotal.toLocaleString()} of ${guide.toLocaleString()} kcal${days > 1 ? ` · ${days} days in a row` : ""}`;
  const dock = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          dockY.get() + pick.get() * (composerHeight.get() + scene.bottom + 45),
      },
    ],
  }));
  const transcript = useAnimatedStyle(() => ({
    flex: 1,
    opacity: 1 - pick.get() * 0.82,
  }));
  const greeting = useAnimatedStyle(() => ({
    opacity:
      hasTurns || focused || setup
        ? 0
        : 1 - Math.min(1, pick.get() * 2 + scene.keyboardProgress.get() * 2),
    transform: [{ translateY: -scene.keyboardProgress.get() * 90 }],
  }));
  const showPhotoMenu = () => {
    Keyboard.dismiss();
    setPhotoMenu((old) => !old);
  };
  const attach = (photo: MealPhoto, preset?: MealType) => {
    if (active.current) return;
    Keyboard.dismiss();
    setPhotoMenu(false);
    activity(true);
    const id = eventId("photo");
    setTurns((old) => [
      ...old,
      { id, role: "user", kind: "photo", photo },
      {
        id: `${id}-question`,
        role: "assistant",
        kind: "question",
        photo,
        state: "thinking",
      },
    ]);
    later(() => {
      list.current?.prepareForLayoutAnimationRender();
      const question: Turn = {
        id: `${id}-question`,
        role: "assistant",
        kind: "question",
        photo,
        state: "choosing",
        text: preset ? `For ${preset.toLowerCase()}.` : undefined,
      };
      setTurns((old) =>
        old.map((turn) =>
          turn.id === `${id}-question`
            ? {
                ...turn,
                state: "choosing",
                text: preset
                  ? question.text
                  : photo.asset === "dinner"
                    ? "For dinner?"
                    : photo.asset === "lunch"
                      ? "For lunch?"
                      : photo.asset === "breakfast"
                        ? "For breakfast?"
                        : "Which meal?",
              }
            : turn,
        ),
      );
      activity(false);
      // The camera already named the meal: no question, straight to the receipt.
      if (preset) chooseType(question, preset);
    }, 900);
  };
  const chooseFromLibrary = async () => {
    setPhotoMenu(false);
    Keyboard.dismiss();
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const source = new File(asset.uri);
      const extension = asset.uri.split(".").pop()?.split("?")[0] || "jpg";
      const local = new File(
        Paths.document,
        `${eventId("zest-meal")}.${extension}`,
      );
      source.copy(local);
      attach({ uri: local.uri, sample: false });
    } catch {
      Alert.alert(
        "Photo unavailable",
        "That photo couldn’t be opened. Try another one.",
        [{ text: "OK", style: "cancel" }],
      );
    }
  };
  const editMeal = (meal: Meal) =>
    setEditor({
      name: meal.name,
      meal,
      kcal: meal.kcal,
      onSave: (name, kcal) => useDiary.getState().edit(meal.id, { name, kcal }),
      onDelete: () => useDiary.getState().remove(meal.id),
    });
  const chooseType = (turn: Turn, type: MealType) => {
    if (active.current || turn.state !== "choosing") return;
    const complete = (name: string, kcal: number) => {
      activity(true);
      const meal: Meal = {
        id: `meal-${turn.id}`,
        date: dayKey(),
        name,
        kcal,
        type,
        photo: turn.photo,
        protein: turn.photo?.sample
          ? sampleEstimates[turn.photo.asset ?? "breakfast"].protein
          : undefined,
        carbs: turn.photo?.sample
          ? sampleEstimates[turn.photo.asset ?? "breakfast"].carbs
          : undefined,
        fat: turn.photo?.sample
          ? sampleEstimates[turn.photo.asset ?? "breakfast"].fat
          : undefined,
        time:
          demo && turn.photo?.sample
            ? "9:41 PM"
            : new Date().toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              }),
      };
      // Retire the choices before introducing the receipt. Its photo then
      // stays mounted while the estimate arrives in short visual chunks.
      const replyId = turn.id;
      setTurns((old) =>
        old.map((item) =>
          item.id === replyId
            ? {
                ...item,
                mealId: meal.id,
                pendingMeal: meal,
                state: "confirming",
              }
            : item,
        ),
      );
      later(() => {
        setTurns((old) =>
          old.map((item) =>
            item.id === replyId
              ? { ...item, kind: "meal", state: "thinking" }
              : item,
          ),
        );
      }, CHOICE_RETIRE_MS);
      later(() => {
        const before = useDiary.getState().meals;
        useDiary.getState().add(meal);
        celebrateIfNewDay(before);
        setTurns((old) =>
          old.map((item) =>
            item.id === replyId ? { ...item, state: "complete" } : item,
          ),
        );
        activity(false);
        scene.hop.set(
          withSequence(
            withTiming(0.3, { duration: 130 }),
            withTiming(0, { duration: 210 }),
          ),
        );
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      }, CHOICE_RETIRE_MS + 500);
    };
    /** A real photo through the model: the receipt appears as soon as line one lands, the note streams after. */
    const estimateWithModel = (uri: string) => {
      activity(true);
      const controller = beginRequest();
      const replyId = turn.id;
      const draft: Meal = {
        id: `meal-${turn.id}`,
        date: dayKey(),
        name: "",
        kcal: 0,
        type,
        photo: turn.photo,
        time: new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
      };
      let saved = false;
      const patch = (fields: Partial<Turn>) =>
        setTurns((old) =>
          old.map((item) =>
            item.id === replyId ? { ...item, ...fields } : item,
          ),
        );
      patch({
        mealId: draft.id,
        pendingMeal: draft,
        state: "confirming",
        live: true,
      });
      later(() => patch({ kind: "meal", state: "thinking" }), CHOICE_RETIRE_MS);
      void (async () => {
        try {
          const estimate = await estimateMeal(
            { uri, type },
            (partial) => {
              if (
                controller.signal.aborted ||
                !partial?.settled ||
                partial.notFood
              )
                return;
              const meal = {
                ...draft,
                name: partial.name,
                kcal: partial.kcal,
                protein: partial.protein,
                carbs: partial.carbs,
                fat: partial.fat,
              };
              if (!saved) {
                // Line one is final: save once, reveal the number, keep streaming the note.
                saved = true;
                const before = useDiary.getState().meals;
                useDiary.getState().add(meal);
                celebrateIfNewDay(before);
                scene.hop.set(
                  withSequence(
                    withTiming(0.3, { duration: 130 }),
                    withTiming(0, { duration: 210 }),
                  ),
                );
                void Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
              }
              patch({
                pendingMeal: meal,
                state: "complete",
                note: partial.note,
              });
            },
            controller.signal,
          );
          if (controller.signal.aborted) return;
          if (estimate.notFood) {
            patch({
              kind: "question",
              state: "choosing",
              live: false,
              pendingMeal: undefined,
              mealId: undefined,
              text: "That doesn’t look like a meal. Try another photo?",
            });
            return;
          }
          const meal = {
            ...draft,
            name: estimate.name,
            kcal: estimate.kcal,
            protein: estimate.protein,
            carbs: estimate.carbs,
            fat: estimate.fat,
          };
          if (!saved) useDiary.getState().add(meal);
          else
            useDiary
              .getState()
              .edit(meal.id, { name: meal.name, kcal: meal.kcal });
          patch({
            pendingMeal: meal,
            state: "complete",
            note: estimate.note,
            live: false,
          });
        } catch (error) {
          if (controller.signal.aborted) return;
          if (saved) {
            // The number is in the diary; only the note was lost.
            patch({ live: false });
            return;
          }
          patch({
            kind: "question",
            state: "choosing",
            live: false,
            pendingMeal: undefined,
            mealId: undefined,
            text: `${failureText(error)} Or type it in.`,
          });
          setEditor({ name: "", onSave: complete });
        } finally {
          endRequest(controller);
          if (!controller.signal.aborted) activity(false);
        }
      })();
    };
    if (turn.photo?.sample) {
      const estimate = sampleEstimates[turn.photo.asset ?? "breakfast"];
      complete(estimate.name, estimate.kcal);
    } else if (apiConfigured && turn.photo?.uri)
      estimateWithModel(turn.photo.uri);
    else setEditor({ name: "", onSave: complete });
  };
  const send = async (question: string) => {
    if (active.current || !question.trim()) return false;
    active.current = true;
    const current = generation.current;
    // Let UIKit finish the keyboard transition before inserting messages or
    // clearing the field. These layout changes must not interrupt its travel.
    await KeyboardController.dismiss();
    if (current !== generation.current) return false;
    setPhotoMenu(false);
    activity(true);
    const id = eventId("answer");
    const diary = useDiary.getState();
    if (apiConfigured && !isDiaryQuestion(question)) {
      // Open questions stream from the model; diary numbers come along as context only.
      const controller = beginRequest();
      setTurns((old) => [
        ...old,
        { id: `${id}-prompt`, role: "user", kind: "text", text: question },
        {
          id,
          role: "assistant",
          kind: "text",
          state: "thinking",
          text: "",
          live: true,
        },
      ]);
      const patch = (fields: Partial<Turn>) =>
        setTurns((old) =>
          old.map((item) => (item.id === id ? { ...item, ...fields } : item)),
        );
      void (async () => {
        try {
          const answer = await askZest(
            question,
            diaryContext(diary.meals, diary.guide, undefined, new Date(), {
              targets: {
                protein: plan.protein,
                carbs: plan.carbs,
                fat: plan.fat,
              },
              person: {
                name: profile.name || undefined,
                goal: goalLabel[profile.goal],
                streak: streak(
                  loggedDays(diary.meals),
                  dayKey(),
                  relativeDay(-1),
                ),
              },
            }),
            (partial) => {
              if (!controller.signal.aborted)
                patch({ text: partial.text, followups: partial.followups });
            },
            controller.signal,
          );
          if (controller.signal.aborted) return;
          patch({
            state: "complete",
            live: false,
            text: answer.text || "I don’t have a good answer for that one.",
            followups: answer.followups,
          });
        } catch (error) {
          if (controller.signal.aborted) return;
          patch({
            state: "complete",
            live: false,
            text: failureText(error),
            followups: [],
          });
        } finally {
          endRequest(controller);
          if (!controller.signal.aborted) activity(false);
        }
      })();
      return true;
    }
    const answer = answerAbout(question, diary.meals, diary.guide);
    setTurns((old) => [
      ...old,
      { id: `${id}-prompt`, role: "user", kind: "text", text: question },
      { id, role: "assistant", kind: "text", state: "thinking", text: "" },
    ]);
    later(() => {
      setTurns((old) =>
        old.map((item) =>
          item.id === id
            ? {
                ...item,
                state: "complete",
                answer,
                text: [
                  answer.value && `${answer.value} ${answer.unit}`,
                  answer.caption,
                  answer.detail,
                ]
                  .filter(Boolean)
                  .join(". "),
              }
            : item,
        ),
      );
      activity(false);
    }, 620);
    return true;
  };
  const stop = () => {
    clearTimers();
    activity(false);
    setTurns((old) =>
      old.map((turn) =>
        turn.state === "thinking" || turn.state === "confirming"
          ? {
              ...turn,
              kind: turn.photo ? "question" : turn.kind,
              state: turn.photo ? "choosing" : "stopped",
              live: false,
              pendingMeal: turn.photo ? undefined : turn.pendingMeal,
              mealId: turn.photo ? undefined : turn.mealId,
              text: turn.photo ? "Which meal was this?" : turn.text,
            }
          : turn.live
            ? // A saved receipt whose note was still streaming keeps what arrived.
              { ...turn, live: false }
            : turn,
      ),
    );
  };
  const fresh = () => {
    generation.current += 1;
    setConversation((old) => old + 1);
    clearTimers();
    activity(false);
    Keyboard.dismiss();
    setTurns([]);
    setPhotoMenu(false);
    setCamera(null);
    closeCalendar();
  };
  const look = (x: number, y: number) => {
    scene.touchX.set(x);
    scene.touchY.set(y);
    scene.touched.set(++touches.current);
  };
  return (
    <MealPhotosProvider>
      <GlassThemeProvider value={theme}>
        <View
          style={{ flex: 1, backgroundColor: theme.paper }}
          onTouchStart={(e) => look(e.nativeEvent.pageX, e.nativeEvent.pageY)}
          onTouchMove={(e) => look(e.nativeEvent.pageX, e.nativeEvent.pageY)}
        >
          <ZestBackdrop scene={scene} />
          <Animated.View
            style={transcript}
            accessibilityElementsHidden={calendar}
            importantForAccessibility={
              calendar ? "no-hide-descendants" : "auto"
            }
          >
            <FlashList
              ref={list}
              renderScrollComponent={ZestChatScroll}
              data={turns}
              extraData={meals}
              keyExtractor={(turn) => turn.id}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              maintainVisibleContentPosition={{ disabled: true }}
              onContentSizeChange={followContent}
              onScrollBeginDrag={() => {
                touching.current = true;
              }}
              onScrollEndDrag={() => {
                touching.current = false;
              }}
              onMomentumScrollEnd={() => {
                touching.current = false;
              }}
              contentContainerStyle={{
                paddingTop: scene.top + 78,
                paddingHorizontal: 24,
                paddingBottom: Math.max(scene.bottom + 178, inputHeight + 112),
              }}
              renderItem={({ item: turn }) => (
                <ChatTurn
                  turn={turn}
                  meals={meals}
                  guide={guide}
                  reduced={scene.reduced}
                  onChoose={chooseType}
                  onEdit={editMeal}
                  onCalendar={openCalendar}
                  onAsk={(question) => void send(question)}
                />
              )}
            />
          </Animated.View>
          <ProgressiveBlur
            edge="top"
            height={scene.top + 66}
            color={theme.paper}
          />
          <View
            accessibilityElementsHidden={anySheet}
            pointerEvents={setup ? "none" : "auto"}
            style={{
              position: "absolute",
              top: scene.top,
              left: 18,
              right: 18,
              height: 44,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* No account or new-conversation controls while the questions run:
                the sheet is the whole screen until the guide is saved. */}
            {setup ? (
              <View style={{ width: 44 }} />
            ) : (
              <Animated.View
                entering={scene.reduced ? undefined : FadeIn.duration(260)}
                exiting={scene.reduced ? undefined : FadeOut.duration(160)}
              >
                <GlassButton
                  name="person.crop.circle"
                  label="Your profile"
                  onPress={profileOpen ? closeProfile : openProfile}
                />
              </Animated.View>
            )}
            <View style={{ alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "600",
                  letterSpacing: -0.35,
                  color: theme.ink,
                }}
              >
                Zest
              </Text>
            </View>
            {setup ? (
              <View style={{ width: 44 }} />
            ) : (
              <Animated.View
                entering={scene.reduced ? undefined : FadeIn.duration(260)}
                exiting={scene.reduced ? undefined : FadeOut.duration(160)}
              >
                <GlassButton
                  name="square.and.pencil"
                  label="New Zest conversation"
                  onPress={fresh}
                />
              </Animated.View>
            )}
          </View>
          <Animated.View
            pointerEvents={
              !hasTurns && !focused && !anySheet ? "box-none" : "none"
            }
            accessibilityElementsHidden={hasTurns || focused || anySheet}
            style={[
              {
                position: "absolute",
                top: scene.height * 0.495,
                left: 24,
                right: 24,
                alignItems: "center",
              },
              greeting,
            ]}
          >
            <Text
              accessibilityRole="header"
              style={{
                fontSize: 32,
                lineHeight: 37,
                fontWeight: "500",
                letterSpacing: -1.15,
                textAlign: "center",
                color: theme.ink,
              }}
            >
              {greetingFor(new Date())},{"\n"}
              {profile.name.trim() || displayName}.
            </Text>
            <Text
              accessibilityLabel={`Zest says: ${lemonLine}`}
              style={{
                marginTop: 10,
                fontSize: 15,
                lineHeight: 20,
                textAlign: "center",
                color: theme.muted,
              }}
            >
              {lemonLine}
            </Text>

            <Touch
              label="Log a meal"
              onPress={showPhotoMenu}
              expand
              style={{ marginTop: 28 }}
            >
              <GlassSurface
                interactive
                style={{
                  height: 48,
                  borderRadius: 24,
                  flexDirection: "row",
                  gap: 9,
                  paddingHorizontal: 21,
                  alignItems: "center",
                }}
              >
                <Symbol name="camera" size={17} color={theme.ink} />
                <Text
                  style={{ fontSize: 15, fontWeight: "500", color: theme.ink }}
                >
                  Log a meal
                </Text>
              </GlassSurface>
            </Touch>
          </Animated.View>
          <Animated.View
            pointerEvents={anySheet ? "none" : "box-none"}
            accessibilityElementsHidden={anySheet}
            style={[
              {
                position: "absolute",
                left: 0,
                right: 0,
                bottom: scene.bottom,
                alignItems: "center",
              },
              dock,
            ]}
          >
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: -scene.bottom,
              }}
            >
              <ProgressiveBlur
                edge="bottom"
                height={148 + scene.bottom}
                color={theme.paper}
              />
            </View>
            <ZestComposer
              key={conversation}
              scene={scene}
              busy={busy}
              onSend={send}
              onStop={stop}
              onPhoto={showPhotoMenu}
              onCalendar={openCalendar}
              onHeight={setInputHeight}
            />
          </Animated.View>
          <CalorieCalendar
            scene={scene}
            open={calendar}
            meals={meals}
            guide={guide}
            onClose={closeCalendar}
            onAdd={() => {
              closeCalendar();
              setPhotoMenu(true);
            }}
            onEdit={editMeal}
            onGuide={() =>
              setEditor({
                name: "Daily guide",
                kcal: guide,
                guide: true,
                onSave: (_name, kcal) => {
                  useDiary.getState().setGuide(kcal);
                  useProfile.getState().save({ manualGuide: kcal });
                },
              })
            }
            targets={{
              protein: plan.protein,
              carbs: plan.carbs,
              fat: plan.fat,
            }}
          />
          <ProfileSheet
            scene={scene}
            open={profileOpen}
            meals={meals}
            profile={profile}
            apiConfigured={apiConfigured}
            onClose={closeProfile}
            passwordSet={passwordSet}
            onEdit={(step) => setSetup({ step, editing: true })}
            onName={(name) => useProfile.getState().save({ name })}
            onGuide={(manualGuide) => {
              useProfile.getState().save({ manualGuide });
              useDiary
                .getState()
                .setGuide(profilePlan(useProfile.getState()).guide);
            }}
            onLogWeight={(kg) =>
              useProfile.getState().logWeight({ date: dayKey(), kg })
            }
            onReset={() => {
              useDiary.getState().reset();
              useProfile.getState().reset();
              setPasswordSet(false);
              void clearPassword();
              setProfileOpen(false);
              fresh();
              setSetup({ editing: false });
            }}
          />
          {setup && (
            <Onboarding
              key={setup.step ?? "all"}
              scene={scene}
              profile={profile}
              startAt={setup.step}
              editing={setup.editing}
              onDone={finishSetup}
              onCancel={setup.editing ? cancelSetup : undefined}
              revealing={revealing}
              burst={burst}
            />
          )}
          {celebration && (
            <StreakCelebration
              from={celebration.from}
              to={celebration.to}
              loggedWeek={loggedThisWeek(loggedDays(meals))}
              reduced={scene.reduced}
              onDone={() => setCelebration(null)}
            />
          )}
          {tag !== "" && (
            <Animated.View
              pointerEvents="none"
              entering={scene.reduced ? undefined : FadeIn.duration(220)}
              exiting={scene.reduced ? undefined : FadeOut.duration(220)}
              accessible
              accessibilityLiveRegion="polite"
              accessibilityLabel={`Zest says: ${tag}`}
              style={{
                position: "absolute",
                top: scene.height * 0.495 - 300,
                alignSelf: "center",
                backgroundColor: "#FFFFFF",
                borderRadius: 18,
                borderCurve: "continuous",
                paddingHorizontal: 14,
                paddingVertical: 9,
                boxShadow: "0 4px 16px rgba(32, 35, 25, 0.08)",
              }}
            >
              <Text
                style={{ fontSize: 15, fontWeight: "500", color: theme.ink }}
              >
                {tag}
              </Text>
            </Animated.View>
          )}
          {/* While revealing, everything below the sheet's top edge is clipped away,
              the way the can hides BitePal's pet; glass is translucent, so layering
              alone would not hide it. */}
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: revealing
                ? Math.max(180, scene.height - 616) + 3
                : scene.height,
              overflow: "hidden",
              zIndex: 45,
            }}
          >
            <Lemon
              scene={scene}
              calendarOpen={anySheet}
              onPress={
                calendar
                  ? closeCalendar
                  : profileOpen
                    ? closeProfile
                    : setup
                      ? () => {}
                      : openCalendar
              }
            />
          </View>
          {photoMenu && (
            <View style={{ position: "absolute", inset: 0, zIndex: 50 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss photo menu"
                onPress={() => setPhotoMenu(false)}
                style={{ position: "absolute", inset: 0 }}
              />
              <GlassSurface
                interactive
                style={{
                  position: "absolute",
                  left: 24,
                  bottom: scene.bottom + 72,
                  width: 232,
                  borderRadius: 28,
                  paddingVertical: 8,
                }}
              >
                {[
                  {
                    label: "Take a photo",
                    icon: "camera" as const,
                    mode: "camera",
                  },
                  {
                    label: "Photo library",
                    icon: "photo" as const,
                    mode: "library",
                  },
                  {
                    label: "Try a sample meal",
                    icon: "fork.knife" as const,
                    mode: "sample",
                  },
                ].map((item) => (
                  <Touch
                    key={item.label}
                    label={item.label}
                    onPress={() => {
                      if (item.mode === "library") void chooseFromLibrary();
                      else {
                        setPhotoMenu(false);
                        Keyboard.dismiss();
                        setCamera(
                          item.mode === "sample" || demo ? "sample" : "live",
                        );
                      }
                    }}
                    style={{
                      height: 52,
                      paddingHorizontal: 19,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 13,
                    }}
                  >
                    <Symbol name={item.icon} size={18} color={theme.ink} />
                    <Text style={{ fontSize: 16, color: theme.ink }}>
                      {item.label}
                    </Text>
                  </Touch>
                ))}
              </GlassSurface>
            </View>
          )}
          {camera && (
            <MealCamera
              source={camera}
              onClose={() => setCamera(null)}
              onUse={(photo, type) => {
                setCamera(null);
                attach(photo, type);
              }}
              onLibrary={() => {
                setCamera(null);
                later(() => {
                  void chooseFromLibrary();
                }, 400);
              }}
            />
          )}
          {editor && (
            <MealEditor request={editor} onClose={() => setEditor(null)} />
          )}
        </View>
      </GlassThemeProvider>
    </MealPhotosProvider>
  );
}
