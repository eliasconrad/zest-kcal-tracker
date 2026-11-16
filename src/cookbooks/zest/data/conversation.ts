import type { Meal, MealPhoto, IntakeAnswer } from "./diary";

export type Turn = {
  id: string;
  role: "user" | "assistant";
  kind: "text" | "photo" | "question" | "meal";
  text?: string;
  photo?: MealPhoto;
  mealId?: string;
  pendingMeal?: Meal;
  answer?: IntakeAnswer;
  /** A model-written note under a receipt; streams in while the reply is live. */
  note?: string;
  /** Up to three tappable follow-up questions after a model answer. */
  followups?: string[];
  /** True while a model is still streaming into `text` or `note`. */
  live?: boolean;
  state?: "thinking" | "choosing" | "confirming" | "complete" | "stopped" | "failed";
};
