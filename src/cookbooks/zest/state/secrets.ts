import * as SecureStore from "expo-secure-store";

/**
 * The password never enters the profile store or its JSON on disk. It waits in
 * the device keychain only until the account exists on the server (onboarding
 * may happen offline), then it is deleted.
 */
const KEY = "zest-password";
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function savePassword(password: string) {
  await SecureStore.setItemAsync(KEY, password, options);
}

/** Only ever read to finish creating the account; deleted right after. */
export function readPassword() {
  return SecureStore.getItemAsync(KEY, options);
}

export async function hasPassword() {
  return (await SecureStore.getItemAsync(KEY, options)) !== null;
}

export async function clearPassword() {
  await SecureStore.deleteItemAsync(KEY, options);
}
