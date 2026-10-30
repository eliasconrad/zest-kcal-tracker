# Helpers: six companions on the composer

Zest's lemon became a cast. Six helpers share one rig, one scene and one set of
timings; the person picks one in setup and can hold the one on the composer to
swap. This page records what was studied, what was built and what still needs
a device.

## What was studied (Appllama, 30 Oct 2026)

Screen ids are durable; media links expire after an hour
(`get_screen(screen_ref: "app_id/screen_id")` fetches a fresh one).

Coverage: every screen of both apps was listed and read by its elements and
colours (ChatGPT 2 welcome, 16 onboarding, 2 paywall, 17 other tabs; BitePal
3 welcome, 35 onboarding, 1 paywall, 26 other tabs), all 98 images were
downloaded and viewed on two contact sheets (35 and 63 stills; the other four
entries are the videos), both videos of each app were downloaded and read as
1 fps contact sheets, and the screens that bear on a mascot or a chat were
opened at full size. The images stay outside the repo.

**ChatGPT (6448311069), 37 screens, 2 videos.** `onb_li26u` guest home: pill
composer with a round "+" button left and a filled send circle right, two
suggestion cards above the keyboard. `oth_sl4vk` chat response: no bubbles for
the assistant, markdown straight on the canvas, user text in a soft grey
bubble, a small icon row (copy, read aloud, retry, share) under the answer.
`oth_vthob` attach menu: a floating glass card anchored to the "+" with Camera
/ Photos / Files rows, 52 pt rows, icon in a grey disc. `oth_f5gzb` message
actions: a large popover with one destructive row last. The onboarding video
(110 s, 1 fps strip) shows the reply arriving as a single dot for ~1 s, then
text streaming line by line; the composer never moves during streaming.

ChatGPT's later onboarding (`onb_pi107` chat home with a starter action
list, `onb_snlen` example prompts, `onb_6mfgh`/`onb_9arz2` long answers with
a floating "scroll down" button) and both paywalls (`pay_29j3s`, `pay_hxuri`:
a segmented plan picker over a feature table) add nothing for a mascot; the
composer stays the one constant element on every screen.

**BitePal (6479529917), 65 screens, 2 videos.** `oth_a53n8` portion
estimating: the photo as a big circle, "Estimating portions / Powered by AI",
and the raccoon peeking up from the bottom edge with wide eyes, the one
place the mascot reacts to the work in progress. `oth_bbbcc` meal result: the
raccoon beside the photo with a speech bubble in its own voice ("Nutty
goodness! My tummy is so happy."), then the receipt. `oth_qifjv` home: the
mascot is the hero, full width, with the calorie card under it. `onb_y9g7m`
and `onb_otx0j`: the pet is "generated" with a spinner, then revealed, before
the plan. The welcome video (1.8 s) is the raccoon face alone, then a dissolve.

BitePal's onboarding video (171 s) and the remaining screens: the pet is
introduced with "Let's meet your virtual pet!" (`onb_wbn0z`), revealed from a
bin ("Open to see who is there", `onb_otx0j`), then named (`onb_ccwom`,
`onb_y9g7m`), and later customised in a store: `oth_l6mru` mascot selection
is a three-column grid of faces, the chosen card with a dark border, locked
ones with coin prices; `oth_ppi5i` sells wallpapers the same way. Settings
(`oth_uylpf`, `oth_ps43n`, `oth_cp2k4`), challenges (`oth_fdk3o`,
`oth_movax`) and the meal plan list (`oth_xhykv`) are plain lists without
the mascot. The long quiz (`onb_oiw9f` … `onb_0n6qb`: referral, goals,
counting history, fasting, meals per day, diet, restrictions, variety, habit,
gender, age, activity, height, weight, target, weekly goal) keeps the mascot
off the question screens and brings it back only on interstitials
(`onb_dljva`, `onb_2vdrk`), the same rule Zest already follows.

Pattern taken: the mascot sits where the work happens (composer, not a header),
it has one line in its own voice at the moment of the result, and the loading
state is the mascot plus a short line, not a spinner. Not taken: BitePal's
generated-pet step (the person chooses here, nothing is generated), ChatGPT's
icon row under every answer (Zest keeps the copy button only).

## The six

| id | Name | Species | Role | Accent | Voice in one line |
| --- | --- | --- | --- | --- | --- |
| pebble | Pebble | penguin | Calm coach | `#F0A23B` | One meal at a time. We've got all day. |
| fig | Fig | fox | Strict | `#B5451B` | I'll tell you the truth. You'll thank me later. |
| mochi | Mochi | cat | Sassy | `#E88FA1` | I count your calories. I also have opinions. |
| bao | Bao | bear | Chill | `#7FA37C` | Eat, log, nap. In any order. |
| olive | Olive | owl | Macro nerd | `#D9A441` | Protein, carbs, fat. Let's talk grams. |
| pip | Pip | frog | Hype | `#FFD43B` | You logged a meal? LEGEND. |

Palettes avoid violet, indigo and blue-violet (`tests/helpers.test.mjs` checks
every swatch). The accent is the only colour that leaves the drawing: it is
the analysing glow.

Everything about a helper lives in `src/cookbooks/zest/data/helpers.ts`:
palette, setup lines by step, the thinking line, the post-setup tag, the
reactions by intake mood (`-1` well under the guide, `0` within, `1` over) and
by meal type, and the persona sentence the Worker gets. The Worker mirrors the
persona by id in `server/src/prompts.ts`; the app sends only `helper: "fig"`.

## Drawings and frames

`components/helpers/Figures.tsx` draws all six in the lemon's 140 × 140 space
with the feet on one ground line (`GROUND = 128`), so `useScene` moves them
exactly as it moved the lemon: eyes first, head next, body last. Every figure
reads the same `Rig` (head transform, pupil offset, blink, curious, wry,
smile) straight from shared values; nothing renders per frame in React.

`components/helpers/frames.ts` names seven still frames: idle, blink, curious,
wry, think (looking down at the photo on the composer), cheer (chin up after a
logged meal) and analysing (think with the accent glow at full strength). The live companion moves between them continuously; cards, the
swap bar and the gallery show one at a time. `?gallery=1` renders every helper
in every frame (`docs/images/helpers-frames.png`).

## Motion

| Moment | Value | Why |
| --- | --- | --- |
| Hold before the swap bar forms | 380 ms, 60 pt slack | Shorter than a context menu (500 ms): the companion is a character, not a menu. A thumb drifts while it waits. |
| Swap bar appears | 160 ms fade, Liquid Glass forms with its own material animation | Occasional, so standard motion. |
| Helper under the finger lifts | spring `SNAP`, +10 pt, scale 1.32, selection haptic on change | A finger was involved, so a spring. |
| Crossfade to the new helper | old out 180 ms, new in 220 ms from scale 0.94 | Exit faster than entrance; nothing from scale 0. |
| Hop after a swap or a logged meal | 0.3 over 130 ms, back over 210 ms | Same hop the lemon already had. |
| Analysing glow | opacity `energy` (0.65 while busy) × a 0.72–1.0 breath on `spin`, scale ±7 % | `spin` keeps phase continuous, so the pulse never jumps; Reduce Motion holds it still. |
| Reaction line after a meal | 450 ms after the save, shown 2.2 s | Measured on the reference diary tag (1 s, 1.4 s); here a touch sooner because the receipt already moved. |

Reduce Motion: no blink, no glow pulse, no crossfade, the swap bar lifts
without a spring.

## Accessibility

The companion is a button named "<Helper>, open calorie calendar" with a
custom action "Change helper"; the swap bar announces the hovered helper. Cards
are "Pebble the penguin, Calm coach". The bubble on the setup sheet reads
"<Helper> says: …", so Maestro and VoiceOver hear the same text.

## Evidence on screen

- `docs/images/helpers-swapbar.png`: the bar held open (`?demo=1&swapbar=1`,
  flow `helpers-swapbar.yaml`): six helpers in one Liquid Glass pill, the
  hovered one lifted and named, the current one marked with a dot.
- `docs/images/helpers-motion-eyes.png`: 4 fps strip of the companion cropped
  from a 15 s Maestro recording (`helpers-motion.yaml`): taps at the four
  corners move the pupils first and the head after, a blink lands mid-way,
  and the last frames are the crossfade into the next helper.
- `docs/images/helpers-motion-swap.png`: 8 fps strip of the hold: the bar
  forms under the finger, a helper lifts, the finger lets go, the companion
  crossfades.
- Tilt: the gaze reads the gravity and gyroscope sensors through `useScene`,
  unchanged from the lemon; the simulator has no such sensors and reads zero,
  so tilt is only visible on a device.
- Every screen of both reference apps, one line each: `docs/APPLLAMA-CATALOGUE.md`.

## Verified / not verified

- `npm run verify` and `cd server && npm test`: pass (30 Oct 2026).
- `scripts/maestro/helpers.yaml`, `helpers-diary.yaml` and `helpers-swap.yaml`
  passed together in one run on 30 Oct 2026 (45 s, 49 s, 1 m 24 s). Run them:
  `SIMULATOR_UDID=<udid> npm run test:ios -- scripts/maestro/helpers.yaml scripts/maestro/helpers-diary.yaml scripts/maestro/helpers-swap.yaml`.
- `scripts/maestro/helpers-swap.yaml`: hold-and-slide, passing. The gesture
  is a long press with 60 pt of slack (`HOLD_SLACK`) that opens the bar, and a
  manual pan that takes over on the first move after it; Maestro's 4 s swipe
  keeps the first 380 ms inside that slack. XCTest lets go a little short of
  the swipe's end point, so the flow asserts that the helper changed (it lands
  on Mochi, one slot right of the aimed Fig), not which slot.
- Not verified: the model's voice per helper through a deployed Worker (needs
  a real photo and the OpenRouter key).
