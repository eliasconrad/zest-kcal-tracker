import { useEffect, useState } from "react";
import { Alert, Linking, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { SheetShell } from "./ui/SheetShell";
import { Field, Gap, Note, PrimaryButton, TextLink } from "./ui/Form";
import { AccountError } from "../data/session";
import { validEmail } from "../data/diary";
import { pushProfile, restoreAccount, syncDiary } from "../data/sync";
import { restore } from "../data/purchases";
import { session, useSessionUser } from "../state/useSession";
import { useProfile } from "../state/useProfile";
import type { Scene } from "../hooks/useScene";

export type AccountMode = "manage" | "create" | "login" | "forgot" | "reset" | "delete" | "password";

function message(error: unknown) {
  if (!(error instanceof AccountError)) return "Something went wrong. Try again.";
  switch (error.code) {
    case "offline":
      return "I can’t reach the kitchen. Check your connection and try again.";
    case "credentials":
      return "That e-mail and password don’t match.";
    case "taken":
      return "That e-mail already has an account. Log in instead.";
    case "email":
      return "That doesn’t look like an e-mail address.";
    case "password":
      return "A password needs at least eight characters.";
    case "code":
      return "That code isn’t right, or it has expired.";
    case "mail":
      return "Password mails aren’t set up yet. Try again later.";
    case "too many":
      return "Too many tries from this network today. Try again tomorrow.";
    default:
      return "Something went wrong on my side. Try again in a moment.";
  }
}

/**
 * The Apple button is only shown where the system offers it. A build signed
 * without the Sign in with Apple entitlement sets EXPO_PUBLIC_APPLE_SIGNIN=0,
 * because the system still offers the button there and then fails on the tap.
 */
export function AppleButton({ onDone, onError }: { onDone: () => void; onError: (text: string) => void }) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (process.env.EXPO_PUBLIC_APPLE_SIGNIN === "0") return;
    void AppleAuthentication.isAvailableAsync().then(setAvailable);
  }, []);
  if (!available) return null;
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={26}
      style={{ height: 52 }}
      onPress={() => {
        void (async () => {
          try {
            const credential = await AppleAuthentication.signInAsync({
              requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
              ],
            });
            if (!credential.identityToken) throw new Error("no token");
            const user = await session.apple({
              identityToken: credential.identityToken,
              name: credential.fullName?.givenName ?? useProfile.getState().name,
            });
            if (user.email) useProfile.getState().save({ email: user.email });
            onDone();
          } catch (error) {
            if ((error as { code?: string }).code !== "ERR_REQUEST_CANCELED") onError(message(error));
          }
        })();
      }}
    />
  );
}

export function AccountSheet({
  scene,
  initial,
  onClose,
  onDeleted,
  onLoggedIn,
}: {
  scene: Scene;
  initial: AccountMode;
  onClose: () => void;
  onDeleted: () => void;
  onLoggedIn: () => void;
}) {
  const user = useSessionUser();
  const profile = useProfile((s) => s);
  const [mode, setMode] = useState<AccountMode>(initial);
  const [email, setEmail] = useState(profile.email);
  const [password, setPassword] = useState("");
  const [current, setCurrent] = useState("");
  const [code, setCode] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const go = (next: AccountMode) => {
    setError("");
    setInfo("");
    setPassword("");
    setMode(next);
  };
  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  };
  const afterLogin = async () => {
    const me = await session.refresh();
    await restoreAccount(me?.profile ?? null).catch(() => {});
    onLoggedIn();
  };
  const titles: Record<AccountMode, string> = {
    manage: "Your account",
    create: "Keep your diary yours",
    login: "Welcome back",
    forgot: "Forgot your password?",
    reset: "Check your mail",
    delete: "Delete your account?",
    password: "Change your password",
  };
  return (
    <SheetShell
      scene={scene}
      title={titles[mode]}
      closeLabel="Close account"
      onClose={onClose}
      zIndex={46}
    >
      {mode === "manage" && (
        <View>
          <Note>{user?.email ?? "Signed in with Apple"}</Note>
          <Note>{user?.pro ? "Zest Pro is active." : "Free plan."}</Note>
          <Field label="E-mail" value={email} onChange={setEmail} keyboardType="email-address" />
          <Gap />
          <PrimaryButton
            label="Save e-mail"
            disabled={busy || !validEmail(email) || email.trim() === user?.email}
            onPress={() =>
              void run(async () => {
                const next = await session.update({ email: email.trim() });
                useProfile.getState().save({ email: next.email ?? "" });
                setInfo("Saved.");
              })
            }
          />
          {!!info && <Note>{info}</Note>}
          {!!error && <Note tone="danger">{error}</Note>}
          <Gap />
          <TextLink label="Change password" tone="ink" onPress={() => go("password")} />
          <TextLink
            label="Manage subscription"
            tone="ink"
            onPress={() => void Linking.openURL("https://apps.apple.com/account/subscriptions")}
          />
          <TextLink
            label="Restore purchases"
            tone="ink"
            onPress={() =>
              void run(async () => {
                setInfo((await restore()) ? "Zest Pro is back." : "No purchase to restore.");
              })
            }
          />
          <TextLink
            label="Sign out"
            onPress={() =>
              void run(async () => {
                await session.logout();
                onClose();
              })
            }
          />
          <TextLink label="Delete account" tone="danger" onPress={() => go("delete")} />
        </View>
      )}
      {mode === "create" && (
        <View>
          <Note>Sync your diary to a new phone and add friends. Your diary works without this too.</Note>
          <AppleButton
            onDone={() => void afterLogin()}
            onError={setError}
          />
          <Gap />
          <Field label="E-mail" value={email} onChange={setEmail} keyboardType="email-address" textContentType="emailAddress" />
          <Field label="Password" value={password} onChange={setPassword} secure placeholder="8+ characters" />
          {!!error && <Note tone="danger">{error}</Note>}
          <Gap />
          <PrimaryButton
            label="Create account"
            disabled={busy || !validEmail(email) || password.length < 8}
            onPress={() =>
              void run(async () => {
                const next = await session.signup({ email: email.trim(), password, name: profile.name });
                useProfile.getState().save({ email: next.email ?? "" });
                await pushProfile().catch(() => {});
                await syncDiary().catch(() => {});
                onLoggedIn();
              })
            }
          />
          <TextLink label="I already have an account" onPress={() => go("login")} />
        </View>
      )}
      {mode === "login" && (
        <View>
          <AppleButton onDone={() => void afterLogin()} onError={setError} />
          <Gap />
          <Field label="E-mail" value={email} onChange={setEmail} keyboardType="email-address" textContentType="emailAddress" />
          <Field label="Password" value={password} onChange={setPassword} secure />
          {!!error && <Note tone="danger">{error}</Note>}
          <Gap />
          <PrimaryButton
            label="Log in"
            disabled={busy || !validEmail(email) || !password}
            onPress={() =>
              void run(async () => {
                await session.login({ email: email.trim(), password });
                await afterLogin();
              })
            }
          />
          <TextLink label="Forgot password" onPress={() => go("forgot")} />
          <TextLink label="Create an account instead" onPress={() => go("create")} />
        </View>
      )}
      {mode === "forgot" && (
        <View>
          <Note>I’ll send a six-digit code to your e-mail.</Note>
          <Field label="E-mail" value={email} onChange={setEmail} keyboardType="email-address" />
          {!!error && <Note tone="danger">{error}</Note>}
          <Gap />
          <PrimaryButton
            label="Send code"
            disabled={busy || !validEmail(email)}
            onPress={() =>
              void run(async () => {
                await session.forgot(email.trim());
                go("reset");
              })
            }
          />
          <TextLink label="Back to log in" onPress={() => go("login")} />
        </View>
      )}
      {mode === "reset" && (
        <View>
          <Note>If {email.trim()} has an account, the code is on its way. It works for 15 minutes.</Note>
          <Field label="Code" value={code} onChange={setCode} keyboardType="number-pad" textContentType="oneTimeCode" />
          <Field label="New password" value={password} onChange={setPassword} secure placeholder="8+ characters" />
          {!!error && <Note tone="danger">{error}</Note>}
          <Gap />
          <PrimaryButton
            label="Set password"
            disabled={busy || code.length !== 6 || password.length < 8}
            onPress={() =>
              void run(async () => {
                await session.reset({ email: email.trim(), code, password });
                await afterLogin();
              })
            }
          />
        </View>
      )}
      {mode === "password" && (
        <View>
          {user?.hasPassword && (
            <Field label="Current" value={current} onChange={setCurrent} secure />
          )}
          <Field label="New" value={password} onChange={setPassword} secure placeholder="8+ characters" />
          {!!error && <Note tone="danger">{error}</Note>}
          <Gap />
          <PrimaryButton
            label="Change password"
            disabled={busy || password.length < 8}
            onPress={() =>
              void run(async () => {
                await session.update({ password, currentPassword: current });
                go("manage");
                setInfo("Password changed.");
              })
            }
          />
          <TextLink label="Back" onPress={() => go("manage")} />
        </View>
      )}
      {mode === "delete" && (
        <View>
          <Note>This removes your account, synced diary, friends and subscription record for good. A subscription keeps running until you cancel it in the App Store.</Note>
          <Field label="Type DELETE" value={typed} onChange={setTyped} capitalize />
          {!!error && <Note tone="danger">{error}</Note>}
          <Gap />
          <PrimaryButton
            label="Delete my account"
            disabled={busy || typed.trim().toUpperCase() !== "DELETE"}
            onPress={() =>
              void run(async () => {
                await session.remove();
                Alert.alert("Account deleted", "Everything on the server is gone. This phone starts fresh.");
                onDeleted();
              })
            }
          />
          <TextLink label="Keep my account" onPress={() => go("manage")} />
        </View>
      )}
    </SheetShell>
  );
}
