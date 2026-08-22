import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { BorderRadius, FontSize, FontWeight, Spacing } from '../../theme/tokens';

interface SecurityCardProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  badge?: string;
  badgeColor?: string;
}

export default function SecurityCard({
  title,
  subtitle,
  icon,
  children,
  style,
  badge,
  badgeColor,
}: SecurityCardProps) {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: BorderRadius.xl,
          padding: Spacing.xl,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: isDark ? '#000000' : colors.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.4 : 0.08,
          shadowRadius: 10,
          elevation: isDark ? 4 : 2,
        },
        style,
      ]}
    >
      {(title || icon || badge) && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: subtitle || children ? Spacing.md : 0,
          }}
        >
          {icon && <View style={{ marginRight: Spacing.md }}>{icon}</View>}
          <View style={{ flex: 1 }}>
            {title && (
              <Text
                style={{
                  fontSize: FontSize.md,
                  fontWeight: FontWeight.semibold,
                  color: colors.text,
                }}
              >
                {title}
              </Text>
            )}
            {subtitle && (
              <Text
                style={{
                  fontSize: FontSize.sm,
                  color: colors.textSecondary,
                  marginTop: 2,
                }}
              >
                {subtitle}
              </Text>
            )}
          </View>
          {badge && (
            <View
              style={{
                backgroundColor: badgeColor || colors.primary,
                paddingHorizontal: Spacing.sm + 2,
                paddingVertical: Spacing.xs,
                borderRadius: BorderRadius.full,
              }}
            >
              <Text
                style={{
                  fontSize: FontSize.xs,
                  fontWeight: FontWeight.medium,
                  color: '#FFFFFF',
                }}
              >
                {badge}
              </Text>
            </View>
          )}
        </View>
      )}
      {children}
    </View>
  );
}
