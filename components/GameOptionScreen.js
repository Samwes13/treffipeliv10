import React, { useState, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  Modal,
  Image,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ref, update } from "firebase/database";
import { database } from "../firebaseConfig";
import styles from "../styles";
import GameRules from "./GameRules";
import { LinearGradient } from "expo-linear-gradient";
import { useLanguage } from "../contexts/LanguageContext";
import LanguageToggle from "./LanguageToggle";
import { toUserKey } from "../utils/userKey";
import theme from "../utils/theme";
import getLogoSource from "../utils/logo";
import SettingsModal from "./SettingsModal";
import PlusModal from "./PlusModal";
import { saveSession } from "../utils/session";
import { usePlus } from "../contexts/PlusContext";

export default function GameOptionsScreen({ route, navigation }) {
  const rawUsername = route.params?.username ?? "";
  const trimmedUsername = rawUsername.trim();
  const playerName = trimmedUsername || rawUsername;
  const { t, language } = useLanguage();
  const logoSource = getLogoSource(language);
  const fallbackDisplayName = t("player");
  const displayName = capitaliseFirstLetter(
    trimmedUsername || fallbackDisplayName,
  );

  const [showRules, setShowRules] = useState(false);
  const [showSubscription, setShowSubscription] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const planName = "Plus";
  const planPrice = "2,99 EUR";
  const { isPlus, restorePurchases } = usePlus();
  const handleRestorePurchases = async () => {
    try {
      await restorePurchases();
    } catch (error) {
      console.warn("Restore purchases failed", error?.message || error);
    }
  };
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const bottomBase = Math.max(12, Math.min(48, Math.round(height * 0.04)));
  const bottomOffset = bottomBase + (insets?.bottom || 0);
  const contentBottomPadding = bottomOffset + 60;

  const handleMissingName = () => {
    navigation.navigate("EnterUsername");
  };

  const createGame = () => {
    if (!playerName) {
      handleMissingName();
      return;
    }

    const gamepin = Math.random().toString(36).substring(2, 8).toUpperCase();
    const usernameKey = toUserKey(playerName);
    update(ref(database, `games/${gamepin}`), {
      host: playerName,
      gamepin: gamepin,
      isGameStarted: false,
      players: {
        [usernameKey]: {
          username: playerName,
          usernameKey,
          traits: [],
          isHost: true,
          isPlus: !!isPlus,
        },
      },
    });

    saveSession(playerName, gamepin);

    navigation.navigate("CardTraits", { username: playerName, gamepin });
  };

  const joinGame = () => {
    if (!playerName) {
      handleMissingName();
      return;
    }

    navigation.navigate("JoinGame", { username: playerName });
  };

  useEffect(() => {
    setShowSubscription(!isPlus);
  }, [isPlus]);

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

        <Modal
          visible={showRules}
          transparent
          animationType="fade"
          onRequestClose={() => setShowRules(false)}
        >
          <View style={localStyles.modalBackdrop}>
            <View style={localStyles.modalPanel}>
              <View style={localStyles.modalHeader}>
                <Text style={localStyles.modalTitle}>{t("Game Rules")}</Text>
                <TouchableOpacity
                  style={localStyles.modalCloseButton}
                  onPress={() => setShowRules(false)}
                >
                  <Ionicons
                    name="close"
                    size={22}
                    color={theme.helperText}
                  />
                </TouchableOpacity>
              </View>
              <View style={localStyles.modalBody}>
                <GameRules />
              </View>
            </View>
          </View>
        </Modal>

        <SettingsModal
          visible={showSettings}
          onClose={() => setShowSettings(false)}
          onOpenPlus={() => {
            if (isPlus) {
              return;
            }
            setShowSettings(false);
            setShowSubscription(true);
          }}
          isPlus={isPlus}
        />

        {!isPlus && (
          <PlusModal
            visible={showSubscription}
            onClose={() => setShowSubscription(false)}
            planName={planName}
            planPrice={planPrice}
            onRestorePurchases={handleRestorePurchases}
          />
        )}

        <ScrollView
          style={localStyles.scroll}
          contentContainerStyle={[
            localStyles.scrollContent,
            { paddingBottom: contentBottomPadding },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={localStyles.content}>
            <View style={localStyles.topBar}>
              <View style={localStyles.topBarLeft}>
                {isPlus && (
                  <View style={localStyles.plusBadge}>
                    <Ionicons name="sparkles" size={16} color="#FFE5FF" />
                    <Text style={localStyles.plusBadgeText}>
                      {t("Plus")}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={localStyles.settingsButton}
                onPress={() => setShowSettings(true)}
                activeOpacity={0.8}
                accessibilityLabel={t("Settings")}
              >
                <Ionicons name="settings-outline" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
              <Image source={logoSource} style={localStyles.logo} />

            <View style={localStyles.hero}>
              <View style={localStyles.heroBadge}>
                <Ionicons name="heart" size={16} color="#FFE5FF" />
                <Text style={localStyles.heroBadgeText}>
                  {t("The best games happen together")}
                </Text>
              </View>
              <Text style={localStyles.heroTitle}>
                {t("Hey {{name}}!", { name: displayName })}
              </Text>
            </View>

            <LinearGradient
              colors={theme.cardFrameGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={localStyles.cardGradient}
            >
              <View style={localStyles.card}>
                <View style={localStyles.cardHeader}>
                  <Text style={localStyles.cardTitle}>
                    {t("Game Options")}
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.92}
                  style={localStyles.primaryAction}
                  onPress={createGame}
                >
                  <LinearGradient
                    colors={theme.primaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={localStyles.primaryActionGradient}
                  >
                    <View style={localStyles.primaryActionContent}>
                      <View style={localStyles.actionTextBlock}>
                        <Text style={localStyles.actionTitle}>
                          {t("Create a New Game")}
                        </Text>
                        <Text style={localStyles.actionSubtitle}>
                          {t(
                            "Receive a unique code and jump straight into card selection.",
                          )}
                        </Text>
                      </View>
                      <View style={localStyles.actionIcon}>
                        <Ionicons
                          name="sparkles-outline"
                          size={26}
                          color="#ffffff"
                        />
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.88}
                  style={localStyles.secondaryAction}
                  onPress={joinGame}
                >
                  <View style={localStyles.secondaryActionRow}>
                    <View style={localStyles.actionTextBlock}>
                      <Text style={localStyles.secondaryActionTitle}>
                        {t("Join an Existing Game")}
                      </Text>
                      <Text style={localStyles.secondaryActionSubtitle}>
                        {t(
                          "Enter the code your friend shares on the next screen.",
                        )}
                      </Text>
                    </View>
                    <View style={localStyles.secondaryIcon}>
                      <Ionicons
                        name="people-outline"
                        size={24}
                        color={theme.accentSecondary}
                      />
                    </View>
                  </View>
                </TouchableOpacity>

                <View style={localStyles.cardFooter}>
                  <TouchableOpacity
                    activeOpacity={0.88}
                    style={[
                      localStyles.utilityButton,
                      localStyles.utilityButtonSpacer,
                    ]}
                    onPress={() => setShowRules(true)}
                    accessible
                    accessibilityLabel={t("View game rules")}
                  >
                    <LinearGradient
                      colors={theme.primaryButtonGradient}
                      start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={localStyles.utilityButtonInner}
                  >
                      <Ionicons name="help-circle-outline" size={30} color="#ffffff" />
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.88}
                    style={localStyles.utilityButton}
                    onPress={handleMissingName}
                    accessible
                    accessibilityLabel={t("Change username")}
                  >
                    <LinearGradient
                      colors={theme.secondaryButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={localStyles.utilityButtonInner}
                    >
                      <Ionicons name="create" size={26} color="#ffffff" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

              </View>
            </LinearGradient>

            <View style={localStyles.footer}>
              <Text style={localStyles.footerTitle}>{t("Tip")}</Text>
              <Text style={localStyles.footerText}>
                {t(
                  "Encourage everyone to read their card aloud - it keeps the round relaxed and fun.",
                )}
              </Text>
            </View>
          </View>
        </ScrollView>

      </SafeAreaView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  decorativeLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  blobLarge: {
    position: "absolute",
    top: -160,
    left: -100,
    width: 260,
    height: 260,
    borderRadius: 260,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    transform: [{ rotate: "-18deg" }],
  },
  blobSmall: {
    position: "absolute",
    bottom: 140,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    transform: [{ rotate: "12deg" }],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    alignItems: "center",
  },
  content: {
    width: "100%",
    maxWidth: 520,
    alignItems: "center",
  },
  topBar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  topBarLeft: {
    minWidth: 90,
  },
  settingsButton: {
    padding: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  plusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  plusBadgeText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#ffffff",
  },
  logo: {
    height: 110,
    width: 220,
    resizeMode: "contain",
    marginBottom: 12,
  },
  hero: {
    alignItems: "center",
    paddingHorizontal: 12,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  heroBadgeText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: "#F8ECFF",
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
  },
  heroSubtitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    color: "rgba(255, 255, 255, 0.85)",
  },
  cardGradient: {
    width: "100%",
    borderRadius: 30,
    padding: 1.6,
    marginTop: 28,
    shadowColor: "#11022C",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.32,
    shadowRadius: 30,
    elevation: 10,
  },
  card: {
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    paddingVertical: 28,
    paddingHorizontal: 22,
  },
  cardHeader: {
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.bodyText,
  },
  cardDescription: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: theme.bodyMuted,
  },
  primaryAction: {
    borderRadius: 22,
    marginBottom: 18,
  },
  primaryActionGradient: {
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  primaryActionContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actionTextBlock: {
    flex: 1,
    paddingRight: 12,
  },
  actionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
  },
  actionSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255, 255, 255, 0.9)",
  },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryAction: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.accentMutedBorder,
    backgroundColor: theme.accentMuted,
  },
  secondaryActionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  secondaryActionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: theme.metaLabel,
  },
  secondaryActionSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255, 145, 77, 0.75)",
  },
  secondaryIcon: {
    marginLeft: 12,
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: theme.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  cardFooter: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  utilityButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    shadowColor: "#13093A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  utilityButtonSpacer: {
    marginRight: 14,
  },
  utilityButtonInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    marginTop: 36,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  footerTitle: {
    fontSize: 13,
    letterSpacing: 1.2,
    color: "rgba(255, 255, 255, 0.75)",
    textTransform: "uppercase",
  },
  footerText: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    color: "rgba(255, 255, 255, 0.86)",
  },
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
    maxHeight: 520,
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
  offerCard: {
    width: "90%",
    maxWidth: 420,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#1D0F24",
    position: "relative",
    shadowColor: "#11022C",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.32,
    shadowRadius: 30,
    elevation: 14,
  },
  offerHeader: {
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  offerBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  offerBadgeText: {
    marginLeft: 8,
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.5,
  },
  offerPriceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 12,
  },
  offerPrice: {
    fontSize: 34,
    fontWeight: "900",
    color: "#fff",
    marginRight: 8,
  },
  offerPriceCaption: {
    fontSize: 14,
    color: "rgba(255,255,255,0.82)",
    marginBottom: 6,
  },
  offerTagline: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255,255,255,0.9)",
  },
  offerTaxNote: {
    marginTop: 2,
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
  },
  offerClose: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  offerBody: {
    padding: 18,
    backgroundColor: "#ffffff",
  },
  offerListItem: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  offerListText: {
    marginLeft: 10,
    fontSize: 15,
    color: theme.bodyText,
    fontWeight: "600",
  },
  offerButton: {
    marginTop: 18,
    borderRadius: 16,
    overflow: "hidden",
  },
  offerButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  offerButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  offerLater: {
    marginTop: 12,
    alignItems: "center",
  },
  offerLaterText: {
    color: theme.helperText,
    fontSize: 14,
    fontWeight: "600",
  },
});

function capitaliseFirstLetter(value) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}
