import { useRef } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Touch } from "./Touch";
import { theme } from "../../theme";

/** The dark pill every sheet ends on. */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Touch
      label={label}
      onPress={onPress}
      disabled={disabled}
      style={{
        height: 52,
        borderRadius: 26,
        backgroundColor: theme.heavy,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "600", color: theme.onHeavy }}>
        {label}
      </Text>
    </Touch>
  );
}

export function TextLink({
  label,
  onPress,
  tone = "muted",
}: {
  label: string;
  onPress: () => void;
  tone?: "muted" | "danger" | "ink";
}) {
  return (
    <Touch
      label={label}
      onPress={onPress}
      style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}
    >
      <Text
        style={{
          fontSize: 15,
          color:
            tone === "danger"
              ? "#A63A26"
              : tone === "ink"
                ? theme.ink
                : theme.muted,
        }}
      >
        {label}
      </Text>
    </Touch>
  );
}

export function Field({
  label,
  value,
  onChange,
  secure = false,
  placeholder,
  keyboardType,
  capitalize = false,
  textContentType = "none",
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  secure?: boolean;
  placeholder?: string;
  keyboardType?: React.ComponentProps<typeof TextInput>["keyboardType"];
  capitalize?: boolean;
  textContentType?: React.ComponentProps<typeof TextInput>["textContentType"];
}) {
  const input = useRef<TextInput>(null);
  return (
    <Pressable
      accessible={false}
      onPress={() => input.current?.focus()}
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 0.5,
        borderColor: theme.line,
        minHeight: 54,
      }}
    >
      <Text
        accessible={false}
        style={{ width: 96, fontSize: 15, color: theme.muted }}
      >
        {label}
      </Text>
      <TextInput
        ref={input}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.faint}
        secureTextEntry={secure}
        autoCapitalize={capitalize ? "words" : "none"}
        autoCorrect={false}
        spellCheck={false}
        keyboardType={keyboardType}
        textContentType={textContentType}
        style={{
          flex: 1,
          fontSize: 18,
          fontWeight: "500",
          color: theme.ink,
          paddingVertical: 8,
        }}
      />
    </Pressable>
  );
}

export function Note({ children, tone = "muted" }: React.PropsWithChildren<{ tone?: "muted" | "danger" }>) {
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={{
        fontSize: 14,
        lineHeight: 20,
        color: tone === "danger" ? "#A63A26" : theme.muted,
        marginVertical: 8,
      }}
    >
      {children}
    </Text>
  );
}

export const Gap = ({ size = 12 }: { size?: number }) => <View style={{ height: size }} />;
