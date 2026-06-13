import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | 'eyebrow' | 'metric' | 'bodySm';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        type === 'eyebrow' ? styles.eyebrow : undefined,
        type === 'metric' ? styles.metric : undefined,
        type === 'bodySm' ? styles.bodySm : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 15,
    lineHeight: 23,
  },
  defaultSemiBold: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '600',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.7,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  link: {
    lineHeight: 24,
    fontSize: 15,
    color: '#0D9488',
    fontWeight: '600',
  },
  eyebrow: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  metric: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  bodySm: {
    fontSize: 13,
    lineHeight: 19,
  },
});
