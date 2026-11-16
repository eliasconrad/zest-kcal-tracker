# Model plan (October 30, 2026)

## What was measured

Harness: `server/scripts/eval/` (`prepare.mjs` fetches the photos, `run.mjs` scores a model). Test data: Nutrition5k, overhead photos of weighed cafeteria dishes (CC BY 4.0, Thames et al., CVPR 2021), a fixed sample of 60 dishes with a median of 291 kcal. Tuning used the first 30, the other 30 are held out. The photos are not in the repo.

| Model | Prompt | Dishes scored | Mean error kcal | Mean error % | Bias kcal | Protein / carbs / fat error g | Cost per 1,000 scans |
| --- | --- | --- | --- | --- | --- | --- | --- |
| qwen2.5-vl-72b | old | 29 of 30 | 118 | 50 | +69 | 8 / 12 / 6 | $0.41 |
| qwen2.5-vl-72b | first tuned version | 30 of 30 | 141 | 56 | +126 | 8 / 18 / 6 | $0.59 |
| qwen2.5-vl-72b | final tuned version | 28 of 30 | 110 | 48 | +76 | 9 / 13 / 6 | $0.58 |
| qwen2.5-vl-72b | old, held out | 26 of 30 | 119 | 43 | +32 | 8 / 13 / 8 | $0.37 |
| qwen2.5-vl-72b | final tuned, held out | 2 of 30 | not usable | | | | |

**Reading it honestly:**

- The tuned prompt is not measurably better than the old one. 110 against 118 on 30 dishes is within noise, and the held-out comparison could not finish because the account ran out of credit.
- The first tuned version, which told the model not to guess low, was clearly worse. It is why the rule was removed.
- The tuned prompt stays for now because its note names the assumed portion, so a person can spot a wrong guess. It costs about 40 % more per scan.
- Calibration changed the mean error by at most 12 kcal in either direction. Its value is stopping impossible numbers and inconsistent macros, not improving the average.
- **A scan is an estimate, with a typical error of about half the dish's calories on this data.** "Always accurate" is not reachable with a prompt. The app must keep calling the number an estimate and keep the edit a tap away.
- Nutrition5k plates are small and photographed from straight above, so these numbers do not transfer directly to a phone photo of a full dinner.

Two free open models were tried as well. `gemma-4-31b:free` answered 429 to all 15 requests. `nemotron-3.5-super-vl:free` used up its 160 tokens on reasoning before it gave a line, so 0 of 15 could be read. Neither says anything about accuracy.

Costs are real OpenRouter charges reported per request. Failed requests count as zero in the mean, so runs with failures read slightly low.

## Model choice (measured October 30, 2026)

Same prompt, same weighed Nutrition5k dishes. Tuning set: the first 30 dishes. Held out: the next 30, never used to change the prompt.

| Model | Price per million tokens | Tuning set: error kcal (%) | Held out: error kcal (%) | Bias kcal, tuning / held out | Protein / carbs / fat error g, held out | Cost per 1,000 scans |
| --- | --- | --- | --- | --- | --- | --- |
| **`google/gemma-4-26b-a4b-it` (now in use)** | $0.09 / $0.30 | 83 (32) | 106 (34) | +11 / -14 | 10 / 12 / 7 | **$0.065** |
| `qwen/qwen2.5-vl-72b-instruct` (before) | $0.80 / $1.00 | 91 (38) | 102 (36) | +60 / +22 | 9 / 12 / 8 | $0.62 |
| `mistralai/mistral-small-3.2-24b-instruct` | $0.075 / $0.20 | 87 (33) | 115 (40) | +52 / +9 | 10 / 14 / 8 | $0.11 |
| `qwen/qwen3.5-9b` (28 of 30 scored) | $0.17 / $0.25 | 91 (38) | not run | +39 | | $0.19 |
| `meta-llama/llama-4-scout` | $0.10 / $0.30 | 112 (47) | not run | +76 | | $0.21 |
| `qwen/qwen3-vl-8b-instruct` | $0.25 / $0.75 | 156 (65) | not run | +146 | | $0.20 |

Gemma and Qwen are level on accuracy within noise; Gemma costs a tenth and has the smaller bias, so it is the model. It is open weights. The older table above has Qwen at 110 kcal on the same dishes and this rerun at 91, so differences of this size between runs are noise.

Two ways of asking were tried on Gemma on the tuning set (`scripts/eval/experiment.mjs`) and dropped: the median of three calls (85 kcal against 84, at three times the cost) and listing components with grams before the total (93 kcal). Neither beats one plain call.

**Reading it honestly:** a scan is an estimate, off by about a third of the dish's calories on this data. Nutrition5k plates are small and shot from straight above, so a phone photo of a full dinner can behave differently. What would improve it next is not another prompt but real data: photos with weighed truth from the app, and the person's own corrections.

Through the Worker, Gemma named sample plates in the person's language, refused an illustration as "Not a meal", answered in 2 to 3 seconds (8 s on the first call), kept a conversation, respected a vegetarian profile and declined a 600 kcal crash diet.

## Real fine-tuning, when it is worth it

Not started. OpenRouter does not fine-tune; this needs a GPU and a host.

- **Model:** Qwen2.5-VL-7B (Apache 2.0) with a LoRA adapter. Small enough to train on one GPU and to serve cheaply. Use the 72B only if the 7B cannot beat the prompt-only baseline.
- **Data:** Nutrition5k has about 3,500 dishes with overhead photos and weighed nutrition, usable commercially under CC BY 4.0 with attribution. It is cafeteria food, so add own photos with weighed truth before trusting it on home cooking: at least a few hundred, ideally from real users who edit their estimates (with consent).
- **Host:** any GPU provider with an OpenAI-compatible endpoint, in the EU for the photos. The Worker then only changes `OPENROUTER_BASE_URL` and `OPENROUTER_MODEL`. An always-on GPU costs hundreds of euros a month, so serverless GPU or a per-token fine-tune host only makes sense once there is real volume. Treat these as estimates and get a quote first.
- **Gate:** the harness on the held-out dishes. A fine-tune replaces the current model only if its mean error drops by at least 20 % at a comparable cost per scan.

Recommendation: top up, finish the comparison, and switch to the cheapest model that matches the current error. Fine-tune only after that, once real user corrections exist as training data.
