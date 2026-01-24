import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../contexts/LanguageContext";
import MotionPressable from "./MotionPressable";

export default function GameRules({ onClose }) {
  const { t } = useLanguage();
  const handleClose = typeof onClose === "function" ? onClose : () => {};

  const sections = [
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

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.container}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={["#ff6db4", "#ff93c4", "#ffb6d9"]}
        style={s.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={s.headerRow}>
          <View style={s.headerTitleGroup}>
            <View style={s.headerIconWrap}>
              <Ionicons name="heart" size={18} color="#f43f5e" />
            </View>
            <View>
              <Text style={s.headerTitle}>{t("How to play")}</Text>
              <View style={s.headerSubtitleRow}>
                <View style={s.headerSubtitleLine} />
                <Text style={s.headerSubtitle}>
                  {t("A party game for 3+ friends")}
                </Text>
                <View style={s.headerSubtitleLine} />
              </View>
            </View>
          </View>
          <MotionPressable
            style={s.closeButton}
            onPress={handleClose}
            accessibilityLabel={t("Close")}
          >
            <Ionicons name="close" size={20} color="#6b3a45" />
          </MotionPressable>
        </View>
      </LinearGradient>

      {sections.map((section) => {
        const cardStyle =
          section.variant === "note" ? [s.card, s.cardNote] : s.card;
        const titleStyle =
          section.variant === "note" ? s.noteTitle : s.cardTitle;

        return (
          <View key={section.title} style={cardStyle}>
            <View style={s.cardHeader}>
              <View style={s.cardIconWrap}>
                <Ionicons
                  name={section.icon}
                  size={22}
                  color={section.iconColor}
                />
              </View>
              <Text style={titleStyle}>{t(section.title)}</Text>
            </View>
            <View style={s.cardDivider} />
            {section.lines.map((entry, index) => {
              const lineKey = `${section.title}-${entry.type}-${index}`;

              if (entry.type === "pillRow") {
                return (
                  <View key={lineKey} style={s.linePillRow}>
                    {entry.items.map((item, itemIndex) => {
                      const isPositive = item.tone === "positive";
                      return (
                        <View
                          key={`${lineKey}-${itemIndex}`}
                          style={[
                            s.linePill,
                            isPositive ? s.linePillPositive : s.linePillNegative,
                          ]}
                        >
                          <Ionicons
                            name={item.icon}
                            size={14}
                            color={isPositive ? "#e11d48" : "#7c3aed"}
                            style={s.linePillIcon}
                          />
                          <Text
                            style={[
                              s.linePillText,
                              isPositive
                                ? s.linePillTextPositive
                                : s.linePillTextNegative,
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
                      s.linePill,
                      s.linePillWide,
                      isPositive ? s.linePillPositive : s.linePillNegative,
                    ]}
                  >
                    <Ionicons
                      name={entry.icon}
                      size={14}
                      color={isPositive ? "#e11d48" : "#7c3aed"}
                      style={s.linePillIcon}
                    />
                    <Text
                      style={[
                        s.linePillText,
                        isPositive
                          ? s.linePillTextPositive
                          : s.linePillTextNegative,
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
                        ? s.noteEmphasis
                        : s.noteText
                    }
                  >
                    {t(entry.text)}
                  </Text>
                );
              }

              if (entry.type === "lead") {
                return (
                  <Text key={lineKey} style={s.lineLead}>
                    {t(entry.text)}
                  </Text>
                );
              }

              return (
                <Text key={lineKey} style={s.lineText}>
                  {t(entry.text)}
                </Text>
              );
            })}
          </View>
        );
      })}

      <MotionPressable
        style={s.ctaButton}
        onPress={handleClose}
        accessibilityRole="button"
        accessibilityLabel={t("Close")}
      >
        <LinearGradient
          colors={["#ff7b7b", "#ff6b6b", "#ff906d"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.ctaButtonGradient}
        >
          <Text style={s.ctaButtonText}>{t("Let's play!")}</Text>
        </LinearGradient>
      </MotionPressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
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
  },
  headerSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.92)",
    letterSpacing: 0.4,
  },
  headerSubtitleLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.65)",
    marginHorizontal: 6,
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
  noteTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#7C2D12",
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
  ctaButton: {
    marginTop: 4,
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
