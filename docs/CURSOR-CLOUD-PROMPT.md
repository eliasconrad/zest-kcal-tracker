# Cursor Cloud Agent prompt: Zest, round 3

Copy everything below the line into a Cursor Cloud Agent session on this repository (branch `main`). It is self-contained; the agent needs nothing from the chat that produced it.

---

You are working in the repository `zest-kcal-tracker`, an iOS calorie diary called **Zest** (Expo SDK 57, React Native 0.86, TypeScript, expo-router, Reanimated 4, Skia, Liquid Glass via expo-glass-effect) with a Cloudflare Worker in `server/` that proxies an open-weights vision model on OpenRouter. The owner is Elias Conrad (German; write commit messages and docs in English, keep UI copy in English). Read `README.md`, `docs/INTEGRATION.md`, `docs/MOTION_SPEC.md`, `docs/VERIFICATION.md`, `server/src/prompts.ts`, `src/cookbooks/zest/components/Onboarding.tsx`, `src/cookbooks/zest/state/profileStore.ts`, `src/cookbooks/zest/data/nutrition.ts` and both Maestro flows in `scripts/maestro/` before you change anything.

## What already exists (do not rebuild it)

- Onboarding sheet with eight steps: name, goal, body (sex, birth year, height, weight, units), target weight, activity, pace, account (e-mail into the profile store, password into the keychain via `src/cookbooks/zest/state/secrets.ts`), plan. The plan is Mifflin-St Jeor with activity factors, pace deficits, floors of 1200/1500 kcal and a macro split (`data/nutrition.ts`, unit-tested in `tests/nutrition.test.mjs`).
- Profile sheet with streak band, calorie ring, macros, weight log, account rows, plan rows, reset.
- Zest's own camera (`components/MealCamera.tsx`): plate ring, meal chips under the finder, shutter, library, flash, a sample mode on the bundled dinner plate. A photo taken there goes straight to the receipt with the chosen meal type (`ZestScreen.attach(photo, type)`).
- Streaming replies: `/v1/meal` returns `name | kcal | protein | carbs | fat` plus one note line; `/v1/ask` returns prose plus `>> q1 | q2 | q3`. Parsing lives in `data/replies.ts` and is unit-tested.
- Lemon mascot motion measured frame by frame from YAZIO, BitePal and Duolingo recordings. The timings in `docs/MOTION_SPEC.md` are not to be changed; new screens follow the same rules (mascot static on question screens, motion only in transitions, Reduce Motion removes every effect).
- Streak celebration after the first logged meal of a day.

## Hard rules

1. **Secrets.** `server/.dev.vars` and `.env` are git-ignored and must stay so. Never print, log or commit an OpenRouter key. Production secrets go in with `wrangler secret put`. If a key is needed and you do not have one, stop that sub-task and say so.
2. **No foreign artwork in the repo.** Screens from other apps (Appllama or anywhere) may be studied and described, never copied into `assets/` or `docs/images/`. The template's own license notes are in `docs/ASSET_PROVENANCE.md`.
3. **Colour and type.** Palette is `src/cookbooks/zest/theme.ts` (paper `#F3F3F0`, ink `#252720`, accent `#917018`, soft `#C9AC50`). No violet, indigo or blue-purple anywhere, no gradient heroes, no coloured side-tabs on cards. Headlines bold and large, asymmetry allowed.
4. **Accessibility.** Every control keeps a stable `accessibilityLabel` (the Maestro flows tap by label). Reduce Motion paths must keep working.
5. **Tests.** `npm run verify` (typecheck, lint, unit tests) and `cd server && npm test` must pass before every commit. You cannot run an iOS simulator in the cloud: write or extend Maestro flows for what you build, but do not claim they passed. List the exact commands Elias has to run locally (`SIMULATOR_UDID=<udid> npm run test:ios`) in your final report, and test **only the new flows**, not the whole app again.
6. **Commits.** Small, English, imperative, one topic each. Do not rewrite history. Push to a branch named `cursor/round-3` and open a pull request against `main` with a summary that separates "verified here" from "needs a simulator or a device".
7. **Honesty over completeness.** If a step is impossible in the cloud (device camera, real photo through the model, OpenRouter fine-tuning), say so plainly and deliver the part that is possible.

## Task 1: scanning must really work end to end

Goal: a real photo from Zest's camera produces a correct receipt on a device, with the deployed Worker, not a local one.

1. Deploy the Worker: `cd server && npm run deploy` (needs `CLOUDFLARE_API_TOKEN` in the environment; if it is missing, prepare everything and document the one command Elias runs). Set `OPENROUTER_API_KEY` and `ZEST_APP_TOKEN` as Worker secrets. Document the production URL in `docs/INTEGRATION.md` and in `.env.example` as a commented line.
2. In the app, make the API URL and token come from `.env` at build time (already the case) and add a visible, honest failure state in the receipt when the Worker is unreachable or the token is wrong (`ApiError` kinds `offline` and `server` exist in `data/api.ts`; the camera flow must not leave a "thinking" receipt behind on failure; add a retry affordance on the receipt).
3. Image pipeline: before upload, resize the photo to the long edge of 1280 px and JPEG quality 0.8 with `expo-image-manipulator` (installed), strip EXIF, respect `ZEST_MAX_IMAGE_BYTES`. Keep the local copy for the diary at the original size.
4. Add a `scripts/eval/` harness in the Worker package that sends labelled test images to `/v1/meal` and reports mean absolute error in kcal and per-macro, plus the share of replies that parse on the first try. Use a small, licensed dataset (for example a subset of Nutrition5k, check and record the license in `docs/DEPENDENCIES.md`; if no licensed set can be fetched in the cloud, build a 30-item set from Elias's own future photos as a documented TODO and ship the harness with three bundled sample meals from `assets/` so it runs).
5. Write down the results in `docs/VERIFICATION.md` under a new "Model accuracy" heading with the date, the model id and the numbers. No invented numbers.

## Task 2: the open-source model, individual plans, accurate food data

Facts first: the current model is `qwen/qwen2.5-vl-72b-instruct` on OpenRouter (`server/wrangler.jsonc`). OpenRouter does not fine-tune models. "Training on test data" therefore means, in order of effort:

1. **Prompt and few-shot tuning now.** Extend `server/src/prompts.ts`: add five to eight few-shot examples of correct wire-format answers (common plates, portion cues such as plate diameter and cutlery, mixed dishes), rules for portion estimation (state the assumed portion in grams in the note), and an explicit "unknown" path. Measure before and after with the Task 1 harness; keep the better prompt.
2. **Individual plans in every answer.** `/v1/ask` already receives guide, macro targets, name, goal and streak (`DiaryContext`). Extend it with the full onboarding profile that Task 3 adds (sex, age, height, weight, target, activity, pace, dietary preferences, allergies, meals per day) and make the system prompt use it: answers must refer to the person's own guide and targets, never generic numbers. Add unit tests in `server/tests/` that render the prompt and assert the profile lines are present.
3. **Calibration layer.** Add a deterministic post-processing step in the Worker (`server/src/calibrate.ts`): sanity bounds per meal type (for example no 40 kcal dinner, no 4000 kcal snack without a hint), macro-to-kcal consistency (4/4/9, correct the kcal if the macros disagree by more than 15 %), and a per-food-class lookup table for the twenty most common foods to pull obvious outliers back. Unit-test it.
4. **Real fine-tuning plan.** Write `docs/MODEL_PLAN.md`: which open-weights model to fine-tune (Qwen2.5-VL-7B with LoRA is the realistic candidate), where it would be hosted (a GPU provider with an OpenAI-compatible endpoint so the Worker only changes `OPENROUTER_BASE_URL` and the model id), what data is needed (photos with weighed ground truth, at least a few thousand), estimated cost, and the evaluation gate (the harness from Task 1). Do not start a fine-tune; this is the plan Elias decides on.
5. Model choice: run the harness against two or three open-weights vision models available on OpenRouter (Qwen2.5-VL-72B, a Llama 4 vision variant, a Gemma 3 vision variant if listed) and record the numbers and the price per 1,000 scans in `docs/MODEL_PLAN.md`. If no key is available in the cloud, ship the harness configured for the comparison and say that the numbers are missing.

## Task 3: onboarding that collects everything the plan needs

Research first, build second.

1. **Research** with the Appllama MCP if it is available in this session (app ids: BitePal `6479529917`, YAZIO `946099227`, Cal AI `6480417616`, Cal Scanner `6473512692`, Calo `6447434453`, SnapCalorie `1574239307`, Fitia `1448277011`, MyFitnessPal `341232718`, fatsecret `347184248`, Lean `6741105248`, Fitatu `1011095795`). Walk the onboarding section of each (`list_app_screens` with `section: onboarding`), count the steps, and write `docs/ONBOARDING_RESEARCH.md` with one table: app, number of steps, which personal and bodily facts are asked, in which order, what is good (one line), what is bad (one line), what Zest takes from it. Credits are limited: at most 60 Appllama calls for this task. Describe screens in words; never save their images into the repo. If the MCP is not available, use the inventories already written in `docs/MOTION_SPEC.md` (YAZIO 84 screens, BitePal 65) plus public app-store screenshots, and say which source you used.
2. **Decide the field list.** The onboarding must end with everything the plan and the model need, and nothing a diary does not use. Expected result (adjust only with a reason written in the research doc): name; sex; date of birth (replace the birth year); height; current weight; goal; target weight (lose/gain only); pace; activity level; **dietary pattern** (omnivore, vegetarian, vegan, pescatarian, halal, kosher, none of these); **allergies and intolerances** (multi-select: nuts, peanuts, gluten, lactose, egg, soy, fish, shellfish, sesame, other with a free text); **meals per day and usual times** (used by the camera's default meal type and by reminders); **what got in the way before** (one multi-select, used only for the lemon's lines, YAZIO's and Noom's pattern); **reminders** (ask for notification permission with a real reason, skippable); account (exists). Health conditions are **not** asked (no medical claims; see `docs/INTEGRATION.md`).
3. **Build it** in `Onboarding.tsx` following the existing step pattern (`order`, `stepsFor`, `line`, `ready`, the `Question` and `Choice` components, the 400 ms `go()` guard, the lemon line per step). Keep the greeting interlude, the plan computation and the hold-to-start exactly as they are. New fields go into `Profile` (`profileStore.ts`) with defaults and persist; the plan gains a date-of-birth-based age, and the macro split respects the dietary pattern (vegan and vegetarian: protein target at the lower bound, carbs up; document the rule in `nutrition.ts`). Update the profile sheet rows and the reset. Extend `tests/nutrition.test.mjs` for the new plan rules and the new persisted fields.
4. **Flows.** Extend `scripts/maestro/onboarding.yaml` for the new steps only (labels and values), keep the rest unchanged. Write a second, short flow `scripts/maestro/account-edit.yaml` that opens the profile, edits the e-mail and saves. Do not run or rewrite flows for things you did not touch.
5. **Copy.** Short, plain, friendly, no exclamation marks except the lemon's existing greeting. Every step has one lemon line in `line` with the same tone as the existing ones.

## Order of work and deliverables

1. Task 3 research doc (so the field list exists before code).
2. Task 3 build, tests, flows.
3. Task 1 Worker deploy preparation, image pipeline, failure state, harness.
4. Task 2 prompts, calibration, profile in context, model plan.
5. Update `README.md` (step count, camera, account), `docs/INTEGRATION.md` (production URL, secrets, new fields), `docs/VERIFICATION.md` (what was verified in the cloud, what needs a device).
6. Pull request `cursor/round-3` → `main` with the report described under rule 6.

Definition of done: `npm run verify` and `cd server && npm test` green; the research doc and the model plan exist with sources; the eval harness runs against at least the bundled samples; the PR report lists every simulator or device check Elias still has to do, with the exact commands.
