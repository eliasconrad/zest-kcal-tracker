import { useStore } from "zustand";
import { File, Paths } from "expo-file-system";
import { createProfileStore, type ProfileState } from "./profileStore";

const file = () => new File(Paths.document, "zest-profile.json");
const profile = createProfileStore({
  getItem: () => {
    try {
      return file().textSync();
    } catch {
      return null;
    }
  },
  setItem: (_key, value) => file().write(value),
  removeItem: () => {
    if (file().exists) file().delete();
  },
});

/** Selective subscriptions plus the store API, like useDiary. */
export const useProfile = Object.assign(
  <T>(selector: (state: ProfileState) => T) => useStore(profile, selector),
  profile,
);
