/**
 * The two pages Apple requires a link to. DRAFT: the operator's name and address
 * must be filled in and the text reviewed before release.
 */
const page = (title: string, body: string) =>
  new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Zest - ${title}</title><style>body{font:17px/1.55 -apple-system,system-ui,sans-serif;color:#252720;background:#F3F3F0;max-width:640px;margin:0 auto;padding:32px 22px}h1{font-size:30px;letter-spacing:-.02em}h2{font-size:19px;margin-top:28px}</style><body><h1>${title}</h1>${body}</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );

const operator = "<p><strong>Operator:</strong> [name and address to be added before release]</p>";

export const legalPages: Record<string, () => Response> = {
  "/legal/privacy": () =>
    page(
      "Privacy",
      `${operator}
<h2>What Zest handles</h2>
<p><strong>On your phone:</strong> your profile, diary and meal photos.</p>
<p><strong>A meal photo you scan</strong> is reduced in size, stripped of its metadata and sent through our server to an AI model provider (OpenRouter and the model host it routes to) to estimate the meal. We do not store the photo on our server.</p>
<p><strong>If you create an account:</strong> your e-mail, name, a hash of your password, your profile (including body data, way of eating and allergies) and your diary entries without photos, stored with Cloudflare in the EU, so they can follow you to a new phone.</p>
<p><strong>Without an account:</strong> a random guest id and how many scans you used today, to apply the free limit.</p>
<p><strong>Friends:</strong> people you connect with see your name, streak and whether you logged today. They see your daily calories only if you switch that on for them.</p>
<p><strong>Purchases</strong> are handled by Apple. We receive a signed record of the subscription, not your payment details.</p>
<h2>Why</h2>
<p>To provide the app you asked for (Art. 6(1)(b) GDPR). Allergies and body data can count as health data, so they are only sent when you create an account or ask Zest a question, with your consent (Art. 9(2)(a) GDPR).</p>
<h2>Your rights</h2>
<p>You can delete your account and everything on our server inside the app, under Profile, Manage, Delete account. You also have the rights to access, correction, portability, objection and to complain to a supervisory authority.</p>
<p>Zest is for people aged 16 and over. No tracking, no ads.</p>`,
    ),
  "/legal/terms": () =>
    page(
      "Terms",
      `${operator}
<h2>Estimates, not advice</h2>
<p>Calories and nutrients in Zest are estimates. Zest is not a medical device and does not give medical advice. Talk to a doctor before changing your diet if you are pregnant, have a medical condition or a difficult relationship with food. Always check labels if you have an allergy.</p>
<h2>Zest Pro</h2>
<p>Zest Pro is an auto-renewing subscription, charged to your Apple ID. It renews at the same price unless you cancel at least 24 hours before the end of the period, in your App Store settings. Apple's standard terms apply (https://www.apple.com/legal/internet-services/itunes/dev/stdeula/).</p>
<h2>Your account</h2>
<p>Keep your password to yourself. You may delete your account at any time inside the app.</p>`,
    ),
};
