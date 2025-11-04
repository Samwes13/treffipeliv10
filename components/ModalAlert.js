import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import styles from "../styles";
import { LinearGradient } from "expo-linear-gradient";

export default function ModalAlert({
  visible,
  title,
  message,
  onClose,
  buttons,
  variant = "info",
}) {
  const palette = {
    info: ["#5170ff", "#ff66c4"],
    error: ["#ef4444", "#f97316"],
    success: ["#22c55e", "#86efac"],
    warn: ["#f59e0b", "#f97316"],
  };
  const headerColors = palette[variant] || palette.info;

  const renderButtons = () => {
    const btns =
      Array.isArray(buttons) && buttons.length
        ? buttons
        : [{ text: "OK", onPress: onClose }];
    return (
      <View style={ca.actions}>
        {btns.map((b, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.modalButton, ca.button]}
            onPress={() => {
              try {
                b.onPress && b.onPress();
              } finally {
                onClose && onClose();
              }
            }}
          >
            <Text style={styles.modalButtonText}>{b.text || "OK"}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackground}>
        <View style={ca.card}>
          <LinearGradient
            colors={headerColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={ca.header}
          >
            <Text style={ca.headerTitle}>{title || "Notice"}</Text>
          </LinearGradient>
          {!!message && <Text style={ca.bodyText}>{message}</Text>}
          {renderButtons()}
        </View>
      </View>
    </Modal>
  );
}

const ca = StyleSheet.create({
  card: {
    width: "86%",
    maxWidth: 420,
    borderRadius: 16,
    backgroundColor: "#fff",
    overflow: "hidden",
    paddingBottom: 12,
    alignItems: "stretch",
  },
  header: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  bodyText: {
    color: "#333",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    paddingHorizontal: 16,
    marginTop: 10,
  },
  actions: {
    marginTop: 10,
    paddingHorizontal: 16,
  },
  button: {
    marginTop: 8,
  },
});
