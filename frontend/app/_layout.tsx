import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text, TextInput, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { useTheme } from '../src/theme/useTheme';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { initializeApi } from '../src/services/api';
import { useThemeStore } from '../src/store/themeStore';
import { AlertProvider } from '../src/components/ui/AlertProvider';

// ─── Poppins Weight Map ──────────────────────────────────────────────────────────

const fontMap: Record<string, string> = {
  '100': 'Poppins_400Regular',
  '200': 'Poppins_400Regular',
  '300': 'Poppins_400Regular',
  '400': 'Poppins_400Regular',
  'normal': 'Poppins_400Regular',
  '500': 'Poppins_500Medium',
  'medium': 'Poppins_500Medium',
  '600': 'Poppins_600SemiBold',
  'semibold': 'Poppins_600SemiBold',
  '700': 'Poppins_700Bold',
  'bold': 'Poppins_700Bold',
  '800': 'Poppins_700Bold',
  '900': 'Poppins_700Bold',
};

// ─── Global Font Patching ────────────────────────────────────────────────────────
// Disabled for React Native Web compatibility
// Font patching causes CSS style issues on web platform

// let isPatched = false;
// const patchTypography = () => {
//   if (isPatched) return;
//   isPatched = true;
//
//   const patchComponent = (Component: any) => {
//     const oldRender = Component.render || Component.prototype?.render;
//     if (!oldRender) return;
//
//     const newRender = function (this: any, ...args: any[]) {
//       const origin = oldRender.call(this, ...args);
//       if (origin && origin.props) {
//         const style = StyleSheet.flatten(origin.props.style || {});
//         const fontWeight = String(style.fontWeight || 'normal');
//         const fontFamily = fontMap[fontWeight] || 'Poppins_400Regular';
//
//         return React.cloneElement(origin, {
//           style: [
//             style,
//             {
//              fontFamily,
//              fontWeight: undefined,
//            },
//          ],
//        });
//      }
//      return origin;
//    };
//
//    if (Component.render) {
//      Component.render = newRender;
//    } else if (Component.prototype?.render) {
//      Component.prototype.render = newRender;
//    }
//  };
//
//  patchComponent(Text);
//  patchComponent(TextInput);
// };

// Apply patches immediately on load (disabled on web)
// patchTypography();

// ─── Root Layout Component ───────────────────────────────────────────────────────

export default function RootLayout() {
  const { colors, isDark } = useTheme();

  // Load the Poppins google fonts
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  // Initialization state
  const [isReady, setIsReady] = useState<boolean>(false);

  useEffect(() => {
    Promise.all([
      initializeApi(),
      useThemeStore.getState().loadSavedTheme(),
    ]).then(() => {
      setIsReady(true);
    });
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (document.body) {
        document.body.style.backgroundColor = colors.background;
        document.body.style.color = colors.text;
      }
      if (document.documentElement) {
        document.documentElement.style.backgroundColor = colors.background;
      }
      const rootEl = document.getElementById('root');
      if (rootEl) {
        rootEl.style.backgroundColor = colors.background;
      }
    }
  }, [colors.background, colors.text]);

  // Show spinner while fonts + initialization load
  if (!fontsLoaded || !isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AlertProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
          }}
        />
      </AlertProvider>
    </View>
  );
}
