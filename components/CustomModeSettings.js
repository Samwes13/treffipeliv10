import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { ref, update, serverTimestamp } from "firebase/database";
import { database } from "../firebaseConfig";
import styles from "../styles";
import { useLanguage } from "../contexts/LanguageContext";
import { toUserKey } from "../utils/userKey";
import theme from "../utils/theme";
import { saveSession } from "../utils/session";
import { usePlus } from "../contexts/PlusContext";
import { generateUniqueGamePin } from "../utils/gamePin";
import MotionPressable from "./MotionPressable";
import MotionFloat from "./MotionFloat";
import ModalAlert from "./ModalAlert";

const MIN_ROUNDS = 4;
const MAX_ROUNDS = 20;
const MIN_SKIP_USES = 1;
const DEFAULT_RULE_ROUNDS = [3, 5, 6];
const RULE_CONFIG = [
  { id: "reverse_answer", labelKey: "Reverse Answer" },
  { id: "majority_decides", labelKey: "Majority decides" },
  { id: "loudest_decides", labelKey: "Loudest decides" },
  { id: "skip_rule", labelKey: "Skip rule" },
  { id: "custom_rule", labelKey: "Custom Rule", hasText: true },
];

const clampSkipUses = (value, roundsTotal) =>
  Math.max(MIN_SKIP_USES, Math.min(roundsTotal, value));

const getDefaultActiveRounds = (roundsTotal) => {
  const base = DEFAULT_RULE_ROUNDS.filter((round) => round <= roundsTotal);
  if (base.length) {
    return base;
  }
  return [Math.max(MIN_ROUNDS, Math.min(roundsTotal, MAX_ROUNDS))];
};

const buildRulesState = () =>
  RULE_CONFIG.map((rule) => ({
    id: rule.id,
    enabled: false,
    activeRounds: [],
    text: "",
    uses: rule.id === "skip_rule" ? MIN_SKIP_USES : undefined,
    hasText: !!rule.hasText,
    labelKey: rule.labelKey,
  }));

export default function CustomModeSettings({ navigation, route }) {
  const rawUsername = route.params?.username ?? "";
  const username = rawUsername.trim() || rawUsername;
  const { t } = useLanguage();
  const { isPlus } = usePlus();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [roundsTotal, setRoundsTotal] = useState(6);
  const [rules, setRules] = useState(buildRulesState);
  const [alertState, setAlertState] = useState({
    visible: false,
    title: "",
    message: "",
    variant: "info",
  });
  const skipRule = rules.find((rule) => rule.id === "skip_rule") || null;
  const skipRuleEnabled = !!skipRule?.enabled;
  const skipUses = clampSkipUses(
    typeof skipRule?.uses === "number" ? skipRule.uses : MIN_SKIP_USES,
    roundsTotal,
  );
  const skipHintText =
    skipUses === 1
      ? t("Each player can use Skip once during the game.")
      : t("Each player can use Skip {{count}} times during the game.", {
          count: skipUses,
        });
  const visibleRules = rules.filter((rule) => rule.id !== "skip_rule");

  const roundOptions = useMemo(
    () => Array.from({ length: roundsTotal }, (_, idx) => idx + 1),
    [roundsTotal],
  );

  const showAlert = (updates) =>
    setAlertState((prev) => ({ ...prev, visible: true, ...updates }));

  useEffect(() => {
    setRules((current) =>
      current.map((rule) => {
        if (rule.id === "skip_rule") {
          const baseUses =
            typeof rule.uses === "number" ? rule.uses : MIN_SKIP_USES;
          const nextUses = clampSkipUses(baseUses, roundsTotal);
          return nextUses === rule.uses ? rule : { ...rule, uses: nextUses };
        }
        return {
          ...rule,
          activeRounds: (rule.activeRounds || []).filter(
            (round) => round <= roundsTotal,
          ),
        };
      }),
    );
  }, [roundsTotal]);

const clampRounds = (value) => {
    const clamped = Math.max(MIN_ROUNDS, Math.min(MAX_ROUNDS, value));
    if (clamped % 2 === 0) {
      return clamped;
    }
    return clamped + 1 <= MAX_ROUNDS ? clamped + 1 : clamped - 1;
  };

  const updateRounds = (delta) => {
    setRoundsTotal((current) => clampRounds(current + delta));
  };

  const toggleRule = (ruleId) => {
    if (ruleId === "skip_rule") {
      return;
    }
    const defaultActiveRounds = getDefaultActiveRounds(roundsTotal);
    setRules((current) =>
      current.map((rule) => {
        if (rule.id !== ruleId) {
          return rule;
        }
        const enabled = !rule.enabled;
        const activeRounds =
          enabled && (!rule.activeRounds || rule.activeRounds.length === 0)
            ? defaultActiveRounds
            : rule.activeRounds || [];
        return { ...rule, enabled, activeRounds };
      }),
    );
  };

  const toggleSkipRule = () => {
    setRules((current) =>
      current.map((rule) => {
        if (rule.id !== "skip_rule") {
          return rule;
        }
        const enabled = !rule.enabled;
        const baseUses =
          typeof rule.uses === "number" ? rule.uses : MIN_SKIP_USES;
        return {
          ...rule,
          enabled,
          uses: clampSkipUses(baseUses, roundsTotal),
        };
      }),
    );
  };

  const updateSkipUses = (delta) => {
    setRules((current) =>
      current.map((rule) => {
        if (rule.id !== "skip_rule") {
          return rule;
        }
        const baseUses =
          typeof rule.uses === "number" ? rule.uses : MIN_SKIP_USES;
        const nextUses = clampSkipUses(baseUses + delta, roundsTotal);
        return nextUses === rule.uses ? rule : { ...rule, uses: nextUses };
      }),
    );
  };

  const toggleRoundForRule = (ruleId, round) => {
    setRules((current) =>
      current.map((rule) => {
        if (rule.id !== ruleId) {
          return rule;
        }
        const active = new Set(rule.activeRounds || []);
        if (active.has(round)) {
          active.delete(round);
        } else {
          active.add(round);
        }
        return {
          ...rule,
          activeRounds: Array.from(active).sort((a, b) => a - b),
        };
      }),
    );
  };

  const updateRuleText = (ruleId, text) => {
    setRules((current) =>
      current.map((rule) =>
        rule.id === ruleId ? { ...rule, text } : rule,
      ),
    );
  };

  const handleBack = () => {
    navigation.navigate("GameOptionScreen", { username });
  };

  const handleCreateGame = async () => {
    if (!username) {
      showAlert({
        title: t("Username Missing"),
        message: t("Use the back button to choose a username before joining a game."),
        variant: "error",
      });
      navigation.navigate("EnterUsername");
      return;
    }

    if (roundsTotal < MIN_ROUNDS) {
      showAlert({
        title: t("Notice"),
        message: t("Rounds must be at least {{count}}.", { count: MIN_ROUNDS }),
        variant: "error",
      });
      return;
    }

    const customRule = rules.find((rule) => rule.id === "custom_rule");
    if (customRule?.enabled && !customRule.text.trim()) {
      showAlert({
        title: t("Custom Rule"),
        message: t("Custom rule text cannot be empty."),
        variant: "error",
      });
      return;
    }

    const skipRuleConfig = rules.find((rule) => rule.id === "skip_rule");
    const skipUsesValue = skipRuleConfig?.enabled
      ? clampSkipUses(
          Number(skipRuleConfig.uses) || MIN_SKIP_USES,
          roundsTotal,
        )
      : 0;
    const usernameKey = toUserKey(username);
    const rulesPayload = rules.map((rule) => {
      const payload = {
        id: rule.id,
        enabled: !!rule.enabled,
      };
      if (rule.id === "skip_rule") {
        payload.uses = clampSkipUses(
          Number(rule.uses) || MIN_SKIP_USES,
          roundsTotal,
        );
      } else {
        payload.activeRounds = Array.isArray(rule.activeRounds)
          ? rule.activeRounds.filter((round) => round <= roundsTotal)
          : [];
      }
      if (rule.id === "custom_rule") {
        payload.text = rule.text.trim();
      }
      return payload;
    });

    try {
      const gamepin = await generateUniqueGamePin();
      await update(ref(database, `games/${gamepin}`), {
        host: username,
        hostId: usernameKey,
        gamepin,
        mode: "custom",
        roundsTotal,
        rules: rulesPayload,
        status: "traits",
        isGameStarted: false,
        lastActivityAt: serverTimestamp(),
        players: {
          [usernameKey]: {
            username,
            usernameKey,
            traits: [],
            isHost: true,
            isPlus: !!isPlus,
            skipRemaining: skipUsesValue,
            skipAvailable: skipUsesValue > 0,
            decisions: {},
          },
        },
      });

      await saveSession(username, gamepin);
      navigation.navigate("CardTraits", { username, gamepin });
    } catch (error) {
      console.error("Failed to create custom game:", error);
      showAlert({
        title: t("Saving Failed"),
        message: t("Something went wrong. Please try again shortly."),
        variant: "error",
      });
    }
  };

  const cardPadding = Math.max(18, Math.min(26, Math.round(width * 0.06)));
  const bottomPadding = Math.max(20, (insets?.bottom || 0) + 28);

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
          <MotionFloat style={localStyles.blobLarge} driftX={9} driftY={-14} />
          <MotionFloat
            style={localStyles.blobSmall}
            driftX={-7}
            driftY={12}
            delay={500}
          />
        </View>
        <ScrollView
          style={localStyles.scroll}
          contentContainerStyle={[
            localStyles.scrollContent,
            { paddingBottom: bottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={localStyles.scrollInner}>
            <Text style={localStyles.eyebrow}>{t("Custom Mode")}</Text>
            <Text style={localStyles.title}>{t("Build your own round")}</Text>
            <Text style={localStyles.subtitle}>
              {t("Pick the number of dates and rule twists for this session.")}
            </Text>

            <LinearGradient
              colors={theme.cardFrameGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={localStyles.cardGradient}
            >
              <View style={[localStyles.card, { padding: cardPadding }]}>
                <View style={localStyles.sectionHeader}>
                  <Ionicons name="repeat-outline" size={18} color="#ff66c4" />
                  <Text style={localStyles.sectionTitle}>{t("Rounds")}</Text>
                </View>
                <View style={localStyles.roundsRow}>
                  <MotionPressable
                    style={[
                      localStyles.roundButton,
                      roundsTotal <= MIN_ROUNDS && localStyles.roundButtonDisabled,
                    ]}
                    onPress={() => updateRounds(-2)}
                    disabled={roundsTotal <= MIN_ROUNDS}
                  >
                    <Ionicons name="remove" size={22} color="#ffffff" />
                  </MotionPressable>
                  <View style={localStyles.roundValue}>
                    <Text style={localStyles.roundValueText}>{roundsTotal}</Text>
                    <Text style={localStyles.roundValueLabel}>{t("Dates")}</Text>
                  </View>
                  <MotionPressable
                    style={[
                      localStyles.roundButton,
                      roundsTotal >= MAX_ROUNDS && localStyles.roundButtonDisabled,
                    ]}
                    onPress={() => updateRounds(2)}
                    disabled={roundsTotal >= MAX_ROUNDS}
                  >
                    <Ionicons name="add" size={22} color="#ffffff" />
                  </MotionPressable>
                </View>
                <View style={localStyles.roundHint}>
                  <Ionicons name="pencil-outline" size={16} color="#c2724e" />
                  <Text style={localStyles.roundHintText}>
                    {t("Each player writes {{count}} traits.", {
                      count: roundsTotal,
                    })}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            <LinearGradient
              colors={theme.cardFrameGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={localStyles.cardGradient}
            >
              <View style={[localStyles.card, { padding: cardPadding }]}>
                <View style={localStyles.sectionHeader}>
                  <Ionicons name="sparkles-outline" size={18} color="#ff66c4" />
                  <Text style={localStyles.sectionTitle}>{t("Rules")}</Text>
                </View>

                {visibleRules.map((rule) => {
                  const isExpanded = !!rule.enabled;
                  const isSelected = !!rule.enabled;
                  return (
                    <View
                      key={rule.id}
                      style={[
                        localStyles.ruleCard,
                        rule.enabled && localStyles.ruleCardActive,
                      ]}
                    >
                      <View style={localStyles.ruleHeaderRow}>
                        <MotionPressable
                          style={localStyles.ruleTitleButton}
                          onPress={() => toggleRule(rule.id)}
                          activeOpacity={0.85}
                        >
                          <View style={localStyles.ruleTitleWrap}>
                            <Text style={localStyles.ruleTitle}>
                              {t(rule.labelKey)}
                            </Text>
                          </View>
                          <View
                            style={[
                              localStyles.ruleCheckbox,
                              isSelected && localStyles.ruleCheckboxActive,
                            ]}
                          >
                            {isSelected && (
                              <Ionicons
                                name="checkmark"
                                size={14}
                                color="#ffffff"
                              />
                            )}
                          </View>
                        </MotionPressable>
                      </View>
                      {isExpanded && (
                        <>
                          <View
                            style={[
                              localStyles.roundChips,
                              !rule.enabled && localStyles.roundChipsDisabled,
                            ]}
                          >
                            {roundOptions.map((round) => {
                              const active = rule.activeRounds?.includes(round);
                              return (
                                <MotionPressable
                                  key={`${rule.id}-${round}`}
                                  style={[
                                    localStyles.roundChip,
                                    active && localStyles.roundChipActive,
                                    !rule.enabled && localStyles.roundChipDisabled,
                                  ]}
                                  onPress={() =>
                                    toggleRoundForRule(rule.id, round)
                                  }
                                  disabled={!rule.enabled}
                                >
                                  <Text
                                    style={[
                                      localStyles.roundChipText,
                                      active && localStyles.roundChipTextActive,
                                    ]}
                                  >
                                    {round}
                                  </Text>
                                </MotionPressable>
                              );
                            })}
                          </View>

                          {rule.hasText && rule.enabled && (
                            <TextInput
                              style={localStyles.ruleInput}
                              placeholder={t("Write the custom rule here")}
                              placeholderTextColor={theme.placeholder}
                              value={rule.text}
                              onChangeText={(text) =>
                                updateRuleText(rule.id, text)
                              }
                              multiline
                            />
                          )}
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            </LinearGradient>

            <LinearGradient
              colors={["rgba(255,255,255,0.98)", "rgba(226,255,247,0.92)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={localStyles.skipRuleGradient}
            >
              <View style={[localStyles.card, localStyles.skipRuleCard, { padding: cardPadding }]}>
                <View style={localStyles.skipRuleHeader}>
                  <View style={localStyles.skipRuleTitleRow}>
                    <Ionicons name="fast-food-outline" size={18} color="#15803d" />
                    <Text style={localStyles.skipRuleTitle}>{t("Skip rule")}</Text>
                  </View>
                  <MotionPressable
                    style={[
                      localStyles.skipToggle,
                      skipRuleEnabled && localStyles.skipToggleActive,
                    ]}
                    onPress={toggleSkipRule}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={skipRuleEnabled ? "checkmark" : "close"}
                      size={16}
                      color="#ffffff"
                    />
                  </MotionPressable>
                </View>
                <View
                  style={[
                    localStyles.skipMeterRow,
                    !skipRuleEnabled && localStyles.skipMeterDisabled,
                  ]}
                >
                  <MotionPressable
                    style={[
                      localStyles.skipMeterButton,
                      (skipUses <= MIN_SKIP_USES || !skipRuleEnabled) &&
                        localStyles.skipMeterButtonDisabled,
                    ]}
                    onPress={() => updateSkipUses(-1)}
                    disabled={!skipRuleEnabled || skipUses <= MIN_SKIP_USES}
                  >
                    <Ionicons name="remove" size={22} color="#ffffff" />
                  </MotionPressable>
                  <View style={localStyles.skipMeterValue}>
                    <Text style={localStyles.skipMeterValueText}>{skipUses}</Text>
                    <Text style={localStyles.skipMeterValueLabel}>{t("Skips")}</Text>
                  </View>
                  <MotionPressable
                    style={[
                      localStyles.skipMeterButton,
                      (skipUses >= roundsTotal || !skipRuleEnabled) &&
                        localStyles.skipMeterButtonDisabled,
                    ]}
                    onPress={() => updateSkipUses(1)}
                    disabled={!skipRuleEnabled || skipUses >= roundsTotal}
                  >
                    <Ionicons name="add" size={22} color="#ffffff" />
                  </MotionPressable>
                </View>
                <View style={localStyles.skipHint}>
                  <Ionicons name="flash-outline" size={16} color="#15803d" />
                  <Text style={localStyles.skipHintText}>{skipHintText}</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={localStyles.actionsRow}>
              <MotionPressable
                style={localStyles.secondaryButton}
                onPress={handleBack}
              >
                <Ionicons
                  name="arrow-back"
                  size={18}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />
                <Text style={localStyles.secondaryButtonText}>
                  {t("Back")}
                </Text>
              </MotionPressable>
              <MotionPressable
                style={localStyles.primaryButton}
                onPress={handleCreateGame}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={theme.primaryButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={localStyles.primaryButtonGradient}
                >
                  <Text style={localStyles.primaryButtonText}>
                    {t("Create Game")}
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color="#ffffff" />
                </LinearGradient>
              </MotionPressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <ModalAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        variant={alertState.variant}
        onClose={() => setAlertState((current) => ({ ...current, visible: false }))}
      />
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
    top: -150,
    right: -110,
    width: 260,
    height: 260,
    borderRadius: 260,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    transform: [{ rotate: "16deg" }],
  },
  blobSmall: {
    position: "absolute",
    bottom: 140,
    left: -90,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    transform: [{ rotate: "-14deg" }],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  scrollInner: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "rgba(255, 255, 255, 0.75)",
  },
  title: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: "800",
    color: "#ffffff",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255, 255, 255, 0.85)",
  },
  cardGradient: {
    marginTop: 20,
    borderRadius: 28,
    padding: 1.5,
    shadowColor: "#13093A",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.32,
    shadowRadius: 26,
    elevation: 10,
  },
  card: {
    borderRadius: 26,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: "700",
    color: theme.bodyText,
  },
  roundsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ff66c4",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7a1242",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  roundButtonDisabled: {
    opacity: 0.5,
  },
  roundValue: {
    alignItems: "center",
    paddingHorizontal: 12,
  },
  roundValueText: {
    fontSize: 30,
    fontWeight: "800",
    color: theme.bodyText,
  },
  roundValueLabel: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
    color: theme.bodyMuted,
  },
  roundHint: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 145, 77, 0.14)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  roundHintText: {
    marginLeft: 8,
    fontSize: 13,
    color: theme.metaLabel,
    flex: 1,
  },
  ruleCard: {
    marginBottom: 18,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255, 145, 77, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 145, 77, 0.2)",
  },
  ruleCardActive: {
    backgroundColor: "rgba(255, 102, 196, 0.16)",
    borderColor: "rgba(255, 102, 196, 0.45)",
  },
  ruleHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  ruleTitleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 8,
  },
  ruleTitleWrap: {
    flex: 1,
    paddingRight: 12,
  },
  ruleTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.bodyText,
  },
  ruleCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "rgba(255, 102, 196, 0.55)",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  ruleCheckboxActive: {
    backgroundColor: theme.accentPrimary,
    borderColor: theme.accentPrimary,
  },
  roundChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  roundChipsDisabled: {
    opacity: 0.45,
  },
  roundChip: {
    minWidth: 34,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 145, 77, 0.35)",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginBottom: 8,
  },
  roundChipActive: {
    backgroundColor: "rgba(255, 102, 196, 0.2)",
    borderColor: "rgba(255, 102, 196, 0.6)",
  },
  roundChipDisabled: {
    opacity: 0.6,
  },
  roundChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.metaLabel,
  },
  roundChipTextActive: {
    color: theme.accentPrimary,
  },
  ruleInput: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 102, 196, 0.3)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.bodyText,
    backgroundColor: "#ffffff",
    minHeight: 52,
    textAlignVertical: "top",
  },
  skipRuleGradient: {
    marginTop: 18,
    borderRadius: 26,
    padding: 1.5,
    shadowColor: "#0f2f1f",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 8,
  },
  skipRuleCard: {
    borderRadius: 24,
    backgroundColor: "rgba(236, 253, 245, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(22, 163, 74, 0.22)",
  },
  skipRuleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  skipRuleTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  skipRuleTitle: {
    marginLeft: 8,
    fontSize: 17,
    fontWeight: "700",
    color: "#14532d",
  },
  skipToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(22, 163, 74, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  skipToggleActive: {
    backgroundColor: "#16a34a",
  },
  skipMeterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skipMeterDisabled: {
    opacity: 0.55,
  },
  skipMeterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#14532d",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  skipMeterButtonDisabled: {
    opacity: 0.45,
  },
  skipMeterValue: {
    alignItems: "center",
    paddingHorizontal: 12,
  },
  skipMeterValueText: {
    fontSize: 30,
    fontWeight: "800",
    color: "#14532d",
  },
  skipMeterValueLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(20, 83, 45, 0.7)",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  skipHint: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22, 163, 74, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  skipHintText: {
    marginLeft: 8,
    fontSize: 13,
    color: "#166534",
    flex: 1,
    lineHeight: 18,
  },
  actionsRow: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: theme.bodyText,
    marginRight: 12,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  primaryButton: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#13093A",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 22,
    elevation: 8,
  },
  primaryButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
});
