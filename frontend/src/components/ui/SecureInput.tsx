import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '../../theme/useTheme';
import { BorderRadius, FontSize, FontWeight, Spacing } from '../../theme/tokens';

interface SecureInputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
}

export default function SecureInput({
  label,
  error,
  icon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  secureTextEntry,
  isPassword,
  ...props
}: SecureInputProps) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Auto-detect password field if isPassword prop is true or secureTextEntry prop is passed
  const isPasswordField = isPassword || secureTextEntry !== undefined;
  const isCurrentlySecure = isPasswordField ? !showPassword : secureTextEntry;

  return (
    <View style={[{ marginBottom: Spacing.lg }, containerStyle]}>
      {label && (
        <Text
          style={{
            fontSize: FontSize.sm,
            fontWeight: FontWeight.medium,
            color: colors.textSecondary,
            marginBottom: Spacing.sm,
          }}
        >
          {label}
        </Text>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.inputBg,
          borderRadius: BorderRadius.md,
          borderWidth: 1.5,
          borderColor: error
            ? colors.danger
            : isFocused
            ? colors.primary
            : colors.border,
          paddingHorizontal: Spacing.lg,
          height: 52,
        }}
      >
        {icon && <View style={{ marginRight: Spacing.md }}>{icon}</View>}
        <TextInput
          style={{
            flex: 1,
            fontSize: FontSize.md,
            color: colors.text,
            height: '100%',
          }}
          placeholderTextColor={colors.textTertiary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isCurrentlySecure}
          {...props}
        />
        {isPasswordField ? (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={{ padding: Spacing.xs, marginLeft: Spacing.xs }}
            activeOpacity={0.7}
          >
            {showPassword ? (
              <EyeOff size={20} color={colors.primary} />
            ) : (
              <Eye size={20} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
        ) : (
          rightIcon && (
            <TouchableOpacity
              onPress={onRightIconPress}
              style={{ marginLeft: Spacing.sm }}
            >
              {rightIcon}
            </TouchableOpacity>
          )
        )}
      </View>
      {error && (
        <Text
          style={{
            fontSize: FontSize.xs,
            color: colors.danger,
            marginTop: Spacing.xs,
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
