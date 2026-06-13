import { useEffect } from 'react';
import { type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type SkeletonProps = {
  height?: number;
  width?: number | `${number}%`;
  borderRadius?: number;
  style?: ViewStyle;
};

export function Skeleton({ height = 16, width = '100%', borderRadius = 10, style }: SkeletonProps) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, {
        duration: 700,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          height,
          width,
          borderRadius,
          backgroundColor: '#DCE3EB',
        },
        animatedStyle,
        style,
      ]}
    />
  );
}
