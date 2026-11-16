/**
 * Renders the Zest Instagram kit from the app's own lemon, stickers, and screenshots.
 * Run: node instagram/render.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = join(root, "instagram/.tmp");
const out = join(root, "instagram");
const icon = join(root, "assets/images/icon.svg");
const wink = join(root, "assets/cookbooks/zest/mascot/wink.svg");
const stickers = {
  eggs: join(root, "assets/cookbooks/zest/stickers/eggs.svg"),
  bowl: join(root, "assets/cookbooks/zest/stickers/bowl.svg"),
  pasta: join(root, "assets/cookbooks/zest/stickers/pasta.svg"),
  toast: join(root, "assets/cookbooks/zest/stickers/toast.svg"),
  orange: join(root, "assets/cookbooks/zest/stickers/orange.svg"),
};
const shots = {
  welcome: join(root, "docs/images/welcome.png"),
  meal: join(root, "docs/images/meal.png"),
  calendar: join(root, "docs/images/calendar.png"),
};

const paper = "#F3F3F0";
const ink = "#252720";
const muted = "#70726B";

const css = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: ${paper}; overflow: hidden; }
  body {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: ${ink};
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
  }
  img { display: block; }
`;

function page(width, height, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${css}
    body { width: ${width}px; height: ${height}px; }
  </style></head><body>${body}</body></html>`;
}

function lemon(size) {
  return `<img src="${icon}" width="${size}" height="${size}" alt="">`;
}

const camera = `
<svg width="560" height="454" viewBox="0 0 120 100" fill="none" aria-hidden="true">
  <path d="M44 28h8l5-10h16l5 10h8" stroke="${ink}" stroke-width="6.5" stroke-linejoin="round" stroke-linecap="round"/>
  <rect x="16" y="28" width="88" height="60" rx="16" stroke="${ink}" stroke-width="6.5"/>
  <circle cx="60" cy="58" r="16" fill="#F3CE48" stroke="${ink}" stroke-width="6.5"/>
  <circle cx="54" cy="53" r="3.5" fill="#FFF9DF"/>
</svg>`;

const calendar = `
<svg width="620" height="620" viewBox="0 0 150 150" fill="none" aria-hidden="true">
  <rect x="8" y="8" width="134" height="134" rx="32" fill="#FFFFFF"/>
  <circle cx="46" cy="48" r="8" fill="#E4E3DC"/>
  <circle cx="75" cy="48" r="8" fill="#E4E3DC"/>
  <circle cx="104" cy="48" r="8" fill="#C9AC50"/>
  <circle cx="46" cy="78" r="8" fill="#E4E3DC"/>
  <circle cx="75" cy="78" r="8" fill="#E4E3DC"/>
  <circle cx="104" cy="78" r="8" fill="#E4E3DC"/>
  <circle cx="46" cy="108" r="8" fill="#E4E3DC"/>
  <circle cx="75" cy="108" r="8" fill="#E4E3DC"/>
  <circle cx="104" cy="108" r="8" fill="#E4E3DC"/>
</svg>`;

const ring = `
<svg width="680" height="680" viewBox="0 0 200 200" fill="none" aria-hidden="true">
  <circle cx="100" cy="100" r="74" stroke="#E4E3DC" stroke-width="18"/>
  <circle cx="100" cy="100" r="74" stroke="#C9AC50" stroke-width="18" stroke-linecap="round"
    stroke-dasharray="325 465" transform="rotate(118 100 100)"/>
</svg>`;

const flame = `
<svg width="460" height="640" viewBox="22 0 56 86" fill="none" aria-hidden="true">
  <path d="M50 2 C58 18 76 28 76 52 C76 70 64 82 50 82 C36 82 24 70 24 52 C24 44 28 38 31 34 C33 44 38 48 42 46 C38 34 42 18 50 2 Z" fill="#C9AC50"/>
  <path d="M50 42 C56 50 62 54 62 62 C62 69 56 74 50 74 C44 74 38 69 38 62 C38 56 44 50 50 42 Z" fill="#F4E7BF"/>
</svg>`;

function stage(inner, { width = 1080, height = 1080, pad = 0 } = {}) {
  return page(
    width,
    height,
    `<div style="width:${width}px;height:${height}px;display:flex;align-items:center;justify-content:center;padding:${pad}px;">${inner}</div>`,
  );
}

function poster(inner, height = 1350) {
  return page(
    1080,
    height,
    `<div style="width:1080px;height:${height}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:96px;">${inner}</div>`,
  );
}

const h1 = `font-size:92px;line-height:0.98;font-weight:700;letter-spacing:-0.045em;margin:0;`;
const sub = `font-size:32px;line-height:1.25;font-weight:500;letter-spacing:-0.02em;color:${muted};margin:22px 0 0;`;

function crop(file, top) {
  // Source frames are 1206×2622. At width 1080 the image is 2348px tall.
  return page(
    1080,
    1350,
    `<div style="width:1080px;height:1350px;overflow:hidden;position:relative;background:${paper};">
      <img src="${file}" style="position:absolute;left:0;width:1080px;height:auto;top:${top}px;" alt="">
    </div>`,
  );
}

const files = {
  // Sit the lemon inside the circle with a clear margin, optically centered.
  "profile.png": page(
    1080,
    1080,
    `<div style="width:1080px;height:1080px;overflow:hidden;position:relative;">
      <img src="${icon}" alt="" style="position:absolute;width:790px;height:790px;left:136px;top:151px;">
    </div>`,
  ),
  "highlights/01-log.png": stage(camera),
  "highlights/02-meals.png": stage(
    `<img src="${stickers.pasta}" width="760" height="760" alt="">`,
  ),
  "highlights/03-diary.png": stage(calendar),
  "highlights/04-guide.png": stage(ring),
  "highlights/05-streak.png": stage(flame),
  "highlights/06-lemon.png": stage(
    `<img src="${wink}" width="820" height="820" alt="">`,
  ),

  "posts/01-snap-the-plate.png": poster(`
    ${lemon(700)}
    <h1 style="${h1} margin-top:28px;">Snap the plate.</h1>
    <p style="${sub}">A food diary, kept by one lemon.</p>
  `),
  "posts/02-good-evening.png": page(
    1080,
    1350,
    `<div style="width:1080px;height:1350px;display:flex;flex-direction:column;align-items:center;padding:88px 72px 120px;">
      <div style="font-size:40px;font-weight:600;letter-spacing:-0.04em;">Zest</div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;">${lemon(640)}</div>
      <h1 style="${h1} font-size:84px;">Good evening.</h1>
      <div style="margin-top:48px;background:#fff;border-radius:999px;padding:26px 44px;display:flex;align-items:center;gap:14px;box-shadow:0 12px 28px rgba(37,39,32,0.06);">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M8 7h1.4l.7-1.6h3.8L14.6 7H16" stroke="${ink}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>
          <rect x="4" y="7" width="16" height="11" rx="3" stroke="${ink}" stroke-width="1.7"/>
          <circle cx="12" cy="12.5" r="2.6" stroke="${ink}" stroke-width="1.7"/>
        </svg>
        <span style="font-size:36px;font-weight:600;letter-spacing:-0.03em;">Log a meal</span>
      </div>
    </div>`,
  ),
  "posts/03-a-photo.png": poster(`
    <div style="width:100%;text-align:left;">
      <div style="width:86px;height:8px;border-radius:8px;background:#C9AC50;margin:0 0 40px;"></div>
      <h1 style="${h1} text-align:left;">A photo.<br>A number.<br>A few words.</h1>
    </div>
  `),
  "posts/04-the-receipt.png": crop(shots.meal, -310),
  "posts/05-stickers.png": poster(`
    <h1 style="${h1}">A diary made<br>of stickers.</h1>
    <div style="display:flex;gap:28px;margin-top:72px;align-items:flex-end;">
      <img src="${stickers.eggs}" width="250" height="250" alt="" style="transform:rotate(-8deg)">
      <img src="${stickers.bowl}" width="270" height="270" alt="">
      <img src="${stickers.toast}" width="250" height="250" alt="" style="transform:rotate(7deg)">
    </div>
  `),
  "posts/06-the-month.png": crop(shots.calendar, -160),
  "posts/07-your-guide.png": poster(`
    <h1 style="${h1}">Your guide.</h1>
    <p style="${sub} max-width:760px;">An estimate to lean on, not a grade.</p>
    <div style="display:flex;gap:18px;margin-top:64px;width:100%;">
      ${[
        ["Protein", "#85916C"],
        ["Carbs", "#C9AC50"],
        ["Fat", "#B08968"],
      ]
        .map(
          ([label, color]) => `
        <div style="flex:1;background:#fff;border-radius:36px;overflow:hidden;text-align:left;">
          <div style="height:168px;background:${color};"></div>
          <div style="padding:28px 26px 32px;font-size:32px;font-weight:600;letter-spacing:-0.03em;">${label}</div>
        </div>`,
        )
        .join("")}
    </div>
  `),
  "posts/08-come-back.png": poster(`
    <img src="${wink}" width="560" height="560" alt="">
    <h1 style="${h1} margin-top:28px;">Come back<br>tomorrow.</h1>
    <p style="${sub}">Log a meal. Keep the streak.</p>
  `),
  "posts/09-log-a-meal.png": poster(`
    ${lemon(440)}
    <div style="margin-top:56px;background:#fff;border-radius:999px;padding:28px 48px;display:flex;align-items:center;gap:16px;box-shadow:0 10px 30px rgba(37,39,32,0.08);">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 7h1.4l.7-1.6h3.8L14.6 7H16" stroke="${ink}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>
        <rect x="4" y="7" width="16" height="11" rx="3" stroke="${ink}" stroke-width="1.7"/>
        <circle cx="12" cy="12.5" r="2.6" stroke="${ink}" stroke-width="1.7"/>
      </svg>
      <span style="font-size:40px;font-weight:600;letter-spacing:-0.03em;">Log a meal</span>
    </div>
    <p style="${sub}">One photo starts the diary.</p>
  `),

  "stories/01-log.png": story(`
    ${camera}
    <h1 style="${h1} margin-top:64px;font-size:84px;">Take a photo<br>of the plate.</h1>
    <p style="${sub}">Zest estimates it and keeps the meal.</p>
  `),
  "stories/02-meals.png": story(`
    <img src="${stickers.pasta}" width="520" height="520" alt="">
    <h1 style="${h1} margin-top:48px;font-size:80px;">It comes back<br>as a receipt.</h1>
    <p style="${sub}">A name, the calories, and one line.</p>
  `),
  "stories/03-diary.png": story(`
    ${calendar}
    <h1 style="${h1} margin-top:56px;font-size:84px;">The month,<br>in stickers.</h1>
    <p style="${sub}">Every meal stays on its day.</p>
  `),
  "stories/04-guide.png": story(`
    ${ring}
    <h1 style="${h1} margin-top:56px;font-size:80px;">Your guide.</h1>
    <p style="${sub} max-width:760px;">An estimate to lean on, not a grade.</p>
  `),
  "stories/05-streak.png": story(`
    ${flame}
    <h1 style="${h1} margin-top:36px;font-size:84px;">Log today.</h1>
    <p style="${sub}">A meal keeps the streak.</p>
  `),
  "stories/06-lemon.png": story(`
    <img src="${wink}" width="640" height="640" alt="">
    <h1 style="${h1} margin-top:28px;font-size:84px;">One lemon.</h1>
    <p style="${sub}">It keeps the diary with you.</p>
  `),
};

function story(inner) {
  return page(
    1080,
    1920,
    `<div style="width:1080px;height:1920px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:120px 88px 280px;">${inner}</div>`,
  );
}

const chrome =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

mkdirSync(tmp, { recursive: true });

const jobs = Object.entries(files);
for (const [name, html] of jobs) {
  const htmlPath = join(tmp, name.replaceAll("/", "__") + ".html");
  const pngPath = join(out, name);
  mkdirSync(dirname(pngPath), { recursive: true });
  writeFileSync(htmlPath, html);
  const height = name.startsWith("stories/")
    ? 1920
    : name.startsWith("posts/")
      ? 1350
      : 1080;
  // UI screenshots are only 1206px wide, so keep them at 1x. Vector pieces
  // render at 2x so the avatar and type stay sharp.
  const scale = /posts\/0(4|6)-/.test(name) ? 1 : 2;
  if (existsSync(pngPath) && statSync(pngPath).size > 1000 && !process.argv.includes("--force")) {
    console.log("skip", name);
    continue;
  }
  try {
    execFileSync(
      chrome,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--no-first-run",
        `--force-device-scale-factor=${scale}`,
        `--window-size=1080,${height}`,
        "--default-background-color=FFF3F3F0",
        "--allow-file-access-from-files",
        "--virtual-time-budget=2000",
        `--screenshot=${pngPath}`,
        `file://${htmlPath}`,
      ],
      { timeout: 25000, stdio: "pipe" },
    );
  } catch (error) {
    if (!existsSync(pngPath) || statSync(pngPath).size < 1000) throw error;
    console.warn("chrome closed early after writing", name);
  }
  console.log("wrote", name);
}

rmSync(tmp, { recursive: true, force: true });
console.log(`rendered ${jobs.length} images`);
