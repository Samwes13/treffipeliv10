import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import styles from "../styles";
import { useLanguage } from "../contexts/LanguageContext";
import { usePlus } from "../contexts/PlusContext";
import theme from "../utils/theme";
import {
  loadHowToPlayHidden,
  saveHowToPlayHidden,
} from "../utils/howToPlayPreference";
import SettingsModal from "./SettingsModal";
import PlusModal from "./PlusModal";
import GameRulesModal from "./GameRulesModal";
import MotionPressable from "./MotionPressable";

const SECTIONS = [
  {
    title: "Join the game",
    icon: "people",
    iconColor: "#5C6CFF",
    lines: [
      { type: "lead", text: "Create a game or join with a code" },
      {
        type: "text",
        text: "One player creates the game, others join with the code.",
      },
    ],
  },
  {
    title: "Write the traits",
    icon: "pencil",
    iconColor: "#F59E0B",
    lines: [
      {
        type: "lead",
        text: "Write 6 traits for a fictional date partner:",
      },
      {
        type: "pillRow",
        items: [
          { tone: "positive", icon: "heart", text: "3 good" },
          { tone: "negative", icon: "sad", text: "3 bad" },
        ],
      },
      { type: "text", text: "The game is built from these traits." },
    ],
  },
  {
    title: "Traits reveal",
    icon: "albums",
    iconColor: "#F472B6",
    lines: [
      { type: "lead", text: "One trait at a time" },
      {
        type: "text",
        text:
          "Each round shows one trait and the player whose turn it is to decide!",
      },
    ],
  },
  {
    title: "Decide",
    icon: "heart",
    iconColor: "#F43F5E",
    lines: [
      { type: "lead", text: "Keep dating or break up?" },
      {
        type: "pill",
        tone: "positive",
        icon: "heart",
        text: "Keep - continue to the next date",
      },
      {
        type: "pill",
        tone: "negative",
        icon: "heart-dislike",
        text: "Break up - this won't work",
      },
      { type: "text", text: "Everyone sees your decision." },
    ],
  },
  {
    title: "6 rounds",
    icon: "repeat",
    iconColor: "#7C3AED",
    lines: [
      { type: "lead", text: "The game has a total of 6 rounds." },
      { type: "text", text: "Each round every player gets one trait." },
    ],
  },
  {
    title: "At the end",
    icon: "flame",
    iconColor: "#F97316",
    variant: "note",
    lines: [
      { type: "note", text: "No winners." },
      { type: "note", text: "No losers." },
      {
        type: "note-emphasis",
        text: "Just group drama, laughs, and bad dates.",
      },
    ],
  },
];

export default function HowToPlay({ navigation, route }) {
  const { t } = useLanguage();
  const { isPlus, restorePurchases } = usePlus();
  const { width, height } = useWindowDimensions();
  const [showSettings, setShowSettings] = useState(false);
  const [showPlus, setShowPlus] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [hideNextTime, setHideNextTime] = useState(false);
  const planName = "Plus";
  const planPrice = "2,99 EUR";
  const username = route.params?.username ?? "";
  const gamepin = route.params?.gamepin ?? "";
  const sizeScale = Math.max(
    0.8,
    Math.min(1, Math.min(width / 390, height / 780)),
  );
  const spaceScale = Math.max(
    0.8,
    Math.min(1, Math.min(width / 390, height / 780)),
  );
  const scale = (value) => Math.round(value * sizeScale);
  const space = (value) => Math.round(value * spaceScale);
  const closeButtonSize = space(34);
  const closeButtonGap = space(8);
  const dynamic = {
    container: {
      padding: space(16),
      paddingBottom: space(22),
    },
    header: {
      borderRadius: space(26),
      paddingVertical: space(14),
      paddingHorizontal: space(16),
      marginBottom: space(14),
    },
    headerRow: {
      paddingRight: closeButtonSize + closeButtonGap,
    },
    headerIconWrap: {
      width: space(36),
      height: space(36),
      borderRadius: space(18),
      marginRight: space(10),
    },
    headerTitle: {
      fontSize: scale(22),
    },
    headerSubtitleRow: {
      marginTop: space(4),
    },
    headerSubtitle: {
      fontSize: scale(12),
    },
    headerSubtitleLine: {
      marginHorizontal: space(6),
    },
    closeButton: {
      width: closeButtonSize,
      height: closeButtonSize,
      borderRadius: Math.round(closeButtonSize / 2),
    },
    settingsButton: {
      width: closeButtonSize,
      height: closeButtonSize,
      borderRadius: Math.round(closeButtonSize / 2),
      marginRight: space(8),
    },
    card: {
      borderRadius: space(18),
      padding: space(14),
      marginBottom: space(12),
    },
    cardIconWrap: {
      width: space(38),
      height: space(38),
      borderRadius: space(19),
      marginRight: space(10),
    },
    cardTitle: {
      fontSize: scale(16),
    },
    noteTitle: {
      fontSize: scale(16),
    },
    cardDivider: {
      marginVertical: space(10),
    },
    lineLead: {
      fontSize: scale(14),
      marginBottom: space(6),
    },
    lineText: {
      fontSize: scale(13),
      lineHeight: scale(19),
      marginBottom: space(6),
    },
    linePillRow: {
      marginBottom: space(6),
    },
    linePill: {
      paddingHorizontal: space(10),
      paddingVertical: space(6),
      marginRight: space(8),
      marginBottom: space(8),
    },
    linePillIcon: {
      marginRight: space(6),
    },
    linePillText: {
      fontSize: scale(13),
    },
    noteText: {
      fontSize: scale(13),
      lineHeight: scale(19),
      marginBottom: space(4),
    },
    noteEmphasis: {
      fontSize: scale(13),
      lineHeight: scale(19),
      marginBottom: space(4),
    },
    hideToggleRow: {
      paddingVertical: space(8),
      paddingHorizontal: space(14),
      borderRadius: space(14),
    },
    hideToggleText: {
      fontSize: scale(13),
    },
    ctaButton: {
      borderRadius: space(20),
    },
    ctaButtonGradient: {
      paddingVertical: space(14),
      paddingHorizontal: space(16),
    },
    ctaButtonText: {
      fontSize: scale(18),
    },
  };

  const handleRestorePurchases = async () => {
    try {
      await restorePurchases();
    } catch (error) {
      console.warn("Restore purchases failed", error?.message || error);
    }
  };

  const navigateToTraits = () => {
    if (!username || !gamepin) {
      navigation.goBack();
      return;
    }
    navigation.replace("CardTraits", { username, gamepin });
  };

  const handleClose = async () => {
    await saveHowToPlayHidden(hideNextTime);
    navigateToTraits();
  };

  const toggleHideNextTime = async () => {
    const nextValue = !hideNextTime;
    setHideNextTime(nextValue);
    await saveHowToPlayHidden(nextValue);
  };

  useEffect(() => {
    let mounted = true;
    const loadPreference = async () => {
      const hidden = await loadHowToPlayHidden();
      if (mounted) {
        setHideNextTime(hidden);
      }
    };

    loadPreference();
    return () => {
      mounted = false;
    };
  }, []);

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
        <View style={localStyles.modalBackdrop}>
          <LinearGradient
            colors={["rgba(255, 118, 182, 0.45)", "rgba(120, 64, 255, 0.45)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={localStyles.modalBackdropGradient}
            pointerEvents="none"
          />
          <View style={localStyles.modalPanel}>
            <ScrollView
              style={rules.scroll}
              contentContainerStyle={[rules.container, dynamic.container]}
              showsVerticalScrollIndicator={false}
            >
              <LinearGradient
                colors={["#ff6db4", "#ff93c4", "#ffb6d9"]}
                style={[rules.header, dynamic.header]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={[rules.headerRow, dynamic.headerRow]}>
                  <View style={rules.headerTitleGroup}>
                    <View style={[rules.headerIconWrap, dynamic.headerIconWrap]}>
                      <Ionicons name="heart" size={scale(18)} color="#f43f5e" />
                    </View>
                    <View style={rules.headerTextBlock}>
                      <Text style={[rules.headerTitle, dynamic.headerTitle]}>
                        {t("How to play")}
                      </Text>
                      <View
                        style={[rules.headerSubtitleRow, dynamic.headerSubtitleRow]}
                      >
                        <View
                          style={[
                            rules.headerSubtitleLine,
                            dynamic.headerSubtitleLine,
                          ]}
                        />
                        <Text
                          style={[rules.headerSubtitle, dynamic.headerSubtitle]}
                        >
                          {t("A party game for 3+ friends")}
                        </Text>
                        <View
                          style={[
                            rules.headerSubtitleLine,
                            dynamic.headerSubtitleLine,
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                  <View style={rules.headerActions}>
                    <MotionPressable
                      style={[rules.closeButton, dynamic.closeButton]}
                      onPress={handleClose}
                      accessibilityLabel={t("Close")}
                    >
                      <Ionicons name="close" size={scale(20)} color="#6b3a45" />
                    </MotionPressable>
                  </View>
                </View>
              </LinearGradient>

              {SECTIONS.map((section) => {
                const cardStyle =
                  section.variant === "note"
                    ? [rules.card, rules.cardNote, dynamic.card]
                    : [rules.card, dynamic.card];
                const titleStyle =
                  section.variant === "note"
                    ? [rules.noteTitle, dynamic.noteTitle]
                    : [rules.cardTitle, dynamic.cardTitle];

                return (
                  <View key={section.title} style={cardStyle}>
                    <View style={rules.cardHeader}>
                      <View style={[rules.cardIconWrap, dynamic.cardIconWrap]}>
                        <Ionicons
                          name={section.icon}
                          size={scale(22)}
                          color={section.iconColor}
                        />
                      </View>
                      <Text style={titleStyle}>{t(section.title)}</Text>
                    </View>
                    <View style={[rules.cardDivider, dynamic.cardDivider]} />
                    {section.lines.map((entry, index) => {
                      const lineKey = `${section.title}-${entry.type}-${index}`;

                      if (entry.type === "pillRow") {
                        return (
                          <View
                            key={lineKey}
                            style={[rules.linePillRow, dynamic.linePillRow]}
                          >
                            {entry.items.map((item, itemIndex) => {
                              const isPositive = item.tone === "positive";
                              return (
                                <View
                                  key={`${lineKey}-${itemIndex}`}
                                  style={[
                                    rules.linePill,
                                    dynamic.linePill,
                                    isPositive
                                      ? rules.linePillPositive
                                      : rules.linePillNegative,
                                  ]}
                                >
                                  <Ionicons
                                    name={item.icon}
                                    size={scale(14)}
                                    color={isPositive ? "#e11d48" : "#7c3aed"}
                                    style={[
                                      rules.linePillIcon,
                                      dynamic.linePillIcon,
                                    ]}
                                  />
                                  <Text
                                    style={[
                                      rules.linePillText,
                                      dynamic.linePillText,
                                      isPositive
                                        ? rules.linePillTextPositive
                                        : rules.linePillTextNegative,
                                    ]}
                                  >
                                    {t(item.text)}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        );
                      }

                      if (entry.type === "pill") {
                        const isPositive = entry.tone === "positive";
                        return (
                          <View
                            key={lineKey}
                            style={[
                              rules.linePill,
                              rules.linePillWide,
                              dynamic.linePill,
                              isPositive
                                ? rules.linePillPositive
                                : rules.linePillNegative,
                            ]}
                          >
                            <Ionicons
                              name={entry.icon}
                              size={scale(14)}
                              color={isPositive ? "#e11d48" : "#7c3aed"}
                              style={[rules.linePillIcon, dynamic.linePillIcon]}
                            />
                            <Text
                              style={[
                                rules.linePillText,
                                dynamic.linePillText,
                                isPositive
                                  ? rules.linePillTextPositive
                                  : rules.linePillTextNegative,
                              ]}
                            >
                              {t(entry.text)}
                            </Text>
                          </View>
                        );
                      }

                      if (entry.type === "note" || entry.type === "note-emphasis") {
                        return (
                          <Text
                            key={lineKey}
                            style={
                              entry.type === "note-emphasis"
                                ? [rules.noteEmphasis, dynamic.noteEmphasis]
                                : [rules.noteText, dynamic.noteText]
                            }
                          >
                            {t(entry.text)}
                          </Text>
                        );
                      }

                      if (entry.type === "lead") {
                        return (
                          <Text
                            key={lineKey}
                            style={[rules.lineLead, dynamic.lineLead]}
                          >
                            {t(entry.text)}
                          </Text>
                        );
                      }

                      return (
                        <Text
                          key={lineKey}
                          style={[rules.lineText, dynamic.lineText]}
                        >
                          {t(entry.text)}
                        </Text>
                      );
                    })}
                  </View>
                );
              })}

              <MotionPressable
                style={[rules.hideToggleRow, dynamic.hideToggleRow]}
                onPress={toggleHideNextTime}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: hideNextTime }}
              >
                <Ionicons
                  name={hideNextTime ? "checkbox" : "square-outline"}
                  size={scale(20)}
                  color={hideNextTime ? theme.accentPrimary : theme.helperText}
                />
                <Text style={[rules.hideToggleText, dynamic.hideToggleText]}>
                  {t("Don't show again")}
                </Text>
              </MotionPressable>

              <MotionPressable
                style={[rules.ctaButton, dynamic.ctaButton]}
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel={t("Close")}
              >
                <LinearGradient
                  colors={["#ff7b7b", "#ff6b6b", "#ff906d"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[rules.ctaButtonGradient, dynamic.ctaButtonGradient]}
                >
                  <Text style={[rules.ctaButtonText, dynamic.ctaButtonText]}>
                    {t("Let's play!")}
                  </Text>
                </LinearGradient>
              </MotionPressable>
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>

      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onOpenGameRules={() => setShowRules(true)}
        onOpenPlus={() => {
          if (isPlus) {
            return;
          }
          setShowSettings(false);
          setShowPlus(true);
        }}
        isPlus={isPlus}
      />

      {!isPlus && (
        <PlusModal
          visible={showPlus}
          onClose={() => setShowPlus(false)}
          planName={planName}
          planPrice={planPrice}
          onRestorePurchases={handleRestorePurchases}
        />
      )}
      <GameRulesModal
        visible={showRules}
        onClose={() => setShowRules(false)}
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    position: "relative",
    backgroundColor: "rgba(26, 6, 24, 0.6)",
  },
  modalBackdropGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  modalPanel: {
    width: "100%",
    maxWidth: 640,
    maxHeight: "92%",
    flex: 1,
    backgroundColor: "rgba(255, 236, 247, 0.96)",
    borderRadius: 34,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.7)",
    shadowColor: "#4B0F2E",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 12,
  },
});

const rules = StyleSheet.create({
  scroll: {
    flex: 1,
    width: "100%",
  },
  container: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 22,
  },
  header: {
    borderRadius: 26,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    shadowColor: "#4B0F2E",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 6,
  },
  headerRow: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  headerTextBlock: {
    flexShrink: 1,
    minWidth: 0,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.7)",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  headerSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    minWidth: 0,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.92)",
    letterSpacing: 0.4,
    flexShrink: 1,
  },
  headerSubtitleLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.65)",
    marginHorizontal: 6,
  },
  headerActions: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  settingsButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    marginRight: 8,
    shadowColor: "#4B0F2E",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    shadowColor: "#4B0F2E",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  card: {
    backgroundColor: "rgba(255, 250, 252, 0.96)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(243, 180, 213, 0.45)",
    shadowColor: "#3B0B2F",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  cardNote: {
    backgroundColor: "rgba(255, 247, 239, 0.96)",
    borderColor: "rgba(248, 193, 142, 0.4)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(243, 180, 213, 0.6)",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4B2C4F",
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#7C2D12",
  },
  cardDivider: {
    height: 1,
    backgroundColor: "rgba(119, 93, 116, 0.12)",
    marginVertical: 10,
  },
  lineLead: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4B2C4F",
    marginBottom: 6,
  },
  lineText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#6B3A55",
    marginBottom: 6,
  },
  linePillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 6,
  },
  linePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  linePillWide: {
    alignSelf: "flex-start",
    marginRight: 0,
  },
  linePillPositive: {
    backgroundColor: "rgba(255, 90, 150, 0.14)",
    borderColor: "rgba(255, 90, 150, 0.35)",
  },
  linePillNegative: {
    backgroundColor: "rgba(124, 58, 237, 0.14)",
    borderColor: "rgba(124, 58, 237, 0.35)",
  },
  linePillIcon: {
    marginRight: 6,
  },
  linePillText: {
    fontSize: 13,
    fontWeight: "700",
  },
  linePillTextPositive: {
    color: "#e11d48",
  },
  linePillTextNegative: {
    color: "#7c3aed",
  },
  noteText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#7C2D12",
    marginBottom: 4,
  },
  noteEmphasis: {
    fontSize: 13,
    lineHeight: 19,
    color: "#7C2D12",
    fontWeight: "700",
    marginBottom: 4,
  },
  hideToggleRow: {
    marginTop: 4,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(119, 93, 116, 0.2)",
    backgroundColor: "rgba(255, 255, 255, 0.75)",
  },
  hideToggleText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: "600",
    color: theme.helperText,
  },
  ctaButton: {
    marginTop: 8,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#6B1D3A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  ctaButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  ctaButtonText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
});
