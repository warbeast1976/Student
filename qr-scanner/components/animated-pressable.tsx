import { Pressable, PressableProps, StyleSheet } from 'react-native';
import { Motion } from '@/constants/design';

type AnimatedPressableProps = PressableProps;

export function AnimatedPressable({ style, ...props }: AnimatedPressableProps) {
  const resolveStyle: NonNullable<PressableProps['style']> = (state) => {
    const baseStyle = typeof style === 'function' ? style(state) : style;
    return [baseStyle, state.pressed && styles.pressed];
  };

  return (
    <Pressable
      {...props}
      style={resolveStyle}
      android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
    />
  );
}

const styles = StyleSheet.create({
  pressed: {
    transform: [{ scale: Motion.pressScale }],
    opacity: 0.94,
  },
});
