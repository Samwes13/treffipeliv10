import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_KEY = "treffipeli:last-session";

export const saveSession = async (username, gamepin) => {
  if (!username || !gamepin) {
    return;
  }
  const payload = { username, gamepin, savedAt: Date.now() };
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to save session", error?.message || error);
  }
};

export const loadSession = async () => {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Failed to load session", error?.message || error);
    return null;
  }
};

export const clearSession = async () => {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.warn("Failed to clear session", error?.message || error);
  }
};
