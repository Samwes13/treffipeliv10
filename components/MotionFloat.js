import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";

export default function MotionFloat({
  style,
  driftX = 6,
  driftY = -12,
  duration = 7000,
  delay = 0,
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration,
          delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [delay, duration, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, driftX],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, driftY],
  });

  return (
    <Animated.View style={{ transform: [{ translateX }, { translateY }] }}>
      <View style={style} />
    </Animated.View>
  );
}
