import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface SkeletonLoaderProps {
  lines?: number;
  style?: any;
}

export function SkeletonLoader({ lines = 3, style }: SkeletonLoaderProps) {
  const { colors } = useTheme();

  return (
    <View style={[{ gap: 12 }, style]}>
      {Array.from({ length: lines }).map((_, i) => (
        <View
          key={i}
          style={{
            height: 16,
            backgroundColor: colors.cardAlt,
            borderRadius: 8,
            width: i === lines - 1 ? '60%' : '100%',
          }}
        />
      ))}
    </View>
  );
}

export function LoadingScreen() {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      }}
    >
      {icon && <View style={{ marginBottom: 16 }}>{icon}</View>}
      <Text
        style={{
          fontSize: 17,
          fontWeight: '600',
          color: colors.text,
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          style={{
            fontSize: 14,
            color: colors.textSecondary,
            textAlign: 'center',
            lineHeight: 20,
          }}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
}
