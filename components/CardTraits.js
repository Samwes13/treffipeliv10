import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  StyleSheet,
  findNodeHandle,
  UIManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ref, update, get, push, set } from "firebase/database";
import { database } from "../firebaseConfig";
import styles from "../styles";
import { LinearGradient } from "expo-linear-gradient";
import ModalAlert from "./ModalAlert";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../contexts/LanguageContext";
import { toUserKey } from "../utils/userKey";
import { usePlus } from "../contexts/PlusContext";

const TRAIT_COUNT = 6;
const TURN_ON_TRAITS_EN = [
  "Always brings snacks",
  "Plans surprise dates",
  "Remembers small details",
  "Laughs easily",
  "Keeps promises",
  "Great with pets",
  "Cooks new recipes",
  "Sends good morning texts",
  "Organises friend hangouts",
  "Punctual and prepared",
  "Spontaneous road-tripper",
  "Board game strategist",
  "Finds new coffee spots",
  "Up for karaoke nights",
  "Loves long walks",
  "Enjoys museums",
  "Great listener",
  "Shares playlists",
  "Good with money",
  "Takes initiative",
  "Keeps plants alive",
  "Asks thoughtful questions",
  "Adapts quickly",
  "Comfortable in silence",
  "Honest feedback giver",
  "Makes people feel welcome",
  "Active texter",
  "Learn-by-doing attitude",
  "Fixes small things at home",
  "Plans cozy nights in",
];

const TURN_OFF_TRAITS_EN = [
  "Leaves dishes in the sink",
  "Chronic phone scroller at dinner",
  "Always late",
  "Ghosts conversations",
  "Cancels last minute",
  "Forgets birthdays",
  "Talks over others",
  "Avoids tough talks",
  "Leaves mugs everywhere",
  "Hates planning ahead",
  "Scrolls during movies",
  "Overbooks every evening",
  "Perpetual alarm snoozer",
  "Never answers calls",
  "Brings work to dates",
  "Messy car",
  "Interrupts stories",
  "Changes plans often",
  "Talks only about self",
  "Leaves lights on",
  "Loud eater",
  "Ignores messages for days",
  "Always on speakerphone",
  "Forgets to lock doors",
  "Spends hours gaming",
  "Overshares online",
  "Leaves laundry out",
  "Hates trying new food",
  "Doesn't tip",
  "Snores loudly",
];

const TURN_ON_TRAITS_FI = [
  "Tuo aina snacksit",
  "Keksii yllätystreffejä",
  "Muistaa pienet yksityiskohdat",
  "Nauraa helposti",
  "Pitää lupaukset",
  "Hyvä lemmikkien kanssa",
  "Kokeilee uusia reseptejä",
  "Lähettää hyvän huomenen viestejä",
  "Järjestää kaveri-illat",
  "Täsmällinen ja valmis",
  "Lähtisi roadtripille heti",
  "Lautapelistrategi",
  "Löytää uudet kahvilat",
  "Aina valmis karaokeseen",
  "Rakastaa pitkiä kävelyjä",
  "Fiilistelee museoita",
  "Kuuntelee oikeasti",
  "Jakaa soittolistoja",
  "Taloudenpito hallussa",
  "Ottaa aloitetta",
  "Hoitaa kasvit hengissä",
  "Kysyy hyviä kysymyksiä",
  "Mukautuu nopeasti",
  "Mukava olla hiljaa yhdessä",
  "Antaa rehellistä palautetta",
  "Saa muut tuntemaan olonsa tervetulleeksi",
  "Vastaa viesteihin nopeasti",
  "Tekee mieluummin kuin puhuu",
  "Korjaa pieniä juttuja kotona",
  "Suunnittelee kotoisia iltoja",
];

const TURN_OFF_TRAITS_FI = [
  "Jättää astiat altaaseen",
  "Tuijottaa puhelinta ruokapöydässä",
  "On aina myöhässä",
  "Katoaa kesken keskustelun",
  "Peruu viime hetkellä",
  "Unohtaa synttärit",
  "Puhuu päälle",
  "Välttelee vaikeita juttuja",
  "Jättää mukit lojumaan",
  "Vihaa suunnittelua",
  "Selaa leffaa katsoessa",
  "Varaa kalenterin liian täyteen",
  "Torkuttaa herätyksiä",
  "Ei vastaa puheluihin",
  "Tuo töitä treffeille",
  "Sotkuinen auto",
  "Keskeyttää tarinat",
  "Muuttaa suunnitelmia jatkuvasti",
  "Puhuu vain itsestään",
  "Unohtaa valot päälle",
  "Syö kovaan ääneen",
  "Ei vastaa viesteihin päiviin",
  "Kaiutin päällä julkisesti",
  "Unohtaa lukita ovet",
  "Pelaa tuntikausia",
  "Jaa liikaa somessa",
  "Jättää pyykit viikoiksi",
  "Ei suostu kokeilemaan uusia ruokia",
  "Ei jätä tippiä",
  "Kuorsaa kovaa",
];

export default function CardTraits({ navigation, route }) {
  const { t, language } = useLanguage();
  const { username = "", gamepin = "" } = route.params || {};
  const { isPlus } = usePlus();
  const [traits, setTraits] = useState(Array(TRAIT_COUNT).fill(""));
  const [touchedInputs, setTouchedInputs] = useState({});
  const [alertState, setAlertState] = useState({
    visible: false,
    title: "",
    message: "",
    variant: "info",
  });
  const scrollRef = useRef(null);
  const inputWrapperRefs = useRef([]);

  const turnOnPool = language === "fi" ? TURN_ON_TRAITS_FI : TURN_ON_TRAITS_EN;
  const turnOffPool =
    language === "fi" ? TURN_OFF_TRAITS_FI : TURN_OFF_TRAITS_EN;

  const keySafeUsername = useMemo(() => toUserKey(username), [username]);

  const trimmedTraits = useMemo(
    () => traits.map((trait) => trait.trim()),
    [traits],
  );
  const lowerTraits = useMemo(
    () => trimmedTraits.map((trait) => trait.toLowerCase()),
    [trimmedTraits],
  );

  const duplicateEntries = useMemo(() => {
    const counts = {};
    lowerTraits.forEach((value) => {
      if (!value) {
        return;
      }
      counts[value] = (counts[value] || 0) + 1;
    });

    return new Set(
      Object.keys(counts).filter((key) => counts[key] > 1 && key.length > 0),
    );
  }, [lowerTraits]);

  const completedCount = useMemo(
    () => trimmedTraits.filter((trait) => trait.length > 0).length,
    [trimmedTraits],
  );

  const progress = completedCount / TRAIT_COUNT;
  const hasAllTraits = completedCount === TRAIT_COUNT;
  const hasDuplicates = duplicateEntries.size > 0;
  const duplicateErrorText = t("This trait is already on the list.");
  const missingFieldText = t("Please complete this field.");
  const completedLabel = t("Complete: {{current}}/{{total}}", {
    current: completedCount,
    total: TRAIT_COUNT,
  });
  const duplicateHint = t("Remove duplicate traits before continuing.");
  const finishedHint = t("All fields completed!");
  const remainingHint = t("Fill in the remaining fields.");

  const handleInputChange = (text, index) => {
    setTraits((current) => {
      const next = [...current];
      next[index] = text;
      return next;
    });
  };

  const handleAutoFill = () => {
    const pickRandom = (pool, count) => {
      const copy = [...pool];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy.slice(0, count);
    };

    const selectedOn = pickRandom(turnOnPool, 3);
    const selectedOff = pickRandom(turnOffPool, 3);
    setTraits([...selectedOn, ...selectedOff]);
    setTouchedInputs({});
  };

  useEffect(() => {
    let isMounted = true;
    const loadExistingTraits = async () => {
      if (!gamepin) {
        return;
      }
      try {
        const userTraitsRef = ref(
          database,
          `games/${gamepin}/traits/${keySafeUsername}`,
        );
        const snapshot = await get(userTraitsRef);
        if (!snapshot.exists()) {
          return;
        }
        const rawTraits = Object.values(snapshot.val() || {});
        const sorted = rawTraits
          .filter((item) => item && typeof item === "object")
          .sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
        const nextTraits = Array(TRAIT_COUNT).fill("");
        sorted.slice(0, TRAIT_COUNT).forEach((trait, index) => {
          if (trait?.text) {
            nextTraits[index] = trait.text;
          }
        });
        if (isMounted) {
          setTraits(nextTraits);
          setTouchedInputs({});
        }
      } catch (error) {
        console.error("Failed to load existing traits:", error);
      }
    };

    loadExistingTraits();
    return () => {
      isMounted = false;
    };
  }, [gamepin, keySafeUsername]);

  const getFieldState = (index) => {
    const trimmed = trimmedTraits[index];
    if (!trimmed) {
      return touchedInputs[index] ? "missing" : "pristine";
    }
    if (duplicateEntries.has(lowerTraits[index])) {
      return "duplicate";
    }
    return "ok";
  };

  const ensureScrollToField = (index) => {
    const scrollView = scrollRef.current;
    if (!scrollView) {
      return;
    }

    const fallback = () => {
      if (index >= 3) {
        setTimeout(() => {
          scrollView.scrollToEnd?.({ animated: true });
        }, 60);
      }
    };

    const wrapper = inputWrapperRefs.current[index];
    if (!wrapper) {
      fallback();
      return;
    }

    const wrapperHandle = findNodeHandle(wrapper);
    if (wrapperHandle == null) {
      fallback();
      return;
    }

    const innerView =
      typeof scrollView.getInnerViewNode === "function"
        ? scrollView.getInnerViewNode()
        : typeof scrollView.getScrollResponder === "function"
        ? scrollView.getScrollResponder()?.getScrollableNode?.()
        : scrollView;

    const innerHandle = findNodeHandle(innerView);

    if (innerHandle == null) {
      fallback();
      return;
    }

    UIManager.measureLayout(
      wrapperHandle,
      innerHandle,
      fallback,
      (_x, y) => {
        setTimeout(() => {
          scrollView.scrollTo?.({
            y: Math.max(0, y - 140),
            animated: true,
          });
        }, 60);
      },
    );
  };

  const markAllTouched = () => {
    setTouchedInputs((current) => {
      if (Object.keys(current).length === TRAIT_COUNT) {
        return current;
      }
      const next = {};
      for (let i = 0; i < TRAIT_COUNT; i += 1) {
        next[i] = true;
      }
      return next;
    });
  };

  const showAlert = (updates) =>
    setAlertState((prev) => ({
      ...prev,
      visible: true,
      ...updates,
    }));

  const saveTraits = async () => {
    if (!username) {
      showAlert({
        title: t("Username Missing"),
        message: t(
          "Use the back button to choose a username before saving your traits.",
        ),
        variant: "error",
      });
      navigation.navigate("EnterUsername");
      return;
    }

    if (!gamepin) {
      showAlert({
        title: t("Game Code Missing"),
        message: t(
          "Game code not found. Go back to the previous screen and try again.",
        ),
        variant: "error",
      });
      navigation.goBack();
      return;
    }

    if (!hasAllTraits || hasDuplicates) {
      markAllTouched();

      if (!hasAllTraits) {
        showAlert({
          title: t("Traits Missing"),
          message: t("Fill in all six fields before continuing."),
          variant: "error",
        });
        return;
      }

      showAlert({
        title: t("Duplicate Traits"),
        message: t("Each trait must appear only once."),
        variant: "error",
      });
      return;
    }

    try {
      const gameRef = ref(database, `games/${gamepin}`);
      const gameSnapshot = await get(gameRef);

      if (!gameSnapshot.exists()) {
        showAlert({
          title: t("Game Not Found"),
          message: t("Check the game code and try again."),
          variant: "error",
        });
        return;
      }

      const userTraitsRef = ref(
        database,
        `games/${gamepin}/traits/${keySafeUsername}`,
      );

      await set(userTraitsRef, null);

      const writes = trimmedTraits.map((text, index) => {
        const traitRef = push(userTraitsRef);
        const traitData = {
          traitId: traitRef.key,
          text,
          order: index,
        };
        return set(traitRef, traitData);
      });

      await Promise.all(writes);

      await update(
        ref(database, `games/${gamepin}/players/${keySafeUsername}`),
        {
          username,
          usernameKey: keySafeUsername,
          traitsCompleted: true,
        },
      );

      navigation.navigate("GameLobby", { gamepin, username });
    } catch (error) {
      console.error("Error saving traits:", error);
      showAlert({
        title: t("Saving Failed"),
        message: t("Something went wrong. Please try again shortly."),
        variant: "error",
      });
    }
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
          <View style={localStyles.blobLarge} />
          <View style={localStyles.blobSmall} />
        </View>

        <KeyboardAvoidingView
          style={localStyles.safeArea}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            ref={scrollRef}
            style={localStyles.scroll}
            contentContainerStyle={localStyles.scrollContent}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={false}
            keyboardDismissMode="on-drag"
          >
            <View style={localStyles.scrollInner}>
              <View style={localStyles.pinBadge}>
                <Ionicons name="pricetag-outline" size={22} color="#FFE5FF" />
                <Text style={localStyles.pinBadgeText}>
                  {t("Game Code {{code}}", { code: gamepin || t("unknown") })}
                </Text>
              </View>

              <LinearGradient
                colors={["rgba(255,255,255,0.82)", "rgba(255,255,255,0.58)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={localStyles.cardGradient}
              >
                <View style={localStyles.card}>
                  <View style={localStyles.cardHeader}>
                    <Text style={localStyles.cardTitle}>
                      {t("Trait Checklist")}
                    </Text>
                    <Text style={localStyles.cardCopy}>
                      {t(
                        "List personality traits, habits, or small details that stand out from the crowd.",
                      )}
                    </Text>
                    <View style={localStyles.quickActions}>
                  <TouchableOpacity
                    activeOpacity={0.92}
                    onPress={handleAutoFill}
                    style={[
                      localStyles.quickButton,
                      !isPlus && localStyles.quickButtonDisabled,
                    ]}
                    disabled={!isPlus}
                  >
                    <LinearGradient
                      colors={["#ff66c4", "#ffde59"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                          style={localStyles.quickButtonGradient}
                        >
                          <Ionicons
                            name="sparkles-outline"
                            size={20}
                            color="#ffffff"
                            style={localStyles.quickButtonIcon}
                          />
                          <Text style={localStyles.quickButtonText}>
                            {t("Auto-fill Traits")}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={localStyles.groupSection}>
                    <View style={localStyles.turnOnBox}>
                      <View style={localStyles.groupHeaderRow}>
                        <Ionicons
                          name="sunny-outline"
                          size={18}
                          color="#16a34a"
                          style={localStyles.groupIcon}
                        />
                        <Text style={localStyles.groupTitlePositive}>
                          {t("Turn On")}
                        </Text>
                      </View>
                      <Text style={localStyles.groupSubtitlePositive}>
                        {t("These three traits capture what excites or attracts you.")}
                      </Text>
                      {[0, 1, 2].map((index) => {
                        const state = getFieldState(index);
                        const showError =
                          state === "duplicate" ||
                          (state === "missing" && touchedInputs[index]);
                        const errorMessage =
                          state === "duplicate"
                            ? duplicateErrorText
                            : state === "missing"
                            ? missingFieldText
                            : null;
                        const accentColor = "#16a34a";
                        const trait = traits[index];
                        return (
                          <View key={index} style={localStyles.inputGroup}>
                            <View
                              ref={(node) => {
                                inputWrapperRefs.current[index] = node;
                              }}
                              style={[
                                localStyles.inputWrapper,
                                localStyles.inputWrapperPositive,
                                showError ? localStyles.inputWrapperError : null,
                              ]}
                            >
                              <Ionicons
                                name="sparkles-outline"
                                size={22}
                                color={showError ? "#b91c1c" : accentColor}
                                style={localStyles.inputIcon}
                              />
                              <TextInput
                                style={localStyles.input}
                                placeholder={t("Trait {{number}}", {
                                  number: index + 1,
                                })}
                                value={trait}
                                onChangeText={(text) =>
                                  handleInputChange(text, index)
                                }
                                placeholderTextColor="rgba(45, 16, 42, 0.4)"
                                returnKeyType="next"
                                onFocus={() => ensureScrollToField(index)}
                                onBlur={() =>
                                  setTouchedInputs((current) => ({
                                    ...current,
                                    [index]: true,
                                  }))
                                }
                              />
                            </View>
                            {errorMessage ? (
                              <Text style={localStyles.inputHelper}>
                                {errorMessage}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>

                    <View style={localStyles.turnOffBox}>
                      <View style={localStyles.groupHeaderRow}>
                        <Ionicons
                          name="moon-outline"
                          size={18}
                          color="#dc2626"
                          style={localStyles.groupIcon}
                        />
                        <Text style={localStyles.groupTitleNegative}>
                          {t("Turn Off")}
                        </Text>
                      </View>
                      <Text style={localStyles.groupSubtitleNegative}>
                        {t("List traits that do not suit you or that you want to avoid.")}
                      </Text>
                      {[3, 4, 5].map((index) => {
                        const state = getFieldState(index);
                        const showError =
                          state === "duplicate" ||
                          (state === "missing" && touchedInputs[index]);
                        const errorMessage =
                          state === "duplicate"
                            ? duplicateErrorText
                            : state === "missing"
                            ? missingFieldText
                            : null;
                        const accentColor = "#dc2626";
                        const trait = traits[index];
                        return (
                          <View key={index} style={localStyles.inputGroup}>
                            <View
                              ref={(node) => {
                                inputWrapperRefs.current[index] = node;
                              }}
                              style={[
                                localStyles.inputWrapper,
                                localStyles.inputWrapperNegative,
                                showError ? localStyles.inputWrapperError : null,
                              ]}
                            >
                              <Ionicons
                                name="sparkles-outline"
                                size={22}
                                color={showError ? "#b91c1c" : accentColor}
                                style={localStyles.inputIcon}
                              />
                              <TextInput
                                style={localStyles.input}
                                placeholder={t("Trait {{number}}", {
                                  number: index + 1,
                                })}
                                value={trait}
                                onChangeText={(text) =>
                                  handleInputChange(text, index)
                                }
                                placeholderTextColor="rgba(45, 16, 42, 0.4)"
                                returnKeyType={
                                  index === TRAIT_COUNT - 1 ? "done" : "next"
                                }
                                onFocus={() => ensureScrollToField(index)}
                                onBlur={() =>
                                  setTouchedInputs((current) => ({
                                    ...current,
                                    [index]: true,
                                  }))
                                }
                              />
                            </View>
                            {errorMessage ? (
                              <Text style={localStyles.inputHelper}>
                                {errorMessage}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                  <View style={localStyles.progressSection}>
                    <View style={localStyles.progressHeader}>
                      <Text style={localStyles.progressLabel}>
                        {completedLabel}
                      </Text>
                      <Text style={localStyles.progressHint}>
                        {hasDuplicates
                          ? duplicateHint
                          : hasAllTraits
                          ? finishedHint
                          : remainingHint}
                      </Text>
                    </View>
                    <View style={localStyles.progressTrack}>
                      <LinearGradient
                        colors={["#ff66c4", "#ffde59"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[
                          localStyles.progressFill,
                          { width: `${Math.max(8, progress * 100)}%` },
                        ]}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.92}
                    onPress={saveTraits}
                    style={localStyles.primaryButton}
                  >
                    <LinearGradient
                      colors={["#ff66c4", "#ffde59"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={localStyles.primaryButtonGradient}
                    >
                      <Text style={localStyles.primaryButtonText}>
                        {t("Continue to Lobby")}
                      </Text>
                      <Ionicons
                        name="arrow-forward-circle"
                        size={26}
                        color="#ffffff"
                      />
                    </LinearGradient>
                  </TouchableOpacity>

                  <View style={localStyles.helperBox}>
                    <Ionicons
                      name="bulb-outline"
                      size={18}
                      color="#ff66c4"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={localStyles.helperBoxText}>
                      {t(
                        'Use short words or phrases such as "adventurous", "coffee addict", or "game night hero".',
                      )}
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
    top: -160,
    left: -110,
    width: 260,
    height: 260,
    borderRadius: 260,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    transform: [{ rotate: "-16deg" }],
  },
  blobSmall: {
    position: "absolute",
    bottom: 140,
    right: -90,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    transform: [{ rotate: "18deg" }],
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
    maxWidth: 520,
    alignSelf: "center",
    alignItems: "center",
  },
  pinBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 26,
    marginBottom: 20,
  },
  pinBadgeText: {
    marginLeft: 10,
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.8,
  },
  hero: {
    alignItems: "center",
    paddingHorizontal: 12,
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
    color: "rgba(255, 255, 255, 0.82)",
  },
  cardGradient: {
    width: "100%",
    borderRadius: 30,
    padding: 1.6,
    marginTop: 26,
    shadowColor: "#11022C",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.32,
    shadowRadius: 28,
    elevation: 12,
  },
  card: {
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  cardHeader: {
    marginBottom: 24,
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
  groupSection: {
    width: "100%",
  },
  turnOnBox: {
    width: "100%",
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.28)",
    backgroundColor: "rgba(187, 247, 208, 0.35)",
    marginBottom: 24,
  },
  turnOffBox: {
    width: "100%",
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.28)",
    backgroundColor: "rgba(254, 202, 202, 0.35)",
  },
  groupHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  groupIcon: {
    marginRight: 10,
  },
  groupTitlePositive: {
    fontSize: 19,
    fontWeight: "700",
    color: "#065f46",
  },
  groupTitleNegative: {
    fontSize: 19,
    fontWeight: "700",
    color: "#7f1d1d",
  },
  groupSubtitlePositive: {
    marginBottom: 18,
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(6, 95, 70, 0.75)",
  },
  groupSubtitleNegative: {
    marginBottom: 18,
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(127, 29, 29, 0.75)",
  },
  inputGroup: {
    marginBottom: 16,
    width: "100%",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 145, 77, 0.32)",
    backgroundColor: "#ffffff",
    paddingHorizontal: 18,
  },
  inputWrapperPositive: {
    borderColor: "rgba(34, 197, 94, 0.35)",
    backgroundColor: "#ffffff",
  },
  inputWrapperNegative: {
    borderColor: "rgba(239, 68, 68, 0.35)",
    backgroundColor: "#ffffff",
  },
  inputWrapperError: {
    borderColor: "rgba(239, 68, 68, 0.75)",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: "#2d102a",
    paddingVertical: 16,
  },
  inputHelper: {
    marginTop: 6,
    fontSize: 13,
    color: "#b91c1c",
  },
  progressSection: {
    marginTop: 12,
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#5C4F84",
  },
  progressHint: {
    fontSize: 13,
    color: "#70619C",
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255, 145, 77, 0.18)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  quickActions: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  quickButton: {
    borderRadius: 999,
    marginRight: 10,
    marginBottom: 10,
    shadowColor: "#13093A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  quickButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  quickButtonDisabled: {
    opacity: 0.5,
  },
  quickButtonIcon: {
    marginRight: 8,
  },
  quickButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  primaryButton: {
    borderRadius: 20,
    marginTop: 12,
  },
  primaryButtonGradient: {
    borderRadius: 20,
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
  helperBox: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(144, 106, 254, 0.1)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  helperBoxText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: "#5C4F84",
  },
});


