# Onboarding research (October 30, 2026)

Source: the onboarding sections of eight calorie trackers in Appllama, read as screen metadata (names, controls) and, for YAZIO and BitePal, as the full screen sheets already studied for `MOTION_SPEC.md`. 25 Appllama calls. Screens are described, never copied.

## What the apps ask, in order

| App (steps) | Personal and bodily facts, in order | Good | Bad | Zest takes |
| --- | --- | --- | --- | --- |
| **Cal AI** (38) | sex → workouts per week → where you heard of us → tried other apps → height and weight (toggle metric) → birth date (three wheels) → nutrition coach? → goal → desired weight (ruler) → pace (recommended badge) → motivation → **diet** (classic, pescatarian, vegetarian, vegan) → coaching preference → Apple Health → calorie-rollover, review walls, reminder, referral code → plan calculation with percent counter → plan summary → sign in (Apple, Google, e-mail) → trial | The rulers and wheels make numbers fast; a "recommended" badge on the pace; the plan appears with a checklist before the summary | 38 steps, two review screens with stars, a referral screen and "did you try other apps" are for marketing, not for the plan; the account comes after the plan but before the first use | diet as a single choice; the date of birth instead of a year; a recommended pace |
| **YAZIO** (50) | goal → **name** → why lose weight → anything else to achieve → hold-to-commit → education → challenges faced → what impacted your weight → tracked before? → fasting? → how you plan to stay on track → how you feel → **birthday (wheels)** → height → activity → weight → target → special event? → minutes per day → streak challenge → **specific diet** (classic, pescatarian, vegetarian, vegan) → weekends harder? → what makes you eat when not hungry → how you plan on staying consistent → achievements → children? → work schedule → setback help → plan → weekends again → which meals show up most → how you'd like to track (photo, manual, mix) → paywall, spin wheel | The one app that asks "which meals show up most in your routine" (restaurant, home-cooked, mix) and how you want to track; a greeting with the name; the commit gesture | 50 steps; "do you have children" and "work schedule" are never used by the plan; two paywall spins | obstacles ("what got in the way"), which meals are usual, the hold-to-commit (already in) |
| **BitePal** (35) | intro cards → referral quiz → goal quiz → pet reveal → **name the pet** → rating ask → support → eating habits → fasting window → water → goals, sex, age, height, weight, target, activity, diet, each with the mascot in a bubble → personal summary → paywall → account | The mascot carries every question; eating-habits and fasting questions feed real features | Asks for a rating before any value; the account sits behind the paywall | the mascot line per step (already in) |
| **MyFitnessPal** (21) | sign up (Apple, Google, e-mail) → first name → goals (multi) → education → barriers (multi) → medication question (with privacy note) → habits (chips) → meal-planning frequency → meal plan opt-in → activity → **sex, birth date, country** → height and weight → weekly goal → create account (e-mail, password, terms) → feature pitch | Barrier and habit questions, each with an education card after; clear privacy note on the medical question | Account first, before any value; a medication question needs a medical privacy footing Zest does not want | barriers, a plain privacy sentence on the body step |
| **Calo** (44) | consent → social proof → goal → motivation → sex (with privacy note) → age (wheel) → height (ruler with BMI card) → weight → target → education → activity → **health concerns** → profile summary with BMI gauge → **diet preference** → **water intake** → **meal frequency** → deficit familiarity → tracking frequency → calorie awareness → barriers → scan intro → three yes/no statement cards → social proof → plan generation with reviews → forecast → diary | Meal frequency and water are asked and used; the BMI card next to height | 44 steps, health concerns and BMI gauges are medical territory; three "yes/no" statement screens pad the flow | meal frequency; no health questions |
| **fatsecret** (34) | privacy consent (three screens) → first name → welcome → weight goal → health goals (multi, with a limit) → challenges (multi) → RDI intro → height → weight → goal weight → **date of birth (wheels with computed age)** → sex (learn-more link) → activity → plan building → plan with editable calorie target → account (Apple, Google, e-mail) → password with strength label | The computed age next to the birth date; the editable calorie target on the plan | Three consent screens before the first question; two "thank you" interstitials | the computed age label |
| **Lean** (24) | sex → workouts → comparison → height → weight → age → goal → desired weight → projection → pace (slider) → comparison → barriers → **diet** → motivation → fasting experience → journey preview → **notifications (explained, then the system alert)** → summary → plan | The notification ask is explained on its own screen before the system alert; the summary tiles before the plan | Two comparison screens that promise results | the explained notification step |
| **SnapCalorie** (21) | feature intros → rate us → **registration (e-mail, password with eye)** → referral source → e-mail verification → plan intro → sex → birth date → weight → height → activity → target → pace → timeline → plan summary → plan details → notification alert | Plan details split in two readable cards | Registration and e-mail verification before a single question | nothing new |

## Patterns across all eight

- Every app asks sex, age (five of eight as a full birth date), height, weight, goal, target and activity. Pace is asked by five. Diet pattern by five. Barriers or obstacles by five. Meal frequency or usual meals by two (YAZIO, Calo). Reminders with a notification ask by three (Cal AI, Lean, SnapCalorie). Allergies by none of the eight; they appear later in settings.
- Step counts run from 21 to 50. The questions that produce the plan are 7 to 9 of them; the rest is education, social proof, paywall and account.
- Health conditions and medication are asked by MyFitnessPal and Calo only, each with a privacy note. Zest does not ask them (no medical claims, see `INTEGRATION.md`).
- Four of eight ask for the account before any value is shown (MyFitnessPal, SnapCalorie, fatsecret's consent, Calo's consent). The best-rated flows (Cal AI, Lean) put the account after the plan.

## Zest's field list

Kept from before: name, goal, sex, height, weight, units, target weight, pace, activity, account, plan.

Added in this round, with the reason:

| Field | Why | Used by |
| --- | --- | --- |
| Date of birth (day, month, year) instead of a birth year | five of eight ask it; the plan's age is exact | `plan` age, profile |
| Dietary pattern: no pattern, vegetarian, vegan, pescatarian, halal, kosher | five of eight ask it; it changes the macro split and what the model may suggest | macro split (vegan and vegetarian: protein at the lower bound, carbs up), model context |
| Allergies and intolerances, multi-select plus a free line | no reference asks it, every reference regrets it in settings; the model must never suggest them | model context, recipes later |
| Usual meals (breakfast, lunch, dinner, snacks) | YAZIO and Calo; drives the camera's default meal and the reminders | `defaultMealType`, reminders |
| What got in the way before (multi-select) | five of eight; it gives the lemon its lines, nothing else | lemon lines only |
| Reminders: pick the meals to be reminded of, then the system notification ask, skippable | Cal AI, Lean, SnapCalorie; Lean explains before the alert | local notifications at the usual meal times |

Left out on purpose: health conditions, medication, water, fasting, children, work schedule, "where did you hear of us", ratings and comparisons. Thirteen steps for a weight goal, eleven for maintenance.

## Grow and Cal AI (October 30, 2026)

Read frame by frame from a 110 s recording of Grow's onboarding, supplied by Elias, and Cal AI's onboarding video in Appllama (`onb_ip57t`). Screens are described, never copied.

| What | Grow | Cal AI | Zest takes |
| --- | --- | --- | --- |
| First screen | awards, a watch with a living face, one button | a phone slides in tilted from the lower right, straightens and shows the camera working; one line, "Get Started", "Already have an account? Sign In" | Cal AI's: a phone with a real recording of Zest, one line, "Get started", "I already have an account" |
| Story screens | one line and a moving drawing each: bubbles falling, a jar filling, a heartbeat, a seesaw | a chart of the weight curve | no extra screens; the pace step draws the way to the target |
| Question list | big bold title top left, rows with a colourful icon, a label and a radio; Continue greyed until an answer | the same without icons | Grow's rows |
| Choosing | the row turns white and lifts, the radio fills with a check, four pairs of short ticks fly off its corners in the icon's colour, about 0.4 s | the row turns black | Grow's, with the gold check |
| Entering a question | content fades out, the title sharpens from blur, rows rise one by one about 70-100 ms apart | the same stagger | rows rise 70 ms apart; the title fades, no blur |
| Progress | segmented bar under a back chevron | thin bar | the existing bar |
| Computing | icons orbit a logo, a big percent climbs, a checklist ticks off | percent ring and checklist | orbit of food and body drawings, percent, the existing checklist |
| Result | 2-column tiles with an icon each | grid of cards | the guide with a drawn icon per macro |
| Haptics | cannot be read from a video | cannot be read from a video | selection tick on a choice, light impact on a step, as before |
| Copy | titles of 3-7 words, one line of detail | the same | already there |

Zest keeps its own questions, paper colour and mascot. Where Grow has no mascot, Zest's stands on the sheet's edge with props drawn for each step. Every drawing is in `components/onboarding/drawings.ts`.

Minimum age: 16, as on the privacy page. A calorie deficit is not meant for a body still growing, the Mifflin-St Jeor formula is made for adults, and 16 is the age of digital consent in Germany. A finished date below that shows the reason under the field and Continue stays off.
