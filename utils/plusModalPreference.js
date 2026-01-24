import AsyncStorage from "@react-native-async-storage/async-storage";

const PLUS_MODAL_HIDE_KEY = "treffipeli:plus-modal-hidden";

export const loadPlusModalHidden = async () => {
  try {
    const stored = await AsyncStorage.getItem(PLUS_MODAL_HIDE_KEY);
    return stored === "true";
  } catch (error) {
    console.warn("Failed to load plus modal preference", error?.message || error);
    return false;
  }
};

export const savePlusModalHidden = async (hidden) => {
  try {
    if (hidden) {
      await AsyncStorage.setItem(PLUS_MODAL_HIDE_KEY, "true");
    } else {
      await AsyncStorage.removeItem(PLUS_MODAL_HIDE_KEY);
    }
  } catch (error) {
    console.warn("Failed to update plus modal preference", error?.message || error);
  }
};
