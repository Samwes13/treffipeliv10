import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLanguage } from "../contexts/LanguageContext";
import LanguageToggle from "./LanguageToggle";
import theme from "../utils/theme";

export default function SettingsModal({
  visible,
  onClose,
  onOpenPlus,
  showLeave = false,
  onLeave,
}) {
  const { t } = useLanguage();

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
            <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
              <Ionicons name="close" size={22} color={theme.helperText} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>{t("Language")}</Text>
              <LanguageToggle />
            </View>

            {showLeave && (
              <TouchableOpacity
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
                <Text style={styles.leaveText}>{t("Leave game")}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.settingsPrimary}
              onPress={onOpenPlus}
            >
              <LinearGradient
                colors={theme.primaryButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.settingsPrimaryInner}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={18}
                  color="#ffffff"
                  style={styles.settingsPrimaryIcon}
                />
                <Text style={styles.settingsPrimaryText}>{t("Open Plus")}</Text>
              </LinearGradient>
            </TouchableOpacity>
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
