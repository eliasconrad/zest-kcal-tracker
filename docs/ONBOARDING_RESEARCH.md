# Onboarding research

Date: 30 October 2026.

Sources: Appllama `list_app_screens` with `section: onboarding` for the first page of YAZIO, BitePal and Cal AI (three calls; the rest of each section was not paged). Whole-app inventories already written in `docs/MOTION_SPEC.md` (YAZIO 84 screens, BitePal 65) for motion, not for a full onboarding field list. The other apps named in the brief (Cal Scanner, Calo, SnapCalorie, Fitia, MyFitnessPal, fatsecret, Lean, Fitatu) were not walked. No screenshots were saved.

| App | Onboarding screens (Appllama total) | What the first page asks, in order | What is good | What is bad | What Zest takes |
| --- | --- | --- | --- | --- | --- |
| YAZIO (`946099227`) | 50 | Video, main goal, a goal alert, referral source, sex, name, mascot greeting, motivation, self-improvement checkboxes, use-case confirmation | One question per screen, a thin progress line, and a hold-to-commit | The mascot is kept off the question screens, then a long run of motivation and source questions before the body | One question, the hold-to-commit, and a “what got in the way” multi-select used only for the lemon’s lines |
| BitePal (`6479529917`) | 35 | Video, referral quiz, goal, extra goals, a results chart, calorie-counting quiz, fasting quiz, a welcome promise, pet-generation loading, pet reveal | The goal is early and the promise is concrete | The pet is beside the questions and the quizzes delay the plan | The goal stays early. Zest keeps one lemon and does not add a pet shop or a quiz |
| Cal AI (`6480417616`) | 38 | Video, gender, workout frequency, acquisition source, a prior-app yes/no, an AI results chart, height and weight with a metric toggle, a birth-date wheel (day, month, year), a nutrition-coach yes/no, goal | Birth date is a real date, and height and weight sit together with a unit toggle | Charts and coach questions arrive before the plan exists | Date of birth replaces birth year. Height, weight and the unit toggle stay on one body step |

## Field list

The plan needs sex, age from a date of birth, height, weight, goal, a target and a pace only when the goal is to lose or gain, and activity. The model needs the same facts plus a dietary pattern, allergies, and meals per day. The camera’s default meal type needs usual meal times. The lemon’s lines need one “what got in the way” answer. Reminders are a skippable preference.

Health conditions are not asked. Zest does not make medical claims (`docs/INTEGRATION.md`).

The reminder step stores the choice. It does not call the system permission dialog: `expo-notifications` is not a dependency, and a permission prompt needs a native rebuild on a device. The step copy says why a reminder would exist and that it can be skipped.

Order: name, goal, body (sex, birth day, birth month, birth year, height, weight, units), target weight, activity, pace, dietary pattern, allergies, meals and usual times, what got in the way, reminders, account, plan.
