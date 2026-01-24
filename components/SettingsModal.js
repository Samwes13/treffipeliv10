import React from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLanguage } from "../contexts/LanguageContext";
import LanguageToggle from "./LanguageToggle";
import theme from "../utils/theme";
import MotionPressable from "./MotionPressable";

export default function SettingsModal({
  visible,
  onClose,
  onOpenPlus,
  onOpenGameRules,
  showLeave = false,
  onLeave,
  isPlus = false,
}) {
  const { t } = useLanguage();
  const isPlusMember = Boolean(isPlus);
  const plusLabel = isPlusMember ? t("Plus member") : t("Open Plus");
  const plusIcon = isPlusMember ? "checkmark-circle" : "sparkles-outline";

  const handleOpenGameRules = () => {
    if (typeof onOpenGameRules === "function") {
      onClose && onClose();
      onOpenGameRules();
      return;
    }
    onClose && onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalPanel}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t("Settings")}</Text>
            <MotionPressable style={styles.modalCloseButton} onPress={onClose}>
              <Ionicons name="close" size={22} color={theme.helperText} />
            </MotionPressable>
          </View>
          <View style={styles.modalBody}>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>{t("Language")}</Text>
              <LanguageToggle />
            </View>

            <MotionPressable
              activeOpacity={0.9}
              style={styles.howToPlayButton}
              onPress={handleOpenGameRules}
            >
              <Ionicons
                name="help-circle-outline"
                size={18}
                color={theme.metaLabel}
                style={styles.howToPlayIcon}
              />
              <Text style={styles.howToPlayText}>{t("How to play")}</Text>
            </MotionPressable>

            {showLeave && (
              <MotionPressable
                activeOpacity={0.85}
                style={styles.leaveButton}
                onPress={onLeave}
              >
                <Ionicons
                  name="exit-outline"
                  size={18}
                  color="#ffffff"
                  style={styles.leaveIcon}
                />
                <Text style={styles.leaveText}>{t("Leave Game")}</Text>
              </MotionPressable>
            )}

            <MotionPressable
              activeOpacity={0.9}
              style={[
                styles.settingsPrimary,
                isPlusMember && styles.settingsPrimaryDisabled,
              ]}
              onPress={isPlusMember ? undefined : onOpenPlus}
              disabled={isPlusMember}
            >
              <LinearGradient
                colors={theme.primaryButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.settingsPrimaryInner}
              >
                <Ionicons
                  name={plusIcon}
                  size={18}
                  color="#ffffff"
                  style={styles.settingsPrimaryIcon}
                />
                <Text style={styles.settingsPrimaryText}>{plusLabel}</Text>
              </LinearGradient>
            </MotionPressable>
          </View>
        </View>

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: theme.modalBackdrop,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalPanel: {
    width: "100%",
    maxWidth: 620,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    shadowColor: "#11022C",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.32,
    shadowRadius: 30,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.bodyText,
  },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.accentMuted,
  },
  modalBody: {
    paddingBottom: 8,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  settingsLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.bodyText,
  },
  settingsPrimary: {
    borderRadius: 14,
    overflow: "hidden",
  },
  settingsPrimaryDisabled: {
    opacity: 0.65,
  },
  settingsPrimaryInner: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  settingsPrimaryIcon: {
    marginRight: 10,
  },
  settingsPrimaryText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  howToPlayButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: theme.accentMuted,
    borderWidth: 1,
    borderColor: theme.accentMutedBorder,
    marginBottom: 12,
  },
  howToPlayIcon: {
    marginRight: 8,
  },
  howToPlayText: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.metaLabel,
  },
  leaveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.accentPrimary,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  leaveIcon: {
    marginRight: 8,
  },
  leaveText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
