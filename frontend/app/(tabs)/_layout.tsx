import React from 'react';
import { Tabs } from 'expo-router';
import { View, Platform } from 'react-native';
import { useTheme } from '../../src/theme/useTheme';
import { useAuthStore } from '../../src/store/authStore';
import { 
  LayoutDashboard, 
  FolderLock, 
  Plus, 
  ShieldCheck, 
  Settings as SettingsIcon,
  Shield
} from 'lucide-react-native';

function TabIcon({ name, focused, color }: { name: string; focused: boolean; color: any }) {
  const { colors } = useTheme();

  if (name === 'Upload') {
    return (
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          position: 'absolute',
          top: Platform.OS === 'ios' ? -18 : -22,
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.45,
          shadowRadius: 10,
          elevation: 7,
          borderWidth: 4,
          borderColor: colors.tabBar,
        }}
      >
        <Plus size={28} color="#FFFFFF" strokeWidth={3} />
      </View>
    );
  }

  const IconComponent = (() => {
    switch (name) {
      case 'Dashboard':
        return LayoutDashboard;
      case 'AdminSOC':
        return Shield;
      case 'Vault':
        return FolderLock;
      case 'Security':
        return ShieldCheck;
      case 'Settings':
        return SettingsIcon;
      default:
        return FolderLock;
    }
  })();

  return (
    <View
      style={{
        width: 44,
        height: 34,
        borderRadius: 10,
        backgroundColor: focused ? colors.primaryBg : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <IconComponent size={21} color={focused ? colors.primary : color} strokeWidth={focused ? 2.4 : 1.8} />
    </View>
  );
}

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const { user } = useAuthStore();

  const isAdmin = user?.role === 'admin' || user?.email?.toLowerCase() === 'nagababuy92@gmail.com';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 92 : 72,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
          elevation: 6,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.3 : 0.6,
          shadowRadius: 12,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: isAdmin ? 'SOC Portal' : 'Dashboard',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={isAdmin ? 'AdminSOC' : 'Dashboard'} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          title: 'Vault',
          href: isAdmin ? null : undefined,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="Vault" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: '',
          href: isAdmin ? null : undefined,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="Upload" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="security"
        options={{
          title: 'Security',
          href: isAdmin ? null : undefined,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="Security" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="Settings" focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
