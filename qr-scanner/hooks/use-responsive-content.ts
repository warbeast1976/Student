import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

const MAX_CONTENT_WIDTH = 520;

/**
 * Wider phones / tablets: constrain readable width and soften horizontal padding.
 */
export function useResponsiveContent() {
  const { width } = useWindowDimensions();

  return useMemo(() => {
    const horizontalPadding = Math.max(16, Math.min(24, Math.round(width * 0.045)));
    const contentWidth = Math.min(width - horizontalPadding * 2, MAX_CONTENT_WIDTH);
    return {
      horizontalPadding,
      contentWidth,
      /** Center a column on wide screens */
      contentShell: {
        alignSelf: 'center' as const,
        width: '100%' as const,
        maxWidth: MAX_CONTENT_WIDTH,
      },
    };
  }, [width]);
}
