import { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { SheetShell } from "./ui/SheetShell";
import { Note, PrimaryButton, TextLink } from "./ui/Form";
import { Symbol, Touch } from "./ui/Touch";
import { Selectable, SelectableText } from "./ui/Selectable";
import { LEGAL_BASE, defaultPaywall, paywallConfig, perMonth, type PaywallConfig, type PlanId } from "../data/plans";
import { buy, loadPlans, restore, type StorePlan } from "../data/purchases";
import { formatWeight, type Units } from "../data/nutrition";
import { session } from "../state/useSession";
import { theme } from "../theme";
import type { Scene } from "../hooks/useScene";

/** Prices only ever come from the App Store; no discount, countdown or star is invented here. */
export function Paywall({
  scene,
  reason,
  goal,
  targetKg,
  units,
  onClose,
  onPro,
}: {
  scene: Scene;
  /** After onboarding it can be closed in a moment; at the free limit it says why it is here. */
  reason: "soft" | "limit";
  goal: string;
  targetKg: number;
  units: Units;
  onClose: () => void;
  onPro: () => void;
}) {
  const [config, setConfig] = useState<PaywallConfig>(defaultPaywall);
  const [plans, setPlans] = useState<StorePlan[] | null>(null);
  const [picked, setPicked] = useState<PlanId>(defaultPaywall.highlight);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => {
    let live = true;
    void session
      .get<Record<string, string>>("/v1/config")
      .then((remote) => {
        if (!live) return;
        const next = paywallConfig(remote);
        setConfig(next);
        setPicked(next.highlight);
      })
      .catch(() => {});
    void loadPlans()
      .then((list) => live && setPlans(list))
      .catch(() => live && setPlans([]));
    return () => {
      live = false;
    };
  }, []);
  const selected = plans?.find((plan) => plan.id === picked) ?? plans?.[0];
  const headline =
    reason === "limit"
      ? "That’s today’s free scans."
      : goal === "lose" || goal === "gain"
        ? `Let’s get you to ${formatWeight(targetKg, units)}.`
        : "Keep every plate easy.";
  const purchase = async (work: () => Promise<boolean>, none: string) => {
    if (busy) return;
    setBusy(true);
    setNote("");
    try {
      if (await work()) onPro();
      else setNote(none);
    } catch {
      setNote("The App Store didn’t finish that. You weren’t charged twice; try again in a moment.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <SheetShell
      scene={scene}
      title={headline}
      closeLabel="Close paywall"
      closeAfterMs={reason === "soft" ? 1500 : 0}
      onClose={onClose}
      zIndex={47}
    >
      <Text style={{ fontSize: 15, lineHeight: 21, color: theme.muted, marginBottom: 14 }}>
        {reason === "limit" ? "They come back tomorrow. Or go unlimited now." : config.line}
      </Text>
      {config.benefits.map((benefit) => (
        <View key={benefit} style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          <Symbol name="checkmark" size={15} color={theme.accent} />
          <Text style={{ flex: 1, fontSize: 15, lineHeight: 20, color: theme.ink }}>{benefit}</Text>
        </View>
      ))}
      <View style={{ gap: 8, marginTop: 8, marginBottom: 14 }}>
        {plans === null && <Note>Asking the App Store for prices…</Note>}
        {plans?.length === 0 && (
          <Note>The App Store isn’t answering right now, so there’s nothing to buy yet. Try again later.</Note>
        )}
        {plans?.map((plan) => {
          const on = plan.id === selected?.id;
          const monthly = plan.id === "yearly" ? perMonth(plan.price, plan.currency) : null;
          return (
            <Touch
              key={plan.id}
              label={`${plan.id === "yearly" ? "Yearly" : "Monthly"}, ${plan.displayPrice}`}
              selected={on}
              onPress={() => setPicked(plan.id)}
              expand
            >
              <Selectable
                selected={on}
                style={{
                  minHeight: 64,
                  borderRadius: 20,
                  borderCurve: "continuous",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View>
                  <SelectableText style={{ fontSize: 17, fontWeight: "600" }}>
                    {plan.id === "yearly" ? "Yearly" : "Monthly"}
                  </SelectableText>
                  {plan.trialDays !== null && (
                    <SelectableText from={theme.muted} to="#D9DAD3" style={{ fontSize: 13 }}>
                      {plan.trialDays} days free, then billed
                    </SelectableText>
                  )}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <SelectableText style={{ fontSize: 17, fontWeight: "600" }}>
                    {plan.displayPrice}
                  </SelectableText>
                  {!!monthly && (
                    <SelectableText from={theme.muted} to="#D9DAD3" style={{ fontSize: 13 }}>{monthly} a month</SelectableText>
                  )}
                </View>
              </Selectable>
            </Touch>
          );
        })}
      </View>
      <PrimaryButton
        label={selected?.trialDays ? "Start free trial" : "Continue"}
        disabled={busy || !selected}
        onPress={() => selected && void purchase(() => buy(selected), "")}
      />
      {!!note && <Note>{note}</Note>}
      <Text style={{ fontSize: 12, lineHeight: 17, color: theme.muted, marginTop: 12 }}>
        Payment is charged to your Apple ID {selected?.trialDays ? "when the trial ends" : "when you confirm"}. The subscription renews automatically at the same price unless you cancel at least 24 hours before the period ends. Manage or cancel it in your App Store settings.
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <TextLink label="Restore" onPress={() => void purchase(restore, "No purchase to restore.")} />
        <TextLink label="Terms" onPress={() => void Linking.openURL(`${LEGAL_BASE}/terms`)} />
        <TextLink label="Privacy" onPress={() => void Linking.openURL(`${LEGAL_BASE}/privacy`)} />
      </View>
    </SheetShell>
  );
}
