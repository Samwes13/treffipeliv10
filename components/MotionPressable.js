import React, { useCallback, useRef } from "react";
import { Animated, TouchableOpacity } from "react-native";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function MotionPressable({
  style,
  children,
  activeScale = 0.96,
  pressInDuration = 120,
  pressOutDuration = 160,
  onPressIn,
  onPressOut,
  disabled,
  ...props
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(
    (event) => {
      if (!disabled) {
        Animated.timing(scale, {
          toValue: activeScale,
          duration: pressInDuration,
          useNativeDriver: true,
        }).start();
      }
      if (onPressIn) {
        onPressIn(event);
      }
    },
    [activeScale, disabled, onPressIn, pressInDuration, scale],
  );

  const handlePressOut = useCallback(
    (event) => {
      if (!disabled) {
        Animated.timing(scale, {
          toValue: 1,
          duration: pressOutDuration,
          useNativeDriver: true,
        }).start();
      }
      if (onPressOut) {
        onPressOut(event);
      }
    },
    [disabled, onPressOut, pressOutDuration, scale],
  );

  return (
    <AnimatedTouchable
      {...props}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedTouchable>
  );
}
