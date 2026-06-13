import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const ICONS = {
  scan: 'qrcode-scan',
  dashboard: 'view-dashboard-outline',
  profile: 'account-circle-outline',
  stats: 'chart-box-outline',
  bell: 'bell-outline',
  class: 'google-classroom',
  report: 'clipboard-text-outline',
  lightning: 'flash-outline',
} as const;

type AppIconName = keyof typeof ICONS;

export function AppIcon({ name, size = 20, color }: { name: AppIconName; size?: number; color: string }) {
  return <MaterialCommunityIcons name={ICONS[name]} size={size} color={color} />;
}
