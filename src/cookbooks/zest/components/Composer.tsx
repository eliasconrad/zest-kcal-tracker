import { useEffect, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { z } from "zod";
import { useAnimatedStyle, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { getLocales } from "expo-localization";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { GlassSurface } from "./ui/GlassSurface";
import { Symbol, Touch } from "./ui/Touch";
import { theme } from "../theme";
import type { Scene } from "../hooks/useScene";

const message = z.string().trim().min(1).max(2000);
export function ZestComposer({
  scene,
  helperName,
  hint,
  focusKey = 0,
  busy,
  onSend,
  onStop,
  onPhoto,
  onCalendar,
  onHeight,
}: {
  scene: Scene;
  helperName: string;
  /** Replaces the placeholder while the app is waiting for something specific. */
  hint?: string;
  /** Changing it brings the keyboard up, for a correction asked for on a receipt. */
  focusKey?: number;
  busy: boolean;
  onSend: (text: string) => Promise<boolean>;
  onStop: () => void;
  onPhoto: () => void;
  onCalendar: () => void;
  onHeight: (height: number) => void;
}) {
  const input = useRef<TextInput>(null);
  const value = useRef("");
  const sending = useRef(false);
  const [textHeight, setTextHeight] = useState(42);
  const [text, setText] = useState("");
  const hasText = !!text.trim();
  const { composerWidth, composerHeight, reduced } = scene;
  useEffect(() => {
    const targetHeight = Math.max(108, textHeight + 62);
    composerWidth.set(scene.width - 32);
    composerHeight.set(
      withTiming(targetHeight, { duration: reduced ? 0 : 160 }),
    );
    onHeight(targetHeight);
  }, [
    composerHeight,
    composerWidth,
    scene.width,
    reduced,
    textHeight,
    onHeight,
  ]);
  const surface = useAnimatedStyle(() => ({
    width: composerWidth.get(),
    height: composerHeight.get(),
    borderRadius: 28,
  }));
  useEffect(() => {
    if (focusKey > 0) input.current?.focus();
  }, [focusKey]);
  const submit = async () => {
    if (sending.current) return;
    const parsed = message.safeParse(value.current);
    if (!parsed.success) return;
    sending.current = true;
    try {
      if (await onSend(parsed.data)) {
        value.current = "";
        input.current?.clear();
        setText("");
      }
    } finally {
      sending.current = false;
    }
  };
  // Dictation writes into the same field as the keyboard. Stopping it by hand
  // sends what was said; when the recogniser stops by itself the text stays to edit.
  const [listening, setListening] = useState(false);
  const sendWhenDone = useRef(false);
  const before = useRef("");
  useSpeechRecognitionEvent("start", () => setListening(true));
  useSpeechRecognitionEvent("result", (event) => {
    const said = event.results[0]?.transcript ?? "";
    const next = before.current ? `${before.current} ${said}` : said;
    value.current = next;
    setText(next);
    scene.typing.set(1);
  });
  useSpeechRecognitionEvent("end", () => {
    setListening(false);
    if (sendWhenDone.current) {
      sendWhenDone.current = false;
      void submit();
    }
  });
  useSpeechRecognitionEvent("error", () => {
    sendWhenDone.current = false;
    setListening(false);
  });
  const listen = async () => {
    if (listening) {
      sendWhenDone.current = !!value.current.trim();
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) return;
    before.current = value.current.trim();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    ExpoSpeechRecognitionModule.start({
      lang: getLocales()[0]?.languageTag ?? "en-US",
      interimResults: true,
      continuous: true,
      addsPunctuation: true,
    });
  };
  // Keep the field and actions in the same native layout throughout keyboard
  // travel. Focus must not trigger a React commit or rearrange these controls.
  return (
    <GlassSurface
      interactive
      style={[
        {
          paddingHorizontal: 4,
          paddingTop: 12,
          paddingBottom: 4,
          justifyContent: "center",
        },
        surface,
      ]}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", minHeight: 44 }}
      >
        <TextInput
          ref={input}
          value={text}
          accessibilityLabel="Message Zest"
          placeholder={listening ? "Listening…" : (hint ?? `Ask ${helperName}`)}
          placeholderTextColor={theme.faint}
          keyboardAppearance="light"
          autoCapitalize="sentences"
          maxLength={2000}
          multiline
          scrollEnabled={textHeight >= 112}
          returnKeyType="send"
          submitBehavior="submit"
          onSubmitEditing={submit}
          onLayout={(event) =>
            setTextHeight(
              Math.max(42, Math.min(112, event.nativeEvent.layout.height)),
            )
          }
          onChangeText={(text) => {
            if (sending.current) return;
            value.current = text;
            setText(text);
            scene.typing.set(1);
          }}
          selectionColor={theme.accent}
          style={{
            flex: 1,
            fontSize: 17,
            lineHeight: 23,
            color: theme.ink,
            paddingHorizontal: 12,
            paddingVertical: 8,
            minHeight: 42,
            maxHeight: 112,
          }}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Touch
            label="Add meal photo"
            onPress={onPhoto}
            expand
            style={{
              width: 46,
              height: 46,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Symbol name="camera" size={21} color={theme.ink} />
          </Touch>
          <Touch
            label="Open food diary"
            onPress={onCalendar}
            style={{
              minHeight: 44,
              paddingHorizontal: 7,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Symbol name="calendar" size={15} color={theme.muted} />
            <Text style={{ color: theme.muted, fontSize: 14 }}>Today</Text>
          </Touch>
        </View>
        <Touch
          label={
            busy
              ? "Stop response"
              : listening
                ? "Stop and send"
                : hasText
                  ? "Send message"
                  : "Dictate"
          }
          onPress={
            busy
              ? onStop
              : listening || !hasText
                ? () => void listen()
                : () => void submit()
          }
          expand
          style={{
            width: 46,
            height: 46,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: listening ? theme.accent : theme.heavy,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Symbol
              name={busy || listening ? "stop.fill" : hasText ? "arrow.up" : "mic.fill"}
              size={busy || listening ? 11 : hasText ? 18 : 16}
              color="white"
            />
          </View>
        </Touch>
      </View>
    </GlassSurface>
  );
}
