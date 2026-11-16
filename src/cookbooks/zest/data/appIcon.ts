import {
  getAppIconName,
  setAlternateAppIcon,
  supportsAlternateIcons,
} from "expo-alternate-app-icons";
import type { HelperId } from "./helpers";

/**
 * The home screen icon follows the chosen mascot; the lemon is the primary icon.
 * iOS confirms each change with its own alert, which an app cannot hide, so this
 * runs once a choice is final and not on every tap in the picker.
 */
export async function syncAppIcon(helper: HelperId) {
  if (!supportsAlternateIcons) return;
  const wanted =
    helper === "zest" ? null : helper[0].toUpperCase() + helper.slice(1);
  if (getAppIconName() === wanted) return;
  await setAlternateAppIcon(wanted as never).catch(() => {});
}
