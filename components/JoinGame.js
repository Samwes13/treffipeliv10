import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Image,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ref, get, set, child } from "firebase/database";
import { database } from "../firebaseConfig";
import styles from "../styles";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import ModalAlert from "./ModalAlert";

const PIN_LENGTH = 6;

export default function JoinGame({ navigation, route }) {
  const rawUsername = route.params?.username ?? "";
  const username = rawUsername.trim() || rawUsername;

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
        title: "Username Missing",
        message:
          "Use the back button to choose a username before joining a game.",
        variant: "error",
      });
      navigation.navigate("EnterUsername");
      return false;
    }

    return true;
  };

  const handleJoinGame = async () => {
    if (!ensureUsername()) {
      return;
    }

    if (formattedPin.length !== PIN_LENGTH) {
      showAlert({
        title: "Check the Game Code",
        message: `Game codes must be ${PIN_LENGTH} characters long.`,
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
          title: "Game Code Not Found",
          message: "Make sure the code is correct and try again.",
          variant: "error",
        });
        return;
      }

      const playersRef = ref(
        database,
        `games/${formattedPin}/players/${username}`,
      );

      await set(playersRef, {
        username,
        traits: [],
        isHost: false,
      });

      navigation.navigate("CardTraits", { username, gamepin: formattedPin });
    } catch (error) {
      console.error("Error joining game", error);
      showAlert({
        title: "Join Failed",
        message: "Something went wrong. Please try again shortly.",
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
        colors={["#5170ff", "#ff66c4"]}
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
              <Image
                source={require("../assets/logoNew.png")}
                style={localStyles.logo}
              />

              <LinearGradient
                colors={["rgba(255,255,255,0.82)", "rgba(255,255,255,0.55)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={localStyles.cardGradient}
              >
                <View style={localStyles.card}>
                  <View style={localStyles.cardHeader}>
                    <View style={localStyles.cardBadge}>
                      <Ionicons name="lock-open-outline" size={18} color="#906AFE" />
                      <Text style={localStyles.cardBadgeText}>
                        Only the correct code unlocks entry
                      </Text>
                  </View>
                    <Text style={localStyles.cardTitle}>Game Code</Text>
                    <Text style={localStyles.cardCopy}>
                      Each code uses six letters or numbers.
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
                      color="#906AFE"
                      style={localStyles.inputIcon}
                    />
                    <TextInput
                      style={localStyles.input}
                      placeholder="ABCDE1"
                      value={formattedPin}
                      onChangeText={handleChangePin}
                      placeholderTextColor="rgba(32, 26, 64, 0.35)"
                      keyboardType="ascii-capable"
                      autoCorrect={false}
                      autoCapitalize="characters"
                      returnKeyType="go"
                      textContentType="oneTimeCode"
                      onSubmitEditing={handleJoinGame}
                    />
                  </View>

                  <View style={localStyles.metaRow}>
                    <Text style={localStyles.helperLabel}>
                      Characters: {formattedPin.length}/{PIN_LENGTH}
                    </Text>
                    <Text style={localStyles.helperAccent}>
                      Use A-Z and 0-9
                    </Text>
                  </View>

                  <View style={localStyles.progressTrack}>
                    <LinearGradient
                      colors={["#906AFE", "#ff66c4"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[
                        localStyles.progressFill,
                        { width: `${Math.max(6, progress * 100)}%` },
                      ]}
                    />
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={handleJoinGame}
                    disabled={isChecking}
                    style={[
                      localStyles.primaryButton,
                      isChecking ? localStyles.primaryButtonDisabled : null,
                    ]}
                  >
                    <LinearGradient
                      colors={["#906AFE", "#ff66c4"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={localStyles.primaryButtonGradient}
                    >
                      <Text style={localStyles.primaryButtonText}>
                        {isChecking ? "Checking…" : "Join Game"}
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
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={localStyles.secondaryButton}
                    onPress={handleGoBack}
                  >
                    <Ionicons
                      name="arrow-back"
                      size={20}
                      color="#6B5D92"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={localStyles.secondaryButtonText}>
                      Back to game options
                    </Text>
                  </TouchableOpacity>

                  <View style={localStyles.hintBox}>
                    <Ionicons
                      name="bulb-outline"
                      size={18}
                      color="#906AFE"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={localStyles.hintBoxText}>
                      If the code fails, double-check for typos.
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
    backgroundColor: "rgba(144, 106, 254, 0.14)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  cardBadgeText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: "600",
    color: "#6B5D92",
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#221641",
  },
  cardCopy: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: "#554876",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(144, 106, 254, 0.28)",
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
    color: "#221641",
    paddingVertical: 16,
    letterSpacing: 4,
  },
  metaRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  helperLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B5D92",
  },
  helperAccent: {
    fontSize: 14,
    fontWeight: "600",
    color: "#906AFE",
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
    backgroundColor: "rgba(144, 106, 254, 0.12)",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6B5D92",
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
