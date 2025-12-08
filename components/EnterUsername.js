import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import styles from "../styles";
import { ref, push, remove, update } from "firebase/database";
import { database } from "../firebaseConfig";
import { LinearGradient } from "expo-linear-gradient";
import ModalAlert from "./ModalAlert";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../contexts/LanguageContext";
import LanguageToggle from "./LanguageToggle";
import theme from "../utils/theme";
import getLogoSource from "../utils/logo";
import SettingsModal from "./SettingsModal";
import PlusModal from "./PlusModal";

const USERNAME_SUGGESTIONS = [
  "AuroraSoul",
  "PixelNomad",
  "NorthernGlow",
  "VelvetEcho",
  "StarryPulse",
  "CharmingFox",
  "LuminousLynx",
  "MysticWave",
  "FrostedMuse",
  "NeonDrift",
];

const getRandomSuggestion = () => {
  const index = Math.floor(Math.random() * USERNAME_SUGGESTIONS.length);
  return USERNAME_SUGGESTIONS[index];
};

export default function EnterUsername({ navigation }) {
  const { t, language } = useLanguage();
  const logoSource = getLogoSource(language);
  const [username, setUsername] = useState("");
  const [alertState, setAlertState] = useState({
    visible: false,
    title: "",
    message: "",
    variant: "info",
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showPlus, setShowPlus] = useState(false);
  const planName = "Plus";
  const planPrice = "2,99 EUR";
  const handleRestorePurchases = () => {
    console.log("Restore purchases tapped");
  };

  const usernameLength = username.trim().length;

  const handleInputChange = (text) => setUsername(text);

  const handleSuggestion = () => {
    setUsername(getRandomSuggestion());
  };

  const saveUsername = (user) => {
    const ttlMs = 2 * 60 * 60 * 1000;
    const usersRef = ref(database, "users/");
    const newUserRef = push(usersRef);
    const playerData = {
      playerId: newUserRef.key,
      username: user,
      timestamp: Date.now(),
      ishost: false,
      gamepin: null,
    };

    update(newUserRef, playerData)
      .then(() => console.log(`User ${user} saved with ID ${newUserRef.key}`))
      .catch((error) => console.error("Error saving username:", error));
    setTimeout(() => {
      remove(newUserRef)
        .then(() => console.log(`Username ${user} removed after 2 hours`))
        .catch((error) => console.error("Error removing username:", error));
    }, ttlMs);
  };

  const handleSubmit = () => {
    const trimmed = username.trim();

    if (trimmed.length < 3) {
      setAlertState({
        visible: true,
        title: t("Name Too Short"),
        message: t("Enter at least 3 characters for your username."),
        variant: "error",
      });
      return;
    }

    saveUsername(trimmed);
    navigation.navigate("GameOptionScreen", { username: trimmed });
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={theme.backgroundGradient}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />
      <SafeAreaView style={localStyles.safeArea} edges={["top", "bottom"]}>
        <View pointerEvents="none" style={localStyles.decorativeLayer}>
          <View style={localStyles.blobLarge} />
          <View style={localStyles.blobSmall} />
        </View>

        <KeyboardAvoidingView
          style={localStyles.safeArea}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            style={localStyles.scroll}
            contentContainerStyle={localStyles.scrollContent}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={false}
            keyboardDismissMode="on-drag"
          >
            <View style={localStyles.scrollInner}>
              <View style={localStyles.headerRow}>
                <TouchableOpacity
                  style={localStyles.settingsButton}
                  onPress={() => setShowSettings(true)}
                  activeOpacity={0.8}
                  accessibilityLabel={t("Settings")}
                >
                  <LinearGradient
                    colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0.14)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={localStyles.settingsButtonGradient}
                  >
                    <Ionicons name="settings-outline" size={20} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              <Image source={logoSource} style={localStyles.logo} />

              <View style={localStyles.hero}>
                <Text style={localStyles.heroTitle}>
                  {t("Welcome to Treffipeli!")}
                </Text>
              </View>

              <LinearGradient
                colors={theme.cardFrameGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={localStyles.cardGradient}
              >
                <View style={localStyles.card}>
                  <Text style={localStyles.cardTitle}>
                    {t("Your Username")}
                  </Text>
                  <Text style={localStyles.cardCopy}>
                    {t(
                      "This name is visible to other players during the game. You can change it later in settings.",
                    )}
                  </Text>

                  <View style={localStyles.inputWrapper}>
                    <Ionicons
                      name="person-circle-outline"
                      size={24}
                      color={theme.accentPrimary}
                      style={localStyles.inputIcon}
                    />
                    <TextInput
                      style={localStyles.input}
                      placeholder={t("e.g. VelvetEcho")}
                      value={username}
                      onChangeText={handleInputChange}
                      placeholderTextColor={theme.placeholder}
                      maxLength={16}
                      returnKeyType="go"
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="username"
                      onSubmitEditing={handleSubmit}
                    />
                  </View>

                  <View style={localStyles.metaRow}>
                    <Text style={localStyles.helperLabel}>
                      {t("Characters: {{count}}/16", {
                        count: usernameLength,
                      })}
                    </Text>
                    <Text style={localStyles.helperAccent}>
                      {t("Recommended: 3-16 characters")}
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleSuggestion}
                    style={localStyles.secondaryButton}
                  >
                    <Ionicons
                      name="sparkles-outline"
                      size={20}
                      color={theme.accentSecondary}
                    />
                    <Text style={localStyles.secondaryButtonText}>
                      {t("Generate Username")}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.92}
                    onPress={handleSubmit}
                    style={localStyles.primaryButton}
                  >
                    <LinearGradient
                      colors={theme.primaryButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={localStyles.primaryButtonGradient}
                    >
                      <Text style={localStyles.primaryButtonText}>
                        {t("Continue to Game")}
                      </Text>
                      <Ionicons
                        name="arrow-forward-circle"
                        size={26}
                        color="#ffffff"
                      />
                    </LinearGradient>
                  </TouchableOpacity>

                  <Text style={localStyles.helperText}>
                    {t("Tip: Short, punchy usernames are easier to remember.")}
                  </Text>
                </View>
              </LinearGradient>

              <View style={localStyles.footer}>
                <Text style={localStyles.footerLabel}>{t("Treffipeli")}</Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <SettingsModal
          visible={showSettings}
          onClose={() => setShowSettings(false)}
          onOpenPlus={() => {
            setShowSettings(false);
            setShowPlus(true);
          }}
        />
        <PlusModal
          visible={showPlus}
          onClose={() => setShowPlus(false)}
          planName={planName}
          planPrice={planPrice}
          onRestorePurchases={handleRestorePurchases}
        />
      </SafeAreaView>

      <ModalAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        variant={alertState.variant}
        onClose={() => setAlertState((s) => ({ ...s, visible: false }))}
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerRow: {
    width: "100%",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  settingsButton: {
    padding: 2,
    borderRadius: 18,
  },
  settingsButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  decorativeLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  blobLarge: {
    position: "absolute",
    top: -120,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 200,
    backgroundColor: theme.blobPrimary,
    transform: [{ rotate: "18deg" }],
  },
  blobSmall: {
    position: "absolute",
    bottom: 140,
    left: -80,
    width: 200,
    height: 200,
    borderRadius: 160,
    backgroundColor: theme.blobSecondary,
    transform: [{ rotate: "-14deg" }],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 28,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  scrollInner: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    alignItems: "center",
  },
  logo: {
    height: 120,
    width: 220,
    resizeMode: "contain",
    marginBottom: 16,
  },
  hero: {
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    color: theme.heroSubtitle,
  },
  cardGradient: {
    width: "100%",
    borderRadius: 28,
    padding: 1.5,
    marginTop: 24,
    shadowColor: "#13093A",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.34,
    shadowRadius: 28,
    elevation: 12,
  },
  card: {
    borderRadius: 26,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.45)",
  },
  cardBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.badgeBackground,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  cardBadgeText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: "600",
    color: theme.badgeText,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.bodyText,
    marginTop: 22,
  },
  cardCopy: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.bodyMuted,
    marginTop: 8,
  },
  inputWrapper: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.accentMutedBorder,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: theme.bodyText,
    paddingVertical: 14,
  },
  metaRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
  },
  helperLabel: {
    flexShrink: 1,
    marginRight: 12,
    fontSize: 14,
    fontWeight: "500",
    color: theme.metaLabel,
  },
  helperAccent: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "600",
    color: theme.accentSecondary,
    textAlign: "right",
  },
  secondaryButton: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.accentMuted,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: "600",
    color: theme.metaLabel,
  },
  primaryButton: {
    marginTop: 24,
  },
  primaryButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
  },
  helperText: {
    marginTop: 22,
    fontSize: 13,
    lineHeight: 20,
    color: theme.helperText,
    textAlign: "center",
  },
  footer: {
    marginTop: 40,
    alignItems: "center",
    paddingHorizontal: 12,
  },
  footerLabel: {
    fontSize: 13,
    letterSpacing: 2,
    color: "rgba(255, 255, 255, 0.75)",
  },
  footerText: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    color: "rgba(255, 255, 255, 0.82)",
  },
});
