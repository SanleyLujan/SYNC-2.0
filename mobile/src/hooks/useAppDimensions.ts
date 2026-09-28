import { Platform, useWindowDimensions } from 'react-native';

export const APP_MAX_WIDTH = 480;

/** Match the centered app shell and recalculate on browser resize/rotation. */
export function useAppDimensions() {
  const dimensions = useWindowDimensions();
  return { ...dimensions, width: Platform.OS === 'web' ? Math.min(dimensions.width, APP_MAX_WIDTH) : dimensions.width };
}
