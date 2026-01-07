import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { useLanguage, LANGUAGE_OPTIONS } from "../contexts/LanguageContext";
import theme from "../utils/theme";

export default function LanguageToggle({ style }) {
  const { language, setLanguage } = useLanguage();

  return (
    <View style={[styles.container, style]}>
      {LANGUAGE_OPTIONS.map((option, index) => {
        const isActive = language === option.code;
        return (
          <TouchableOpacity
            key={option.code}
            style={[
              styles.button,
              index === 0 ? styles.firstButton : null,
              index === LANGUAGE_OPTIONS.length - 1 ? styles.lastButton : null,
              isActive ? styles.buttonActive : null,
            ]}
            onPress={() => setLanguage(option.code)}
            activeOpacity={0.85}
          >
            <Text
              style={[styles.label, isActive ? styles.labelActive : null]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: 18,
    backgroundColor: theme.modalAccentBackground,
    borderWidth: 1,
    borderColor: "rgba(255, 102, 196, 0.25)",
    overflow: "hidden",
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  firstButton: {
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  lastButton: {
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
  },
  buttonActive: {
    backgroundColor: "#ffffff",
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.bodyText,
  },
  labelActive: {
    color: "#5B2CCF",
  },
});
