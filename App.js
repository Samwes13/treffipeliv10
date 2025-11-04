import React, { useEffect } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";

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

export default function App() {
  const Stack = createNativeStackNavigator();
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
        const { default: mobileAds } = await loadGoogleMobileAds();
        await mobileAds().initialize();
      } catch (e) {
        console.log("Ads init skipped:", e?.message || String(e));
      }
    })();
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer linking={linking} theme={navTheme}>
        <StatusBar translucent backgroundColor="transparent" style="light" />
        <Stack.Navigator
          initialRouteName="EnterUsername"
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
  );
}
