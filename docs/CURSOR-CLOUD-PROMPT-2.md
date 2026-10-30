# Cursor Cloud Agent prompt: Zest, round 4 (ship-ready app)

Second cloud session, independent of round 3 (`docs/CURSOR-CLOUD-PROMPT.md`). Run it on a fresh branch from `main`; if round 3 has already merged, build on top of it, otherwise avoid its files (`Onboarding.tsx` fields, `server/src/prompts.ts`, `server/src/calibrate.ts`) and leave merge notes in the PR. Copy everything below the line into the session.

---

You are working in `zest-kcal-tracker`, an iOS calorie diary called **Zest** (Expo SDK 57, React Native 0.86, TypeScript, expo-router, Reanimated 4, Skia, Liquid Glass) with a Cloudflare Worker in `server/`. The owner is Elias Conrad. He wants to wake up tomorrow to an app that is close to shippable: Apple-compliant, with every feature a calorie tracker is expected to have, a researched paywall, and motion that feels like the big apps. You have his full permission to decide and build without asking; decisions are written down, not asked about. Work until the list below is done or the session ends, in the order given, committing after each finished item.

Read first: `README.md`, `docs/INTEGRATION.md`, `docs/MOTION_SPEC.md`, `docs/VERIFICATION.md`, `docs/CURSOR-CLOUD-PROMPT.md` (what round 3 covers; do not duplicate it), `docs/agent-skills/README.md` and then the skills it lists, `src/cookbooks/zest/screens/ZestScreen.tsx`, `components/Onboarding.tsx`, `components/Profile.tsx`, `components/MealCamera.tsx`, `components/Streak.tsx`, `state/*.ts`, `server/src/*.ts`, both Maestro flows.

## Hard rules

1. **Secrets** stay out of the repo (`server/.dev.vars`, `.env` are git-ignored). Keys you need but do not have: stop that sub-task, say so.
2. **No foreign artwork**: study other apps in Appllama, describe them in words, never save their images into the repo.
3. **Branding**: `src/cookbooks/zest/theme.ts` (paper `#F3F3F0`, ink `#252720`, accent `#917018`, soft `#C9AC50`), one lemon mascot, no violet/indigo, no gradient heroes, no coloured side-tabs, bold large headlines. Every new screen uses the same glass sheet geometry as the profile and calendar (`GlassSurface`, `scene.pick`, panel top `Math.max(180, height - 616)`).
4. **Motion**: `docs/MOTION_SPEC.md` timings stay. New motion follows `docs/agent-skills/animate`, `apple-design` and `emil-design-eng`: springs, interruptible, 60 fps on the UI thread (Reanimated worklets, no JS timers for visuals), Reduce Motion removes every effect. Inside `useAnimatedReaction` only hand plain JS functions to `scheduleOnRN`; never a closure that captures a module (this crashed the app once).
5. **Honest numbers**: no invented reviews, ratings, user counts or testimonials anywhere, especially on the paywall (German competition law, UWG § 5). Prices come from StoreKit at runtime, never hardcoded strings.
6. **Verification**: `npm run verify` and `cd server && npm test` green before each commit. No simulator in the cloud: write Maestro flows for each new feature in its own file under `scripts/maestro/` and list, in the PR, the exact commands for Elias (`SIMULATOR_UDID=<udid> npm run test:ios scripts/maestro/<flow>.yaml`). Test only what is new; do not touch or re-run flows for existing features.
7. **Commits**: small, English, imperative; branch `cursor/round-4`; PR to `main` with a report split into "verified here" and "needs a device".
8. **Research every feature in Appllama before building it** (MCP tools `search_apps`, `list_app_screens`, `search_screens`, `get_screen`). App ids: YAZIO `946099227`, Cal AI `6480417616`, BitePal `6479529917`, Cal Scanner `6473512692`, Calo `6447434453`, SnapCalorie `1574239307`, Fitia `1448277011`, MyFitnessPal `341232718`, fatsecret `347184248`, Lean `6741105248`, Fitatu `1011095795`, Finch `1528595748` (social and streak patterns), Duolingo (search it; streak and friends patterns). Budget: 250 calls for the whole session; note the count in the PR. Each research result becomes a short section in `docs/APP_RESEARCH.md` (what the big apps do, what Zest does and why) before the code for that feature is written. If the MCP is missing in the session, say so and use the inventories in `docs/MOTION_SPEC.md` plus public App Store pages.

## 1. Apple compliance audit and fixes

Write `docs/APPLE_COMPLIANCE.md`: a checklist against the App Store Review Guidelines and the Human Interface Guidelines, each line with status and the file that satisfies it. At minimum:

- Privacy manifest (`PrivacyInfo.xcprivacy` via the Expo config: required reason APIs, data types collected: e-mail, photos, health-adjacent dietary data), privacy policy URL in `app.json`, purpose strings for camera, photo library, notifications and Face ID in plain language.
- Account rules: if the app offers e-mail sign-up it must offer **Sign in with Apple** (Guideline 4.8) and **in-app account deletion** (5.1.1 v). Both are part of section 2.
- Subscriptions (3.1.2): the paywall states price, period, auto-renewal, how to cancel, links to terms and privacy, and has **Restore Purchases**; no "free trial" wording unless an introductory offer exists in App Store Connect.
- Health claims: Zest gives estimates, not medical advice; the copy must say so once in onboarding and in the profile (Guideline 1.4.1 and 5.1.1 iii).
- HIG: Dynamic Type up to accessibility sizes on every new screen, VoiceOver labels, Reduce Motion and Reduce Transparency, safe areas, keyboard avoidance, light and (if you add it) dark mode consistency, haptics only for meaning.
- Replace the template identity: `app.json` name, slug `zest`, scheme `zest`, bundle id `eu.eliasconrad.zest`, icon and splash from the lemon (vector, exported at the required sizes, no third-party art), version `1.0.0`, build number 1. Keep `io.appllama.zestkcaltracker` in the Maestro flows updated to the new id.

Fix everything the audit finds that is code, and list what needs Elias (App Store Connect, agreements, screenshots).

## 2. Accounts: sign-up, login, management, API lock

Today the e-mail sits in the profile store and the password in the keychain; nothing talks to a server. Build the real thing, small and EU-hosted:

- **Backend** in the existing Worker (`server/`): Cloudflare D1 database (EU location hint), tables `users`, `sessions`, `profiles`, `meals`, `friendships`, `recipes`. Migrations under `server/migrations/`. Password hashing with PBKDF2-SHA256 via WebCrypto (600k iterations, per-user salt) because Workers have no Argon2; document it. Sessions are opaque random tokens (32 bytes) stored hashed, 30-day sliding expiry, revocable.
- **Sign in with Apple** (expo-apple-authentication): verify the identity token on the Worker (Apple's JWKS), link by `sub`, accept the private relay e-mail.
- **Endpoints**: `/v1/auth/signup`, `/v1/auth/login`, `/v1/auth/apple`, `/v1/auth/logout`, `/v1/auth/delete` (deletes the user and all rows, returns 204), `/v1/me` (profile get/put), `/v1/sync/meals` (push and pull with `updatedAt`, last write wins, the device stays the primary copy so the app works offline).
- **API lock**: `/v1/meal` and `/v1/ask` require a valid session token; the shared `ZEST_APP_TOKEN` header stays as a second gate. Per-user rate limit (Durable Object or KV counter): 60 scans per day on free, unlimited on Pro (section 3 defines the tiers), 429 with a friendly body the app shows.
- **App**: `state/session.ts` (token in the keychain), `data/auth.ts`, screens as glass sheets: sign up (name, e-mail, password, Apple button on top), log in, forgot password (e-mail with a one-time code via Resend or MailChannels; if no sending key exists, implement and leave the key as a documented secret), account sheet in the profile (change e-mail, change password, sign out, delete account with a typed confirmation). The onboarding's account step becomes the sign-up: it creates the account at the end of onboarding when the plan is saved, never before (the diary must work without an account for people who skip it: keep "Skip for now", sync is what an account buys).
- Migrate the existing local e-mail and keychain password into the first sign-up silently.
- Tests: Worker unit tests for hashing, session expiry, Apple token verification (mock JWKS), deletion cascade, rate limit; app unit tests for the session store.

## 3. Paywall research, pricing, costs, design, implementation

Research with Appllama (`section: paywall` of YAZIO, Cal AI, BitePal, Cal Scanner, Calo, MyFitnessPal, fatsecret, Fitia, Lean, SnapCalorie; plus their `in_app_purchases` from `search_apps`). Write `docs/PAYWALL_RESEARCH.md` with one row per app: placement (after onboarding, before the first scan, hard or soft), plans and prices as listed on the store, trial yes/no, whether the paywall looks hardcoded or remote-configured (tell-tale signs: A/B variants across screens, price strings that do not match the store list, feature lists that change), what works, what is bad.

Then calculate Zest's cost per user in `docs/PRICING.md`: OpenRouter price of the current model per image request (look it up live; the Worker's prompt is roughly 400 tokens plus the image, the reply about 60 tokens), assumed usage of 3 to 6 scans a day plus 2 questions, Cloudflare Worker and D1 costs at 1k, 10k and 100k monthly actives, Apple's 15 % (Small Business Program) and 30 % cuts. From that, propose the tiers and the prices in EUR and USD for DE, AT, CH, US, UK, with the reasoning; a free tier that never loses money per user (limited scans per day) and a Pro tier (unlimited scans, sync, friends, recipes). Elias decides the final prices; mark them as proposals and keep them in one place (`src/cookbooks/zest/data/plans.ts`), product ids `eu.eliasconrad.zest.pro.monthly` and `.yearly`.

Design and build the paywall based on that research, not on a template: one sheet in the glass geometry, the lemon present with one line, three to five benefits tied to real features, two plan cards with the yearly one preselected and its per-month equivalent, the mandatory Apple texts, Restore, close affordance after a short delay (soft paywall after onboarding, and a hard gate when the free scan limit is hit). Implement purchases with **StoreKit 2** through `expo-iap` (prices only from `getProducts`), entitlement check on launch, server-side receipt verification in the Worker (App Store Server API, document the key setup for Elias), and a `pro` flag on the user row that the rate limit reads. Remote configuration: the paywall's copy, order of benefits and which plan is highlighted come from `/v1/config` (D1 table `config`, with defaults bundled in the app), so experiments later need no app update.

## 4. Social: friends and streaks together

Research Duolingo, Finch, YAZIO buddies and BitePal challenges in Appllama first. Then: invite link (`zest://friend/<code>`, universal link later), friends list in the profile with each friend's current streak and today's "logged" state (no calories or meals shared by default; a per-friend toggle to share the daily total), a weekly "who logged most days" strip, nudges ("Mia logged today") as push notifications through expo-notifications with a Worker-side sender (APNs key is Elias's; document it). Privacy: friends see only what the toggle allows; blocking and removing a friend; deletion removes all edges.

## 5. Recipes

Research YAZIO recipes and Fitatu meal plans first. Then: a recipes sheet with a searchable list (title, photo placeholder drawn as a sticker, kcal and macros per serving, time), a recipe detail with servings stepper that recalculates, "Log this" which writes a meal with the recipe's macros and photo-less sticker, favourites, and a "Suggest a recipe" that asks the model (`/v1/recipe`, new Worker endpoint: three suggestions from the diary's remaining calories and macro gap, same wire-format discipline as `/v1/ask`, parsed and tested). Bundle 40 seed recipes in `data/recipes.json` with real nutrition values you compute from a public nutrient table (USDA FoodData Central, cite it); no invented numbers.

## 6. Motion and polish pass

The owner's verdict on the current effects: "very bad". Use `docs/agent-skills/improve-animations` to audit every animation in `src/cookbooks/zest` (write the audit to `docs/MOTION_AUDIT.md`), then fix with `animate` and `apple-design`: screen and sheet transitions with springs (damping 26, stiffness 180 as the profile sheet already uses), chip and choice selection with a scale and colour spring rather than an instant swap, list rows arriving with staggered `FadeInDown` only on first appearance, the receipt's number counting up on the UI thread, pull-to-refresh and overscroll with rubber-banding, haptics at commit points only, and every effect removed under Reduce Motion. Compare each against the recordings of YAZIO, BitePal and Cal AI in Appllama (videos; describe the frame timings you measured in the audit) and keep the lemon's measured timings from `MOTION_SPEC.md` untouched.

## 7. Report

PR `cursor/round-4` with: features list, decisions taken (with the one-line reason each), Appllama calls used, every secret or App Store Connect step Elias must do (as a numbered checklist), and the device checks with their exact commands. Definition of done: all seven sections exist in code and docs, verify and Worker tests green, each new feature has its own Maestro flow, nothing invented, nothing hardcoded that the store or the config should own.
