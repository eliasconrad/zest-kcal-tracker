# Material and motion

Zest uses one shared scene on the UI thread. The lemon, composer, background and diary read the same values; a React state update does not drive every frame. Finished gaze values snap to rest so they stop causing redraws.

## Native glass

`components/ui/GlassSurface.tsx` renders `expo-glass-effect` GlassView when both API and material are available and Reduce Transparency is disabled. The system owns its rim, optics, shadow and interactive highlight. `GlassButton.tsx` hosts SwiftUI `buttonStyle("glass")` circular controls. Unsupported runtimes receive an opaque surface.

Build against an Apple SDK that provides Liquid Glass, run on a matching supported runtime, and retain `enableSceneSupport` in the Expo build-properties plugin. The approved material was verified with Xcode 27 and iOS 27. API availability on an older build/runtime is not proof of equivalent optics. Rebuild native code after changing SDK/config; Metro refresh cannot change the linked SDK or Info.plist.

Do not put alpha animation, a mask, a clipped decorative container or a painted surface behind/over the native material. Its blur and color response depend on the actual content behind it. The diary's fixed BlurView fades in a separate sibling; changing blur intensity every frame previously recreated UIKit's animator and interrupted travel.

## Chat flow

| Phase | Presentation |
| --- | --- |
| Attach | One photo identity enters the user bubble; a small visual thinking cue precedes meal selection. |
| Choices | The stable bubble grows over 280 ms; four glass sticker tiles form with an 85 ms stagger. Short copy arrives in 65 ms word chunks. |
| Confirm | Choice material retires over 190 ms. The same bubble and photo become the receipt; a 500 ms visual wait precedes the saved value. |
| Receipt | Photo remains mounted. Name, large number, unit, short comment and diary action reveal at 0/100/210/300/460 ms. |
| Diary answer | A 620 ms local wait yields a whole visual answer with a sticker and large value. No long typewriter paragraph. |
| Recycle | Already completed replies render immediately when revisited; old values do not stream again. |

A busy guard prevents repeated confirmation. Stop cancels pending callbacks; starting a new chat cancels pending work and clears the transcript while retaining saved diary data.

## Keyboard, calendar and character

The composer begins at 108 points and grows with measured text up to its supported limit. Keyboard Controller supplies native keyboard animation geometry with **12 points of clearance**. Sending awaits native keyboard dismissal before inserting messages or clearing the field. One measured content-size callback follows new replies; delayed scroll timers do not compete with keyboard insets.

The lemon moves from its centered welcome to the composer's edge, then to the diary's upper corner. Eyes notice touches first, the head follows, and the body leans last. The low warm light gathers beneath the glass while busy. Calendar opening retains its glass tree, and close removes accessibility only after its exit finishes.

During onboarding the lemon stands on the sheet's upper edge and narrates. The timings come from frame-by-frame reads (5-10 fps strips) of the YAZIO and BitePal onboarding recordings, not from guesses:

| Moment | YAZIO | BitePal | Zest |
| --- | --- | --- | --- |
| Question change | 0.3-0.6 s dissolve | 0.3 s push from the right, avatar fixed | 0.28 s push, lemon and bubble fixed |
| Greeting after the name | 0.3 s in, 1.3 s hold, 0.6 s out | bubble stays beside every question | 1.3 s interlude ("Nice to meet you, Mia."), bubble stays |
| Plan computation | 7-8 s, four items at ~1.5 s, mascot present | 7 s ring, four items at ~1.8 s, no mascot | four items at 1.5 s (6.4 s), lemon present, dots become checks |
| Reveal | sticker scales in 0.1 s, sparkles move every ~0.2 s | lid 0.3 s, 1.0 s pause, pop 0.07 s, settle 0.5 s, items 0.8 s | hidden start, peek, pop, sticker burst (see the frame table); double hop and sparkles at the plan |
| Bubble | appears with the screen, no spring | avatar static | 0.3 s fade, 0.2 s fade out |
| After the first diary | "You're awesome!" tag 1 s after, ~0.8 s | hero scene static | "Let's eat." tag 1 s after, 1.4 s |

Frame-level reads at the recordings' native rate (30 fps; BitePal's splash 60 fps), one frame = 33 ms:

| Moment | Measured | Zest |
| --- | --- | --- |
| BitePal splash | face only for 42 frames (0.70 s), 6-frame dissolve (0.10 s), static splash | n/a (Expo splash) |
| YAZIO splash | logo 18 frames (0.60 s), 7-frame fade (0.23 s) overlapping a 5-frame fade-in, food pieces pop in 2-3 frames each at 1.20, 1.27, 1.47, 1.53 s | n/a |
| BitePal reveal | tail wags every ~9 frames (0.3 s); tap; lid lifts 9 frames (0.30 s); 30-frame pause with a lid wobble (1.0 s); lid 4 frames (0.13 s); head pops in 2 frames (0.07 s); rises and settles over 15 frames (0.50 s); items arc for 24 frames (0.8 s); hold 33 frames (1.1 s); cut | lemon hidden behind the sheet; the clock starts with the sixth drawn frame (a cold start sits on a blank frame first); leaf peeks 0.3 s at 0.6 s, sinks 0.3 s, wobble 0.4 s; pop at 1.6 s with a stiff spring and a 0.5 s hop; three stickers arc 0.8 s; bubble at 2.2 s |
| YAZIO greeting | name screen out 3 frames (0.10 s); blank 14 frames (0.47 s); mascot and bubble scale and fade in over 8 frames (0.27 s); hold 33 frames (1.10 s); dissolve into the list over 8 frames (0.27 s) | 1.3 s interlude after the name, bubble fades 0.3 s |
| YAZIO plan | mascot crossfades in over 6 frames (0.20 s); checklist items ~1.1-1.5 s apart | four items at 1.5 s |
| YAZIO Quiz Hero | sticker scales in 2-3 frames (0.07-0.10 s), 6 frames after the purple cut; stripes drift behind | double hop, sparkles every 0.2 s |
| YAZIO diary tag | visible ~0.8-1.0 s, shrinks and fades over 7 frames (0.23 s) | 1.4 s, 0.22 s fade |
| BitePal "Got it" | push in 6 frames (0.2 s); hearts drift ~1 px per frame, sparkles blink; 1.4 s hold | push 0.28 s |
| BitePal plan | summary to loading crossfade 5 frames (0.17 s); ring +1 % every 8 frames | n/a |

Per-frame motion maps of the whole recordings (every frame differenced against the previous one, `#` strong change, `+` small, `.` still; one character per 33 ms) back the numbers above:

```
YAZIO greeting, frames 405-525 (13.5 s):   ..+#####...............................++##++++++...........
                                            ....................#....#.....#....#.....#.................
YAZIO hold-to-commit, frames 645-765:       .............................................###..#.........
                                            ..............#........#...........+...+++++++...........+..
BitePal typewriter, frames 450-570:         #.##.....##########+....++####+#+++.+............+.......##.
                                            ...+.###...##.###.......#############+++....................
BitePal reveal, frames 960-1110 (32.0 s):   ########+++................++##+######+################+####
                                            ######+++#+++.++#++##########################+##++......#...
                                            ##........########+++.........
YAZIO Quiz Hero, frames 9060-9150:          .............##..#.#.+.......##.#.....#.++.....#..#.#....#.+
YAZIO diary tag, frames 9285-9357:          ..#...................................+++++++...............
```

Reading them: the greeting's name screen leaves in 6 frames, 30 still frames follow, the mascot and bubble arrive over 12 frames, and the single `#` ticks during the hold are the mascot's blinks every ~5-6 frames apart in pairs. BitePal's "Let's meet your virtual pet!" types one word every ~5 frames with paw prints fading in between. The reveal's 18 still frames between the lid lift and the pop are the pause; the 50 dense frames after are the pop, the rise and the flying items. The Quiz Hero's sparse single-frame ticks are the repositioning sparkles. The whole-recording motion scan found 263 motion segments in YAZIO (1,757 of 9,357 frames moving) and 150 in BitePal (1,555 of 5,139), so neither mascot ever moves on a question screen: every long segment is a transition, a picker or a particle effect.

Two further patterns from the frame maps are now in Zest: the interlude title types in one word every 170 ms (`Typewriter`), and the final button is hold-to-commit (`HoldToStart`): a fill grows across it for 1.3 s and releases into the diary, letting go early springs it back, Reduce Motion accepts a tap.

Screen-by-screen read of both catalogues (every screen opened at reading size, six to a sheet):

YAZIO, 84 screens. Mascot present on 20: welcome video and splash (1-2), mascot greeting (10), hold-to-commit icon and "Keep holding!" fill (13-14), "Almost there" teal circle and "Welcome to Yazio" (15-16), "Find your balance" with bread and apple (24), "We've got your back" with phone and food (28), "Think back" with barbell (31), activity-tracking app icon (34), "Setting a goal" with apple (44), paywall with food confetti (54), Pro tab icon on every tab bar, shop banner "Unlock brand-new rewards" (77), and the fasting fox and rabbit as separate tracker mascots (79-80). Absent from the other 64: every question, picker, Health permission sheet, diary, nutrition facts, recipes, filters, grocery list, calendar, fasting, profile, buddies, settings. Second splash recording (52 frames): logo and mascot hold for 18 frames, dissolve over 7 into the food carousel.

BitePal, 65 screens. Mascot present on 34: splash (2), intro hero (3), reveal pair (12-13), "Let's meet" hand (11), name entry with peeking head (15), rating with starry eyes (16), rainbow support (17), eating-habits daydream (19), avatar in the bubble of every question (20-21, 23-26, 29-35), fasting sleep scene (22), hearts "Got it!" (30), personal summary with sweat drop (36), paywall with laughing face (39), home hero with name and hearts (40, 44, 62), "Estimating portions" peek and "Hmm, something tasty." (45, 48), meal-result bubble "Nutty goodness! My tummy is so happy." (49-50), mascot shop faces (62), settings row "Raccoon's name" (63). Absent from the other 31: referral and goal quizzes before the reveal, charts, fasting window picker, water intro, care notice, meal plan, water, nutrition score, challenges, statistics, calendar, streak, most settings. Welcome recording (67 frames at 60 fps): face on lavender for 40 frames (0.67 s), a 5-frame crossfade, then 22 static frames of the hero.

From this full read, one more pattern is in Zest: while a photo is being estimated, the receipt shows the lemon's own line "Hmm, something tasty." beside the dots (BitePal's estimating peek). Patterns read but left out, with the reason: a named mascot and a mascot shop (Zest has one lemon by design), fasting and water mascots (no such features), paywall and account mascots (no paywall, no account).

Both references keep the mascot itself a still illustration on every screen; the motion is in transitions, particles and copy.

Where the mascots appear, from a full read of both catalogues (YAZIO 84 screens and 2 recordings, BitePal 65 screens and 2 recordings):

| App | Mascot on | Not on |
| --- | --- | --- |
| YAZIO | splash (0.6 s hold, 0.2 s fade; food pieces then pop in every ~0.1 s), greeting bubble, hold-to-commit circle, teal welcome, nine interlude screens with props (food, phone, weights, apple, clipboard), plan computation, paywall and "cancel anytime" card, Quiz Hero on purple, a one-second "You're awesome!" tag on the diary ring, shop banner, activity-tracking icon | every diary, food search, recipe, fasting, measurement, profile and settings screen |
| BitePal | 0.9 s face-only splash (static, no blink at 10 fps), intro cards, pet reveal (trash can, lid 0.6 s, pop 0.4 s), name entry, a small avatar beside every question, nine interlude screens (hearts, sweat, sleep, rainbow), personal summary, paywall, account creation, home hero scene with name and hearts, "estimating portions" peek, meal result speech bubble ("Nutty goodness! My tummy is so happy."), theme and mascot shop, settings row "Raccoon's name" | plan computation, challenges, stats, calendar, most settings |

Zest follows the union that fits one lemon: the lemon sits beside every question (BitePal), speaks in a bubble (YAZIO), stays for the computation (YAZIO), climbs onto the sheet 0.6 s after it appears (the reveal beat), celebrates with sparkles (YAZIO), keeps a line on the home screen (BitePal hero) and tags the first diary open (YAZIO). The meal note under a receipt is the lemon's own line about the plate, as BitePal's result bubble is the pet's. The lemon keeps its own gaze and blink on top. Below the greeting the lemon keeps one line in its own voice: nothing logged, today's total against the guide, or the logging streak. Reduce Motion removes the push, the interlude, the computation beat, the hops, the sparkles and the tag.

A blank diary stays neutral. A small logged amount produces a curious expression, values within the guide stay content, and above-guide values produce a playful eyebrow. Copy stays supportive; the character does not prescribe compensation.

Reduce Motion suppresses gaze drift and blinking and removes the calendar's long travel. Hardware sensor and haptic response require a physical device. Native recordings are reviewed at normal speed and in consecutive frames; an encoded 60 fps file alone is not hardware performance evidence.

## Streak

The streak brings people back to log one plate a day. Its design and motion follow Duolingo's streak reveal and streak screen, read frame by frame from the Appllama recording (30 fps, 8,602 frames; the reveal sits at 226-229 s). The counts below come from a per-frame bounding-box measurement of the flame (height, width, colour) run on both the reference clip and Zest's own simulator recording, so the two can be compared like for like and the Streak, Feed and Profile screens, recoloured to Zest's gold.

| Beat | Duolingo (frames at 30 fps, measured per frame on the recording) | Zest (code) |
| --- | --- | --- |
| Reveal | grey flame with a grey "0" and a soft shadow appears within a frame or two and stays 18 frames in all | `FADE` 6 across the receipt, then `HOLD`; `StreakFlame` dim, `Counter` shows the old number |
| Squash | the ears retract and the flame flattens into a pill, 4 frames | `shape` to -1 over 4 frames; the path morphs from `FLAME` to `BEAD` |
| Bead | a soft pill with a small pale spot; it turns gold 4 frames after the squash began | `BEAD_HOLD` 7, `lit` flips at the end of the squash |
| Pop | full flame 11 frames after the squash began, in 1 frame | `shape` 0 in 1 frame, medium haptic (UI-clock reaction) |
| Hold | 10 frames from the pop to the burst, a tall stretch at the end | `HOLD2` 5, `STRETCH` 2 |
| Burst | the "0" squashes and the "1" rises over 3 frames; sparks fly at once | `flip` over 3, `fire` 0→1 over 13, sparks start at the flame's edge, success haptic + headline |
| Settle | the flame overshoots flat and settles by about frame 8 | `shape` -0.3, 0.06, 0 |
| Button | after the sparks | `ready` when `fire` reaches 1; hidden from VoiceOver until then |
| Streak screen | orange band with the number, "day streak!", a flame-in-circle badge, a month calendar with orange dots, "Day practiced" and "Freezes used" tiles | `StreakBand` in the profile: gold band, number, word, flame badge, Monday-first week strip; the calendar sheet already marks logged days |
| Feed card | orange card with a flame and four check dots: "Complete a lesson every day to maintain your streak!" | the lemon's home line carries the streak count |

**Measured side by side (October 30, 2026, iOS 26.4 simulator, Release build):** one script, flame bounding box and colour per 30 fps frame, on the reference clip and on Zest's recording. The first table of this section claimed a 6-frame fade and a 19-frame hold; the per-frame run on the reference gives 18 frames in all, so the code now follows the run.

| Beat, in frames | Duolingo (frames 13-52) | Zest before | Zest now |
| --- | --- | --- | --- |
| Grey on screen | 18 | 23 | 18 in the flow, 20 on the `?streak=1` replay (no receipt to fade across) |
| Squash | 4 | 4 | 4 |
| Squash start to gold | 4 | 5 | 4 |
| Squash start to pop | 11 | 12 | 11 |
| Pop | 1 | 1 | 1 |
| Pop to stretch | 9 | 9 | 10 |
| Pop to sparks | 10 | 11 | 11 |

Every beat is within one frame of the reference. Three things are left different on purpose or for lack of a reason to chase them: gold and pale instead of orange and yellow, round sparks instead of Duolingo's shards, and no device recording yet, since the simulator recording is variable-rate. `zest://?streak=1` replays the celebration for measuring (`scripts/streak-replay.yaml`).

Zest's flame is gold (`theme.soft`) with a pale core; unlit it is warm grey on paper. The celebration plays once per day, 0.7 s after the first saved meal of that day (Duolingo waits about that long after "Learning legend!"), and never on the showcase diary. Reduce Motion shows the final state at once.

## Camera

Zest's own camera replaces the system picker (October 30, 2026), after reading the food-camera screens of Cal AI, Cal Scanner, YAZIO, BitePal, SnapCalorie, Lean, Fitia and MyNetDiary in Appllama: every one of them is a dark full-bleed finder with a centred frame, a gallery shortcut bottom-left, a large shutter and a mode row; Cal AI, Cal Scanner and BitePal put the meal picker ("Lunch ▾") in the top bar, YAZIO and MyNetDiary explain the framing in words ("Put the barcode inside the frame", "A few tips"). Zest keeps the paper chrome of its other sheets and makes the finder itself the dark card: a 1.5 pt white plate ring at 68 % of the finder breathes between 55 % and 100 % opacity and ±1.8 % scale on a 2.2 s ease-in-out cycle until the shutter, four gold ticks mark the compass points, the hint "Centre the plate, then tap the shutter." fades in 300 ms after the feed is ready. The meal chips sit under the finder instead of in the top bar so the thumb reaches them, with the sticker of each meal; the clock pre-selects one. Shutter: 76 pt ink ring, 0.94 press scale, a white flash of 55 ms up and 130 ms down with a medium haptic (unchanged from the template's sample camera). The review state swaps the ring overlay out in 160 ms and shows "Retake" and "Log dinner" (the chosen meal by name), and the receipt follows without a question.

## Helpers

The lemon's rig now drives six helpers (`components/helpers/Figures.tsx`), picked in setup and swapped by holding the one on the composer. Timings, frames, the analysing glow and what Maestro can and cannot verify are in `docs/HELPERS.md`; the still frames are in `docs/images/helpers-frames.png`. Nothing in the tables above changed: question push, greeting interlude, plan computation, reveal and the diary tag keep their measured values, with the tag now in the helper's voice.
