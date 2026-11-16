/**
 * What the paywall says and which products it sells. Prices never live here:
 * they come from the App Store at runtime. Copy and order can be overridden from
 * /v1/config, so an experiment needs no app update.
 */
export const productIds = {
  monthly: "eu.eliasconrad.zest.pro.monthly",
  yearly: "eu.eliasconrad.zest.pro.yearly",
} as const;

export type PlanId = keyof typeof productIds;

export type PaywallConfig = {
  benefits: string[];
  highlight: PlanId;
  line: string;
};

export const defaultPaywall: PaywallConfig = {
  benefits: [
    "Unlimited meal scans, not three a day",
    "Ask me anything about your day, as often as you like",
    "Recipes that fit what’s left of today",
  ],
  highlight: "yearly",
  line: "Less counting. More eating.",
};

/** Bad or missing remote values fall back one by one, so a typo cannot blank the paywall. */
export function paywallConfig(remote: Record<string, string> | null | undefined): PaywallConfig {
  let benefits = defaultPaywall.benefits;
  try {
    const parsed = remote?.paywall_benefits ? JSON.parse(remote.paywall_benefits) : null;
    if (Array.isArray(parsed) && parsed.length >= 1 && parsed.every((item) => typeof item === "string"))
      benefits = parsed.slice(0, 5);
  } catch {
    // Keep the defaults.
  }
  const highlight = remote?.paywall_highlight;
  return {
    benefits,
    highlight: highlight === "monthly" || highlight === "yearly" ? highlight : defaultPaywall.highlight,
    line: remote?.paywall_line?.trim() || defaultPaywall.line,
  };
}

/** The monthly equivalent of a yearly price, in the store's currency; null when it cannot be formatted. */
export function perMonth(yearly: number, currency: string, locale?: string) {
  if (!Number.isFinite(yearly) || yearly <= 0 || !currency) return null;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(yearly / 12);
  } catch {
    return null;
  }
}

/** Where the legal pages live. Apple requires both links on the paywall. */
export const LEGAL_BASE = "https://zest-api.hallo-e53.workers.dev/legal";
