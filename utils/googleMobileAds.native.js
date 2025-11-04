import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const canUseMobileAds = Platform.OS !== 'web' && Constants?.appOwnership !== 'expo';

export const loadGoogleMobileAds = async () => {
  if (!canUseMobileAds) {
    throw new Error('Google Mobile Ads SDK is not available in this environment.');
  }
  return import('react-native-google-mobile-ads');
};

