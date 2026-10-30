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

## Cheaper models to compare (prices checked October 30, 2026, per million tokens, input / output)

| Model | Price | Note |
| --- | --- | --- |
| `qwen/qwen2.5-vl-72b-instruct` | $0.80 / $1.00 | current, measured above |
| `mistralai/mistral-small-3.2-24b-instruct` | $0.075 / $0.20 | open weights |
| `google/gemma-4-26b-a4b-it` | $0.09 / $0.30 | open weights |
| `meta-llama/llama-4-scout` | $0.10 / $0.30 | open weights |
| `qwen/qwen3.5-9b` | $0.17 / $0.25 | open weights |
| `qwen/qwen3-vl-8b-instruct` | $0.25 / $0.75 | open weights |

None of them is measured yet. The free Gemma 4 answered only 3 of 20 dishes before its rate limit, which proves nothing about accuracy. `server/scripts/eval/compare.sh` scores all six on the same 30 dishes once the account has credit. The model only changes if it is not worse on error. Text answers can use a cheaper model through `OPENROUTER_CHAT_MODEL`.

## Blocked: the OpenRouter account has no credit

The account shows 0 credits and $0.16 used. Paid requests now return HTTP 402. Until it is topped up, scans in production fail and show the failure state. Five dollars buys about 8,000 scans at the measured price. After topping up, run:

```bash
cd server
export NODE_USE_ENV_PROXY=1   # only behind a proxy
node --experimental-strip-types scripts/eval/run.mjs --prompt tuned --tag heldout --offset 30 --concurrency 2
for m in qwen/qwen3-vl-30b-a3b-instruct meta-llama/llama-4-scout google/gemma-3-27b-it mistralai/mistral-small-3.2-24b-instruct; do
  node --experimental-strip-types scripts/eval/run.mjs --model "$m" --prompt tuned --concurrency 2
done
```

Prices listed by OpenRouter on October 30, 2026, per million tokens in and out: qwen3-vl-30b $0.15 / $0.60, llama-4-scout $0.10 / $0.30, gemma-3-27b $0.08 / $0.35, mistral-small-3.2 $0.075 / $0.20. The current model lists at $0.80 / $1.00.

## Real fine-tuning, when it is worth it

Not started. OpenRouter does not fine-tune; this needs a GPU and a host.

- **Model:** Qwen2.5-VL-7B (Apache 2.0) with a LoRA adapter. Small enough to train on one GPU and to serve cheaply. Use the 72B only if the 7B cannot beat the prompt-only baseline.
- **Data:** Nutrition5k has about 3,500 dishes with overhead photos and weighed nutrition, usable commercially under CC BY 4.0 with attribution. It is cafeteria food, so add own photos with weighed truth before trusting it on home cooking: at least a few hundred, ideally from real users who edit their estimates (with consent).
- **Host:** any GPU provider with an OpenAI-compatible endpoint, in the EU for the photos. The Worker then only changes `OPENROUTER_BASE_URL` and `OPENROUTER_MODEL`. An always-on GPU costs hundreds of euros a month, so serverless GPU or a per-token fine-tune host only makes sense once there is real volume. Treat these as estimates and get a quote first.
- **Gate:** the harness on the held-out dishes. A fine-tune replaces the current model only if its mean error drops by at least 20 % at a comparable cost per scan.

Recommendation: top up, finish the comparison, and switch to the cheapest model that matches the current error. Fine-tune only after that, once real user corrections exist as training data.
