import * as SecureStore from "expo-secure-store";

/**
 * The password never enters the profile store or its JSON on disk. It sits in
 * the device keychain until an account service exists to hand it to.
 */
const KEY = "zest-password";
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function savePassword(password: string) {
  await SecureStore.setItemAsync(KEY, password, options);
}

export async function hasPassword() {
  return (await SecureStore.getItemAsync(KEY, options)) !== null;
}

export async function clearPassword() {
  await SecureStore.deleteItemAsync(KEY, options);
}
