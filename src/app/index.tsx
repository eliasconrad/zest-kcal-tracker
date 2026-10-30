import { useLocalSearchParams } from "expo-router";
import { ZestScreen } from "../cookbooks/zest/screens/ZestScreen";

/** The root is the product, with no collection route or back control. */
export default function Index() {
  const { demo, friend } = useLocalSearchParams<{
    demo?: string;
    friend?: string;
  }>();
  return (
    <ZestScreen
      key={demo ?? "diary"}
      demo={demo === "1"}
      inviteCode={friend}
    />
  );
}
