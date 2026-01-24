import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Image,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ref,
  get,
  set,
  child,
  update,
  remove,
  serverTimestamp,
} from "firebase/database";
import { database } from "../firebaseConfig";
import styles from "../styles";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import ModalAlert from "./ModalAlert";
import { useLanguage } from "../contexts/LanguageContext";
import { toUserKey } from "../utils/userKey";
import getLogoSource from "../utils/logo";
import { saveSession } from "../utils/session";
import { usePlus } from "../contexts/PlusContext";
import { isGameInactive } from "../utils/gameActivity";
import { loadHowToPlayHidden } from "../utils/howToPlayPreference";
import MotionPressable from "./MotionPressable";
import MotionFloat from "./MotionFloat";

const PIN_LENGTH = 6;

export default function JoinGame({ navigation, route }) {
  const rawUsername = route.params?.username ?? "";
  const username = rawUsername.trim() || rawUsername;
  const { t, language } = useLanguage();
  const { isPlus } = usePlus();
  const logoSource = getLogoSource(language);
  const { width } = useWindowDimensions();
  const isCompact = width < 360;

  const [pincode, setPincode] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [alertState, setAlertState] = useState({
    visible: false,
    title: "",
    message: "",
    variant: "info",
  });

  const isValidPinSoFar = useMemo(() => /^[A-Z0-9]{0,6}$/i.test(pincode), [
    pincode,
  ]);
  const formattedPin = useMemo(() => pincode.toUpperCase().slice(0, PIN_LENGTH), [
    pincode,
  ]);
  const progress = formattedPin.length / PIN_LENGTH;

  const showAlert = (updates) =>
    setAlertState((prev) => ({
      ...prev,
      visible: true,
      ...updates,
    }));

  const handleChangePin = (value) => {
    const cleanValue = value.replace(/[^a-z0-9]/gi, "").toUpperCase();
    setPincode(cleanValue.slice(0, PIN_LENGTH));
  };

  const ensureUsername = () => {
    if (!username) {
      showAlert({
        title: t("Username Missing"),
        message: t(
          "Use the back button to choose a username before joining a game.",
        ),
        variant: "error",
      });
      navigation.navigate("EnterUsername");
      return false;
    }

    return true;
  };

  const navigateToTraits = async (params) => {
    const hidden = await loadHowToPlayHidden();
    if (hidden) {
      navigation.navigate("CardTraits", params);
      return;
    }
    navigation.navigate("HowToPlay", params);
  };

  const handleJoinGame = async () => {
    if (!ensureUsername()) {
      return;
    }

    if (formattedPin.length !== PIN_LENGTH) {
      showAlert({
        title: t("Check the Game Code"),
        message: t("Game codes must be {{length}} characters long.", {
          length: PIN_LENGTH,
        }),
        variant: "error",
      });
      return;
    }

    setIsChecking(true);

    try {
      const gamesRef = ref(database, "games");
      const gameSnapshot = await get(child(gamesRef, formattedPin));

      if (!gameSnapshot.exists()) {
        showAlert({
          title: t("Game Code Not Found"),
          message: t("Make sure the code is correct and try again."),
          variant: "error",
        });
        return;
      }

      const gameData = gameSnapshot.val() || {};
      if (isGameInactive(gameData.lastActivityAt)) {
        try {
          await remove(ref(database, `games/${formattedPin}`));
        } catch (error) {
          console.warn(
            "Failed to remove inactive game:",
            error?.message || error,
          );
        }
        showAlert({
          title: t("Game Code Not Found"),
          message: t("Make sure the code is correct and try again."),
          variant: "error",
        });
        return;
      }
      const players = gameData.players || {};
      const normalizedDesired = username.trim().toLowerCase();
      const usernameKey = toUserKey(username);

      const nameInUse = Object.values(players || {}).some((player) => {
        const candidate = (player?.username || "").trim().toLowerCase();
        return candidate.length > 0 && candidate === normalizedDesired;
      });
      const keyConflict = Object.prototype.hasOwnProperty.call(
        players,
        usernameKey,
      );

      if (nameInUse || keyConflict) {
        showAlert({
          title: t("Name Already In Use"),
          message: t(
            "This game already has a player named {{name}}. Choose a different username.",
            { name: username },
          ),
          variant: "error",
        });
        return;
      }

      const playersRef = ref(
        database,
        `games/${formattedPin}/players/${usernameKey}`,
      );

      await set(playersRef, {
        username,
        usernameKey,
        traits: [],
        isHost: false,
        isPlus: !!isPlus,
      });

      await update(ref(database, `games/${formattedPin}`), {
        lastActivityAt: serverTimestamp(),
      });

      await saveSession(username, formattedPin);

      await navigateToTraits({ username, gamepin: formattedPin });
    } catch (error) {
      console.error("Error joining game", error);
      showAlert({
        title: t("Join Failed"),
        message: t("Something went wrong. Please try again shortly."),
        variant: "error",
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={["#ff66c4", "#ffde59"]}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />
      <SafeAreaView style={localStyles.safeArea} edges={["top", "bottom"]}>
        <View pointerEvents="none" style={localStyles.decorativeLayer}>
          <MotionFloat style={localStyles.blobLarge} driftX={8} driftY={-12} />
          <MotionFloat
            style={localStyles.blobSmall}
            driftX={-6}
            driftY={10}
            delay={450}
          />
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
              <Image source={logoSource} style={localStyles.logo} />

              <LinearGradient
                colors={["rgba(255,255,255,0.82)", "rgba(255,255,255,0.55)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={localStyles.cardGradient}
              >
                <View style={localStyles.card}>
                  <View style={localStyles.cardHeader}>
                    <View style={localStyles.cardBadge}>
                      <Ionicons
                        name="lock-open-outline"
                        size={18}
                        color="#ff66c4"
                      />
                      <Text style={localStyles.cardBadgeText}>
                        {t("Only the correct code unlocks entry")}
                      </Text>
                    </View>
                    <Text style={localStyles.cardTitle}>{t("Game Code")}</Text>
                    <Text style={localStyles.cardCopy}>
                      {t("Each code uses six letters or numbers.")}
                    </Text>
                  </View>

                  <View
                    style={[
                      localStyles.inputWrapper,
                      !isValidPinSoFar && formattedPin.length > 0
                        ? localStyles.inputWrapperError
                        : null,
                    ]}
                  >
                    <Ionicons
                      name="key-outline"
                      size={24}
                      color="#ff66c4"
                      style={localStyles.inputIcon}
                    />
                    <TextInput
                      style={localStyles.input}
                      placeholder={t("ABCDE1")}
                      value={formattedPin}
                      onChangeText={handleChangePin}
                      placeholderTextColor="rgba(45, 16, 42, 0.4)"
                      keyboardType="ascii-capable"
                      autoCorrect={false}
                      autoCapitalize="characters"
                      returnKeyType="go"
                      textContentType="oneTimeCode"
                      onSubmitEditing={handleJoinGame}
                    />
                  </View>

                  <View
                    style={[
                      localStyles.metaRow,
                      isCompact && localStyles.metaRowStacked,
                    ]}
                  >
                    <Text style={localStyles.helperLabel}>
                      {t("Characters: {{current}}/{{max}}", {
                        current: formattedPin.length,
                        max: PIN_LENGTH,
                      })}
                    </Text>
                    <Text
                      style={[
                        localStyles.helperAccent,
                        isCompact && localStyles.helperAccentStacked,
                      ]}
                    >
                      {t("Use A-Z and 0-9")}
                    </Text>
                  </View>

                  <View style={localStyles.progressTrack}>
                    <LinearGradient
                      colors={["#ff66c4", "#ffde59"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[
                        localStyles.progressFill,
                        { width: `${Math.max(6, progress * 100)}%` },
                      ]}
                    />
                  </View>

                  <MotionPressable
                    activeOpacity={0.9}
                    onPress={handleJoinGame}
                    disabled={isChecking}
                    style={[
                      localStyles.primaryButton,
                      isChecking ? localStyles.primaryButtonDisabled : null,
                    ]}
                  >
                    <LinearGradient
                      colors={["#ff66c4", "#ffde59"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={localStyles.primaryButtonGradient}
                    >
                      <Text style={localStyles.primaryButtonText}>
                        {isChecking ? t("Checking...") : t("Join Game")}
                      </Text>
                      <Ionicons
                        name={
                          isChecking
                            ? "refresh-circle"
                            : "arrow-forward-circle"
                        }
                        size={26}
                        color="#ffffff"
                      />
                    </LinearGradient>
                  </MotionPressable>

                  <MotionPressable
                    style={localStyles.secondaryButton}
                    onPress={handleGoBack}
                  >
                    <Ionicons
                      name="arrow-back"
                      size={20}
                      color="#c2724e"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={localStyles.secondaryButtonText}>
                      {t("Back to game options")}
                    </Text>
                  </MotionPressable>

                  <View style={localStyles.hintBox}>
                    <Ionicons
                      name="bulb-outline"
                      size={18}
                      color="#ff66c4"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={localStyles.hintBoxText}>
                      {t("If the code fails, double-check for typos.")}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  decorativeLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  blobLarge: {
    position: "absolute",
    top: -140,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 240,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    transform: [{ rotate: "16deg" }],
  },
  blobSmall: {
    position: "absolute",
    bottom: 120,
    left: -70,
    width: 200,
    height: 200,
    borderRadius: 200,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    transform: [{ rotate: "-14deg" }],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  scrollInner: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    alignItems: "center",
  },
  logo: {
    height: 110,
    width: 220,
    resizeMode: "contain",
    marginBottom: 16,
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
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  cardHeader: {
    marginBottom: 20,
  },
  cardBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 145, 77, 0.14)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  cardBadgeText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: "600",
    color: "#c2724e",
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2d102a",
  },
  cardCopy: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: "#6b3a45",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 145, 77, 0.32)",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
  },
  inputWrapperError: {
    borderColor: "rgba(239, 68, 68, 0.7)",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#2d102a",
    paddingVertical: 16,
    letterSpacing: 4,
  },
  metaRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  metaRowStacked: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  helperLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#c2724e",
    flexShrink: 0,
  },
  helperAccent: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ff66c4",
    marginLeft: 12,
    flex: 1,
    minWidth: 0,
    textAlign: "right",
  },
  helperAccentStacked: {
    marginLeft: 0,
    marginTop: 6,
    width: "100%",
    textAlign: "left",
  },
  progressTrack: {
    marginTop: 18,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(144, 106, 254, 0.15)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  primaryButton: {
    marginTop: 24,
    borderRadius: 18,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonGradient: {
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
  },
  secondaryButton: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255, 145, 77, 0.12)",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#c2724e",
  },
  hintBox: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(144, 106, 254, 0.08)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  hintBoxText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: "#5C4F84",
  },
});


