import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { BorderRadius, FontSize, FontWeight, Spacing } from '../../theme/tokens';

interface SecureButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export default function SecureButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  fullWidth = true,
}: SecureButtonProps) {
  const { colors } = useTheme();

  const getButtonStyle = (): ViewStyle => {
    const base: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: BorderRadius.md,
      gap: Spacing.sm,
    };

    // Size
    switch (size) {
      case 'sm':
        base.paddingVertical = Spacing.sm;
        base.paddingHorizontal = Spacing.lg;
        break;
      case 'lg':
        base.paddingVertical = Spacing.lg;
        base.paddingHorizontal = Spacing['2xl'];
        break;
      default:
        base.paddingVertical = Spacing.md + 2;
        base.paddingHorizontal = Spacing.xl;
    }

    // Variant
    switch (variant) {
      case 'secondary':
        base.backgroundColor = colors.cardAlt;
        base.borderWidth = 1;
        base.borderColor = colors.border;
        break;
      case 'outline':
        base.backgroundColor = 'transparent';
        base.borderWidth = 1.5;
        base.borderColor = colors.border;
        break;
      case 'ghost':
        base.backgroundColor = 'transparent';
        break;
      case 'danger':
        base.backgroundColor = colors.danger;
        base.shadowColor = colors.danger;
        base.shadowOffset = { width: 0, height: 2 };
        base.shadowOpacity = 0.2;
        base.shadowRadius = 4;
        base.elevation = 2;
        break;
      default:
        base.backgroundColor = colors.primary;
        base.shadowColor = colors.primary;
        base.shadowOffset = { width: 0, height: 3 };
        base.shadowOpacity = 0.22;
        base.shadowRadius = 6;
        base.elevation = 3;
    }

    if (disabled || loading) {
      base.opacity = 0.5;
    }

    if (fullWidth) {
      base.width = '100%';
    }

    return base;
  };

  const getTextStyle = (): TextStyle => {
    const base: TextStyle = {
      fontWeight: FontWeight.semibold,
    };

    switch (size) {
      case 'sm':
        base.fontSize = FontSize.sm;
        break;
      case 'lg':
        base.fontSize = FontSize.lg;
        break;
      default:
        base.fontSize = FontSize.md;
    }

    switch (variant) {
      case 'secondary':
        base.color = colors.text;
        break;
      case 'outline':
      case 'ghost':
        base.color = colors.primary;
        break;
      default:
        base.color = '#FFFFFF';
    }

    return base;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[getButtonStyle(), style]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : colors.primary}
        />
      ) : (
        <>
          {icon}
          <Text style={[getTextStyle(), textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
