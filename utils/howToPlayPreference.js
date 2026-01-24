import AsyncStorage from "@react-native-async-storage/async-storage";

const HOW_TO_PLAY_HIDE_KEY = "treffipeli:how-to-play-hidden";

export const loadHowToPlayHidden = async () => {
  try {
    const stored = await AsyncStorage.getItem(HOW_TO_PLAY_HIDE_KEY);
    return stored === "true";
  } catch (error) {
    console.warn(
      "Failed to load how-to-play preference",
      error?.message || error,
    );
    return false;
  }
};

export const saveHowToPlayHidden = async (hidden) => {
  try {
    if (hidden) {
      await AsyncStorage.setItem(HOW_TO_PLAY_HIDE_KEY, "true");
    } else {
      await AsyncStorage.removeItem(HOW_TO_PLAY_HIDE_KEY);
    }
  } catch (error) {
    console.warn(
      "Failed to update how-to-play preference",
      error?.message || error,
    );
  }
};
