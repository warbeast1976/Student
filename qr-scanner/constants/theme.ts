/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0C1222',
    background: '#F3F6F8',
    surface: '#FFFFFF',
    surfaceMuted: '#EEF2F6',
    border: '#DCE3EB',
    muted: '#5C6B7F',
    tint: '#0D9488',
    tintMuted: 'rgba(13, 148, 136, 0.14)',
    danger: '#DC2626',
    icon: '#64748B',
    tabIconDefault: '#64748B',
    tabIconSelected: '#0D9488',
  },
  dark: {
    text: '#F1F5F9',
    background: '#070B12',
    surface: '#121A22',
    surfaceMuted: '#1A242F',
    border: '#2A3544',
    muted: '#8B9AAD',
    tint: '#2DD4BF',
    tintMuted: 'rgba(45, 212, 191, 0.18)',
    danger: '#F87171',
    icon: '#94A3B8',
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#5EEAD4',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
