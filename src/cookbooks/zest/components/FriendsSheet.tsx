import { useCallback, useEffect, useState } from "react";
import { Alert, Share, Switch, Text, View } from "react-native";
import { SheetShell } from "./ui/SheetShell";
import { Field, Gap, Note, PrimaryButton, TextLink } from "./ui/Form";
import { Touch } from "./ui/Touch";
import { StreakFlame } from "./Streak";
import { AccountError } from "../data/session";
import { dayKey } from "../data/diary";
import { session } from "../state/useSession";
import { theme } from "../theme";
import type { Scene } from "../hooks/useScene";

type Friend = {
  id: string;
  name: string;
  streak: number;
  loggedToday: boolean;
  weekDays: number;
  sharingMine: boolean;
  total: number | null;
};

/**
 * Friends, invited by link only. They see each other's streak and whether today
 * has a meal. Calories stay private unless shared per friend; nothing is ranked
 * by weight or by how little someone ate.
 */
export function FriendsSheet({
  scene,
  pendingCode,
  onClose,
  onCreateAccount,
}: {
  scene: Scene;
  /** From an invite link. */
  pendingCode?: string;
  onClose: () => void;
  onCreateAccount: () => void;
}) {
  const signedIn = session.hasAccount();
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [invite, setInvite] = useState("");
  const [code, setCode] = useState(pendingCode ?? "");
  const [note, setNote] = useState("");
  const load = useCallback(
    () =>
      session
        .get<{ friends: Friend[]; inviteCode: string }>(`/v1/friends?day=${dayKey()}`)
        .then((result) => {
          setFriends(result.friends);
          setInvite(result.inviteCode);
        })
        .catch(() => {
          setNote("I can’t reach the kitchen right now.");
          setFriends((old) => old ?? []);
        }),
    [],
  );
  useEffect(() => {
    if (signedIn) void load();
  }, [signedIn, load]);
  const accept = (value: string) =>
    session
      .post<{ name: string }>("/v1/friends/accept", { code: value.trim() })
      .then((friend) => {
        setCode("");
        setNote(`${friend.name} is in.`);
        return load();
      })
      .catch((error) => {
        setNote(
          error instanceof AccountError && error.code === "self"
            ? "That’s your own link."
            : "That code doesn’t lead to anyone.",
        );
      });
  useEffect(() => {
    if (signedIn && pendingCode) void accept(pendingCode);
    // Runs once for the link that opened this sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, pendingCode]);
  const manage = (friend: Friend) =>
    Alert.alert(friend.name, undefined, [
      { text: "Keep", style: "cancel" },
      {
        text: "Remove",
        onPress: () => void session.del(`/v1/friends/${encodeURIComponent(friend.id)}`).then(load),
      },
      {
        text: "Block",
        style: "destructive",
        onPress: () => void session.post(`/v1/friends/${encodeURIComponent(friend.id)}/block`).then(load),
      },
    ]);
  const leaders = [...(friends ?? [])].sort((a, b) => b.weekDays - a.weekDays);
  return (
    <SheetShell scene={scene} title="Friends" closeLabel="Close friends" onClose={onClose} zIndex={46}>
      {!signedIn ? (
        <View>
          <Note>Friends need an account, so they know it’s you. It’s free, and your diary stays private.</Note>
          <Gap />
          <PrimaryButton label="Create account" onPress={onCreateAccount} />
        </View>
      ) : (
        <View>
          <Note>They see your streak and that you logged today. Your calories only if you switch it on.</Note>
          <PrimaryButton
            label="Invite a friend"
            disabled={!invite}
            onPress={() =>
              void Share.share({
                message: `Keep me company on Zest. Here’s my invite: zest://friend/${invite}`,
              })
            }
          />
          <Gap />
          <Field label="Have a code?" value={code} onChange={setCode} placeholder="Paste it here" />
          {!!code.trim() && <TextLink label="Add friend" tone="ink" onPress={() => void accept(code)} />}
          {!!note && <Note>{note}</Note>}
          <Gap size={16} />
          {friends === null && <Note>One moment…</Note>}
          {friends?.length === 0 && <Note>Nobody here yet. A streak is easier with company.</Note>}
          {!!leaders.length && (
            <Text style={{ fontSize: 13, fontWeight: "600", letterSpacing: 0.2, color: theme.muted, marginBottom: 8 }}>
              THIS WEEK
            </Text>
          )}
          {leaders.map((friend) => (
            <View
              key={friend.id}
              style={{
                borderRadius: 20,
                borderCurve: "continuous",
                backgroundColor: "#FFFFFF",
                padding: 14,
                marginBottom: 8,
              }}
            >
              <Touch label={`${friend.name}, ${friend.streak} day streak. Options`} onPress={() => manage(friend)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <StreakFlame size={28} lit={friend.loggedToday ? 1 : 0} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 17, fontWeight: "500", color: theme.ink }}>{friend.name}</Text>
                    <Text style={{ fontSize: 13, color: theme.muted }}>
                      {friend.streak} day streak · {friend.weekDays} of 7 days
                      {friend.total !== null ? ` · ${friend.total.toLocaleString()} kcal today` : ""}
                    </Text>
                  </View>
                </View>
              </Touch>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                <Text style={{ fontSize: 14, color: theme.muted }}>Share my daily total</Text>
                <Switch
                  accessibilityLabel={`Share my daily total with ${friend.name}`}
                  value={friend.sharingMine}
                  trackColor={{ true: theme.soft }}
                  onValueChange={(shareTotal) => {
                    setFriends((old) => old?.map((item) => (item.id === friend.id ? { ...item, sharingMine: shareTotal } : item)) ?? old);
                    void session.put(`/v1/friends/${encodeURIComponent(friend.id)}`, { shareTotal }).catch(load);
                  }}
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </SheetShell>
  );
}
