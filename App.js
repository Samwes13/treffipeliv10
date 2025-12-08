import React, { useEffect, useState } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import { signInAnonymously } from "firebase/auth";
import { ref, get } from "firebase/database";
import Purchases, { LOG_LEVEL } from "react-native-purchases";

import styles from "./styles"; // Oletetaan, ett� style.js sijaitsee samassa hakemistossa
import { canUseMobileAds, loadGoogleMobileAds } from "./utils/googleMobileAds";
import EnterUsername from "./components/EnterUsername";
import GameOptionScreen from "./components/GameOptionScreen";
import CardTraits from "./components/CardTraits";
import GameLobby from "./components/GameLobby";
import JoinGame from "./components/JoinGame";
import GamePlay from "./components/GamePlay";
import GameEnd from "./components/GameEnd";
import DebugSimulate from "./components/DebugSimulate";
import { LanguageProvider } from "./contexts/LanguageContext";
import { PlusProvider } from "./contexts/PlusContext";
import { auth, database } from "./firebaseConfig";
import { loadSession, clearSession } from "./utils/session";

export default function App() {
  const Stack = createNativeStackNavigator();
  const [initialRoute, setInitialRoute] = useState("EnterUsername");
  const [initialParams, setInitialParams] = useState({});
  const [bootReady, setBootReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    ...(Platform.OS === "web"
      ? { Ionicons: require("./assets/fonts/Ionicons.ttf") }
      : Ionicons.font),
  });
  useEffect(() => {
    if (fontError) {
      console.error("Failed to load icon fonts:", fontError);
    }
  }, [fontError]);

  useEffect(() => {
    if (auth?.currentUser) {
      return;
    }
    signInAnonymously(auth).catch((e) => {
      console.warn("Anonymous sign-in failed", e);
    });
  }, []);

  useEffect(() => {
    try {
      Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
      const iosApiKey = "test_rOjhwkjMntqOlzZkayPdJHObzOY";
      const androidApiKey = "test_rOjhwkjMntqOlzZkayPdJHObzOY";
      if (Platform.OS === "ios") {
        Purchases.configure({ apiKey: iosApiKey });
      } else if (Platform.OS === "android") {
        Purchases.configure({ apiKey: androidApiKey });
      }
    } catch (error) {
      console.warn("RevenueCat configure failed:", error?.message || error);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const session = await loadSession();
        if (!session?.username || !session?.gamepin) {
          setInitialRoute("EnterUsername");
          setInitialParams({});
          return;
        }

        const gameRef = ref(database, `games/${session.gamepin}`);
        const snap = await get(gameRef);
        if (!snap.exists()) {
          await clearSession();
          setInitialRoute("GameOptionScreen");
          setInitialParams({ username: session.username });
          return;
        }

        const game = snap.val() || {};
        const players = game.players || {};
        const keyCandidate = session.username.replace(/[.#$/\[\]]/g, "_");
        const player =
          players[session.username] ||
          players[keyCandidate] ||
          Object.values(players).find(
            (p) => (p?.username || "").trim() === session.username,
          );
        const round = Number(game.currentRound || 0);
        const gameEnded = round > 6 || game.isGameEnded;
        const playerLeft = !player || player.status === "left";

        if (gameEnded || playerLeft) {
          await clearSession();
          setInitialRoute("GameOptionScreen");
          setInitialParams({ username: session.username });
          return;
        }

        const routeName = game.isGameStarted ? "GamePlay" : "GameLobby";
        setInitialRoute(routeName);
        setInitialParams({
          username: session.username,
          gamepin: session.gamepin,
        });
      } catch (error) {
        console.warn("Session restore failed", error?.message || error);
        setInitialRoute("EnterUsername");
        setInitialParams({});
      } finally {
        setBootReady(true);
      }
    })();
  }, []);


  //Määritä linking_objekti
  const linking = {
    prefixes: ["https://treffipeli.fi", "treffipeli://"],
    config: {
      screens: {
        EnterUsername: "enterusername",
        GameOptionScreen: "gameoptionscreen",
        GameLobby: "GameLobby",
        JoinGame: "JoinGame",
        CardTraits: "CardTraits",
        GamePlay: "GamePlay",
        GameEnd: "GameEnd",
        DebugSimulate: "DebugSimulate",
      },
    },
  };

  // Make navigator/content backgrounds transparent so our gradients fill 100%
  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: "transparent",
    },
  };

  // Initialize Google Mobile Ads SDK (skip in Expo Go / Web)
  useEffect(() => {
    (async () => {
      if (!canUseMobileAds) {
        console.log("Ads init skipped: running in Expo Go or Web");
        return;
      }
      try {
        const adsModule = await loadGoogleMobileAds();
        const mobileAdsInstance =
          typeof adsModule.default === "function"
            ? adsModule.default()
            : adsModule.mobileAds();
        mobileAdsInstance.setRequestConfiguration({
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
          maxAdContentRating: "PG",
        });
        await mobileAdsInstance.initialize();
      } catch (e) {
        console.log("Ads init skipped:", e?.message || String(e));
      }
    })();
  }, []);

  if ((!fontsLoaded && !fontError) || !bootReady) {
    return null;
  }

  return (
    <PlusProvider>
      <LanguageProvider>
        <SafeAreaProvider>
          <NavigationContainer linking={linking} theme={navTheme}>
            <StatusBar translucent backgroundColor="transparent" style="light" />
            <Stack.Navigator
              initialRouteName={initialRoute}
              screenOptions={{ contentStyle: { backgroundColor: "transparent" } }}
            >
              <Stack.Screen
                name="EnterUsername"
                component={EnterUsername}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="GameOptionScreen"
                component={GameOptionScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="GameLobby"
                component={GameLobby}
                options={{ headerShown: false }}
                initialParams={initialRoute === "GameLobby" ? initialParams : undefined}
              />
              <Stack.Screen
                name="JoinGame"
                component={JoinGame}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="CardTraits"
                component={CardTraits}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="GamePlay"
                component={GamePlay}
                options={{ headerShown: false }}
                initialParams={initialRoute === "GamePlay" ? initialParams : undefined}
              />
              <Stack.Screen
                name="GameEnd"
                component={GameEnd}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="DebugSimulate"
                component={DebugSimulate}
                options={{ headerShown: false }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </SafeAreaProvider>
      </LanguageProvider>
    </PlusProvider>
  );
}
