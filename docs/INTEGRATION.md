# Integration

`src/app/index.tsx` mounts `ZestScreen` directly. The sole route accepts `demo=1`; this remounts the screen and resets its local diary to sample data. Any other value leaves the stored diary alone. There is no chat-collection route or root back action.

## Native providers and identity

Use GestureHandlerRootView, SafeAreaProvider, and KeyboardProvider from `_layout.tsx`. Keep native builds: the SwiftUI buttons and keyboard controller need their native modules. Change `name`, `slug`, `scheme`, and `ios.bundleIdentifier` in `app.json` before distributing your app. Pass a `displayName` prop to change the greeting without editing the illustration or diary logic.

## Data and service boundary

- `data/diary.ts` owns local dates, calendar cells, sample meal values and deterministic answers about today, yesterday, the last seven days, meal categories, protein and the guide.
- `state/diaryStore.ts` creates an isolated Zustand store using an injected StateStorage. `state/useDiary.ts` supplies the Expo FileSystem adapter and selective React subscriptions.
- The file contains only meals and guide, not live conversation state. Starting a new conversation retains the diary. Ordinary launch does not invent meals.
- Photos come from Zest's own camera (`components/MealCamera.tsx`, expo-camera): a rounded finder with a breathing plate ring and four corner ticks, the meal chips (breakfast, lunch, dinner, snack; the clock pre-selects one via `defaultMealType`) under the finder, shutter, library shortcut and flash. The chosen meal travels with the photo (`ZestScreen.attach(photo, type)`), so no "which meal?" question follows. `source="sample"` shows the bundled dinner plate instead of a feed (the demo, simulators, the Maestro flows); a live feed that never reports ready or is denied turns into an in-finder notice with Settings and library. Captured and imported photos are copied into Documents before attaching.
- Deleting a meal removes its diary entry. The copied image file currently remains until app data is cleared; add an explicit orphan-file cleanup policy before deploying a production tracker.

## Model boundary

`data/api.ts` is the only network code. It streams from the Worker in `server/` through `expo/fetch` and is active only when `EXPO_PUBLIC_ZEST_API_URL` is set at bundle time.

- `ZestScreen.chooseType` → `estimateWithModel` for real photos: the upload copy is resized so the long edge is 1280 px, JPEG quality 0.8, re-encoded so EXIF is dropped (`expo-image-manipulator`, `data/api.ts`). The diary keeps the original file. The receipt is saved the moment the first line (`name | kcal | protein | carbs | fat`) settles. The note streams into `turn.note` afterwards. Stop aborts; a saved receipt keeps its number. If the Worker is unreachable (`offline`) or rejects the token or the image (`server`), the receipt stays, the thinking dots stop, and “Try again” calls `chooseType` again. The Worker buffers the meal reply and runs `server/src/calibrate.ts` before the text event.
- `ZestScreen.send` → `askZest` for questions `isDiaryQuestion` does not claim. The model sees `diaryContext` (totals, names, times, guide; never photos or paths) and streams prose plus a trailing `>> a | b | c` follow-up line, which `parseAnswer` hides until complete. Diary questions keep the exact local `answerAbout` path.
- `data/replies.ts` holds every parser (SSE events, estimate line, follow-up marker) and is covered by `tests/replies.test.mjs`. The Worker's prompts in `server/src/prompts.ts` define that format; change both together.
- The Worker is model-agnostic: `OPENROUTER_MODEL` selects any OpenRouter model with image input, `OPENROUTER_BASE_URL` can point at a fine-tuned OpenAI-compatible endpoint or the bundled mock. `ZEST_APP_TOKEN` is a shared header secret (`x-zest-token`). Production secrets are `wrangler secret put OPENROUTER_API_KEY` and `wrangler secret put ZEST_APP_TOKEN`. Deploy with `cd server && npm run deploy` once `CLOUDFLARE_API_TOKEN` is in the environment. This session had neither that token nor an OpenRouter key, so no production URL exists yet. After a deploy, set `EXPO_PUBLIC_ZEST_API_URL` to `https://zest-api.<account>.workers.dev` (see the commented line in `.env.example`).

Still yours to design before shipping: retention of uploaded photos on the provider side, rate limiting per user, and a privacy notice covering photo upload.

## Profile and plan

- `state/profileStore.ts` mirrors the diary store: an isolated Zustand store with injected storage holding name, e-mail, sex, birth year, birth date, height, weight, target weight, goal, activity, pace, dietary pattern, allergies, meals per day, usual meal times, blockers, a reminder preference, units, an optional manual guide, a weight log and the last celebrated streak day. The password never enters this store: `state/secrets.ts` keeps it in the device keychain (expo-secure-store, this device only) until an account service exists; the profile sheet only shows whether one is set. `profilePlan` turns it into a daily guide and macro targets via `data/nutrition.ts` (Mifflin-St Jeor with age from the birth date when it is set, activity factor, pace adjustment, a 1,200/1,500 kcal floor, protein-first macro split; vegan and vegetarian use 1.2 g protein per kg and give the leftover calories to carbs).
- `components/Onboarding.tsx` runs once on first launch (`demo=1` skips it with a default profile) and is reused from the profile to edit a single step. Steps: name, goal, body, target, activity, pace, diet, allergies, meals, blockers, reminders, account (e-mail and password; editing it from the profile leaves an empty password unchanged), plan. Target and pace appear only for lose and gain. The reminder step stores a boolean; it does not request notification permission, because `expo-notifications` is not installed. While it runs, the header's profile and new-conversation buttons are gone, not merely disabled; the progress line and the Continue button animate between states. It writes the profile once, on completion, then sets the diary guide from the plan. On a first launch the lemon starts hidden behind the sheet (`scene.reveal` sinks it; a clipping wrapper cuts it off at the sheet edge, because native glass is translucent) and pops out after a peek; then it narrates from the sheet edge through `LemonBubble`; the greeting title types in word by word (`Typewriter`) and the last step ends with a hold-to-commit button (`HoldToStart`) (one line per step, a thinking beat before the plan) and hops through `scene.hop`; the copy lives in the `line` expression at the top of the component. The field list and the sources are in `docs/ONBOARDING_RESEARCH.md`. `/v1/ask` receives those profile lines; the prompt tells the model to use this person’s guide and targets.
- `components/Profile.tsx` is a sheet with the same geometry as the calendar; both read `scene.pick`, gated by their own `open` flag, so the lemon climbs onto whichever is open. Weight, name and a manual guide use native prompts.
- `components/DayProgress.tsx` draws the calorie ring (Skia arc) and macro bars used by the profile and the calendar day view. Meals without an estimate add zero grams.
- Macros travel with the model wire format (`name | kcal | protein | carbs | fat`); sample meals carry fixtures. Deleting the profile also clears the diary.

## Streak

`components/Streak.tsx` holds the gold flame (`StreakFlame`, a Skia path with squash/stretch), the full-screen `StreakCelebration` (timed to Duolingo's reveal, see MOTION_SPEC) and the profile's `StreakBand`. `ZestScreen.celebrateIfNewDay` runs after every saved meal and shows the celebration the first time a day gains a meal; `profile.celebratedDay` keeps it to once a day. `data/nutrition.ts` provides `streak` and `loggedThisWeek`.

## Customize the visuals

The palette lives in `theme.ts`, image declarations in `data/photos.ts`, and original SVGs under `assets/cookbooks/zest/stickers/`. Lemon anatomy is in `components/Lemon.tsx`; its shared position/gaze values live in `hooks/useScene.ts`. Backdrop color triples are in `components/Backdrop.tsx`, with its shader in `motion/backdropShader.ts`.

Keep native glass surfaces transparent. They must not inherit `opacity < 1`, masks, clipping, or opaque decorative fills. Progressive blur masks are siblings of the material. SwiftUI `buttonStyle("glass")` owns circular icon press highlights; `Touch` owns the movable sticker/compound-control gesture.

## Accessibility and compatibility

All actions have accessibility labels. Reduce Transparency selects plain surfaces. Reduce Motion removes gaze drift, blinking, hop presentation and progressive travel where checked by the shared scene; native platform transitions remain under system control. The calendar supports large text with a scrollable layout. Check the actual native UI after changing type sizes or adding content.

The intended target is light-themed iPhone UI. Android/web and physical-camera, sensor, haptic and device frame-rate behavior have not been verified. The local answers support a limited English vocabulary; this is not a general assistant. The optional Worker is configured with `EXPO_PUBLIC_ZEST_API_URL` at build time; see the model boundary above. There is no account service yet.
