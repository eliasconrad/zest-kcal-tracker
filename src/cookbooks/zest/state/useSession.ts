import { useSyncExternalStore } from "react";
import * as SecureStore from "expo-secure-store";
import { createSessionClient } from "../data/session";

const KEY = "zest-session";
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const session = createSessionClient({
  base: (process.env.EXPO_PUBLIC_ZEST_API_URL ?? "").replace(/\/$/, ""),
  appToken: process.env.EXPO_PUBLIC_ZEST_APP_TOKEN,
  secure: {
    get: () => SecureStore.getItemAsync(KEY, options),
    set: (token) => SecureStore.setItemAsync(KEY, token, options),
    remove: () => SecureStore.deleteItemAsync(KEY, options),
  },
  send: (url, init) => fetch(url, init),
});

/** The signed-in user, re-rendering when it changes. */
export function useSessionUser() {
  return useSyncExternalStore(session.subscribe, session.user);
}
