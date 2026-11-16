# Helpers: six companions on the composer

Zest's lemon became a cast. Six helpers share one rig, one scene and one set of
timings; the person picks one in setup and can hold the one on the composer to
swap. This page records what was studied, what was built and what still needs
a device.

## What was studied (Appllama, 30 Oct 2026)

Screen ids are durable; media links expire after an hour
(`get_screen(screen_ref: "app_id/screen_id")` fetches a fresh one).

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

**BitePal (6479529917), 65 screens, 2 videos.** `oth_a53n8` portion
estimating: the photo as a big circle, "Estimating portions / Powered by AI",
and the raccoon peeking up from the bottom edge with wide eyes, the one
place the mascot reacts to the work in progress. `oth_bbbcc` meal result: the
raccoon beside the photo with a speech bubble in its own voice ("Nutty
goodness! My tummy is so happy."), then the receipt. `oth_qifjv` home: the
mascot is the hero, full width, with the calorie card under it. `onb_y9g7m`
and `onb_otx0j`: the pet is "generated" with a spinner, then revealed, before
the plan. The welcome video (1.8 s) is the raccoon face alone, then a dissolve.

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
swap mode and the gallery show one at a time. `?gallery=1` renders every helper
in every frame (`docs/images/helpers-frames.png`).

## Motion

| Moment | Value | Why |
| --- | --- | --- |
| Hold before the swap mode opens | 380 ms | Shorter than a context menu (500 ms): the companion is a character, not a menu. |
| Overlay in and out | 220 ms fade in, 200 ms out, strong ease-out; a fixed blur (70) under a 62 % white veil | The material never animates its intensity, which restarts Expo's blur animator on every frame. |
| Swipe | follows the finger, rubber-bands at both ends, spring `{ duration: 400, dampingRatio: 1 }` with the release velocity, one helper per swipe, selection haptic on change | A finger was involved, so a spring; paged, as the dots promise. |
| Neighbours | 70 % size, blur 0 to 7 with distance, gone past 1.7 seats away | They peek past the card and off the screen edge. All six sit in one Skia canvas. |
| Crossfade to the new helper | old out 180 ms, new in 220 ms from scale 0.94 | Exit faster than entrance; nothing from scale 0. |
| Landing after a swap | drops 36 pt onto the composer, spring `{ duration: 420, dampingRatio: 0.62 }`, success haptic | The overlay dissolves above it; the one bounce in the flow, because the choice is rare. |
| Hop after a logged meal | 0.3 over 130 ms, back over 210 ms | Same hop the lemon already had. |
| Analysing glow | opacity `energy` (0.65 while busy) × a 0.72–1.0 breath on `spin`, scale ±7 % | `spin` keeps phase continuous, so the pulse never jumps; Reduce Motion holds it still. |
| Reaction line after a meal | 450 ms after the save, shown 2.2 s | Measured on the reference diary tag (1 s, 1.4 s); here a touch sooner because the receipt already moved. |

Reduce Motion: no blink, no glow pulse, no crossfade; the swap mode opens and
closes at once, a swipe jumps to its helper and the new one is simply there.
Reduce Transparency: the overlay is opaque paper-white instead of blur.

## The swap mode

Hold the mascot on the composer's top-right edge: the chat frosts over and the
mascot leaves the composer. One glass card sits in the middle with the helper
on it, the previous and next helper blurred on either side. A swipe, or a tap
on a neighbour, moves between the six; name, tagline and six dots follow.
"Choose <Name>" dissolves the overlay, the new helper lands on the composer and
the placeholder reads "Ask <Name>". A tap on the frosted background closes
without a change. The eyes follow the finger on the stage and the phone's tilt
otherwise; the analysing glow stays on the live companion.

The six animals are the whole row. The lemon, the default, is not in it: it
stays reachable through the mascot row in the profile. With the lemon as the
current helper, the swap mode opens on Pebble.

Studied in Appllama (30 Oct 2026): EVA AI `oth_m751j` (one large character with
a row of alternatives and a single pill "Choose" at the bottom), Aloha Browser
`onb_jui9l` (a glass card on a pale wash with one bottom pill). Nothing copied.

## Accessibility

The companion is a button named "<Helper>, open calorie calendar" with a
custom action "Change helper". The swap mode is modal to VoiceOver: the stage is
an adjustable element ("Bao, the easygoing one", "4 of 6") and the button reads
"Choose Bao". Cards are "Pebble the penguin, Calm coach". The bubble on the setup sheet reads
"<Helper> says: …", so Maestro and VoiceOver hear the same text.

## Verified / not verified

- `npm run verify` and `cd server && npm test`: pass (30 Oct 2026).
- `scripts/maestro/helpers.yaml`: the setup step, the live swap on the sheet
  edge and the voice per step. Run it alone:
  `SIMULATOR_UDID=<udid> npm run test:ios -- scripts/maestro/helpers.yaml`.
- `scripts/maestro/swap.yaml`: hold on the perched mascot, swipe twice, choose,
  the new helper and "Ask Mochi" on the composer. Passed on the iOS 26.4
  simulator, Release build, 30 Oct 2026.
- Not verifiable in the simulator: the tilt (no sensor) and the feel of the
  flow on a device; the frame rate on a device is not measured.
- Not verified: the model's voice per helper through a deployed Worker (needs
  a real photo and the OpenRouter key).
