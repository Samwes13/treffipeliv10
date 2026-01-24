import AsyncStorage from "@react-native-async-storage/async-storage";

const LANGUAGE_KEY = "treffipeli:language";

export const loadLanguagePreference = async () => {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (stored === "fi" || stored === "en") {
      return stored;
    }
    return null;
  } catch (error) {
    console.warn(
      "Failed to load language preference",
      error?.message || error,
    );
    return null;
  }
};

export const saveLanguagePreference = async (language) => {
  try {
    if (language === "fi" || language === "en") {
      await AsyncStorage.setItem(LANGUAGE_KEY, language);
      return;
    }
    await AsyncStorage.removeItem(LANGUAGE_KEY);
  } catch (error) {
    console.warn(
      "Failed to update language preference",
      error?.message || error,
    );
  }
};
