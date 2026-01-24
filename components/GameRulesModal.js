import React from "react";
import { Modal, View, StyleSheet, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GameRules from "./GameRules";

export default function GameRulesModal({ visible, onClose }) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const safeHeight = Math.max(
    0,
    height - (insets?.top || 0) - (insets?.bottom || 0),
  );
  const modalMaxHeight = Math.max(0, safeHeight - 24);
  const modalHorizontalPadding = Math.max(
    14,
    Math.min(22, Math.round(width * 0.05)),
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.modalBackdrop,
          { paddingHorizontal: modalHorizontalPadding },
        ]}
      >
        <LinearGradient
          colors={["rgba(255, 118, 182, 0.45)", "rgba(120, 64, 255, 0.45)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.modalBackdropGradient}
          pointerEvents="none"
        />
        <View style={[styles.modalPanel, { maxHeight: modalMaxHeight }]}>
          <GameRules onClose={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(26, 6, 24, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackdropGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  modalPanel: {
    width: "100%",
    maxWidth: 640,
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
