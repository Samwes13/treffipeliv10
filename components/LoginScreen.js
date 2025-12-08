import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  Platform,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import styles from "../styles";
import theme from "../utils/theme";
import { useLanguage } from "../contexts/LanguageContext";
import LanguageToggle from "./LanguageToggle";
import getLogoSource from "../utils/logo";
import { auth } from "../firebaseConfig";
import { signInAnonymously } from "firebase/auth";
import { useEffect } from "react";

export default function LoginScreen({ navigation }) {
  const { t, language } = useLanguage();
  const logoSource = getLogoSource(language);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      try {
        setIsLoading(true);
        setError("");
        await signInAnonymously(auth);
        if (isMounted) {
          navigation.replace("EnterUsername");
        }
      } catch (e) {
        console.warn("Anonymous sign-in failed", e);
        if (isMounted) {
          setError(t("Anonymous sign-in failed. Try again."));
          setIsLoading(false);
        }
      }
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [navigation, t]);

  const handleAnonymousLogin = async () => {
    try {
      setError("");
      setIsLoading(true);
      await signInAnonymously(auth);
      navigation.replace("EnterUsername");
    } catch (e) {
      console.warn("Anonymous sign-in failed", e);
      setError(t("Anonymous sign-in failed. Try again."));
    } finally {
      setIsLoading(false);
    }
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
          >
            <View style={localStyles.scrollInner}>
              <View style={localStyles.headerRow}>
                <LanguageToggle />
              </View>

              <Image source={logoSource} style={localStyles.logo} />

              <View style={localStyles.hero}>
                <Text style={localStyles.heroTitle}>
                  {t("Sign in to Treffipeli")}
                </Text>
                <Text style={localStyles.heroSubtitle}>
                  {t("Play without creating an account")}
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
                    <View style={localStyles.badge}>
                      <Ionicons
                        name="sparkles"
                        size={16}
                        color={theme.accentPrimary}
                      />
                      <Text style={localStyles.badgeText}>
                        {t("Fast entry")}
                      </Text>
                    </View>
                    <Text style={localStyles.cardTitle}>
                      {t("Play in seconds")}
                    </Text>
                    <Text style={localStyles.cardCopy}>
                      {t(
                        "Start a game instantly with anonymous login. You can set a username next.",
                      )}
                    </Text>
                  </View>

                  <View style={localStyles.statusContainer}>
                    <View style={localStyles.statusRow}>
                      <ActivityIndicator size="small" color={theme.accentPrimary} />
                      <Text style={localStyles.statusText}>
                        {isLoading
                          ? t("Signing in anonymously...")
                          : t("Finishing setup...")}
                      </Text>
                    </View>
                    {!!error && <Text style={localStyles.errorText}>{error}</Text>}
                  </View>
                </View>
              </LinearGradient>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 220,
    backgroundColor: theme.blobPrimary,
    transform: [{ rotate: "12deg" }],
  },
  blobSmall: {
    position: "absolute",
    bottom: 100,
    left: -60,
    width: 180,
    height: 180,
    borderRadius: 140,
    backgroundColor: theme.blobSecondary,
    transform: [{ rotate: "-18deg" }],
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
  headerRow: {
    width: "100%",
    alignItems: "flex-end",
    marginBottom: 16,
  },
  logo: {
    height: 120,
    width: 240,
    resizeMode: "contain",
    marginBottom: 10,
  },
  hero: {
    alignItems: "center",
    paddingHorizontal: 12,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#ffffff",
    textAlign: "center",
  },
  heroSubtitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 23,
    color: theme.heroSubtitle,
    textAlign: "center",
  },
  cardGradient: {
    width: "100%",
    borderRadius: 28,
    padding: 1.5,
    marginTop: 26,
    shadowColor: "#13093A",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.32,
    shadowRadius: 28,
    elevation: 12,
  },
  card: {
    borderRadius: 26,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    paddingVertical: 26,
    paddingHorizontal: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.45)",
  },
  cardHeader: {
    alignItems: "flex-start",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.badgeBackground,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: "flex-start",
  },
  badgeText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: "700",
    color: theme.badgeText,
  },
  cardTitle: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: "700",
    color: theme.bodyText,
  },
  cardCopy: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: theme.bodyMuted,
  },
  statusContainer: {
    marginTop: 18,
    alignItems: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    marginLeft: 10,
    fontSize: 15,
    fontWeight: "600",
    color: theme.metaLabel,
  },
  errorText: {
    marginTop: 8,
    fontSize: 13,
    color: "#d03050",
    textAlign: "center",
  },
});
