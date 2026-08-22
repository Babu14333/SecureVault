import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AlertTriangle } from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme';
import { useAuthStore } from '../../src/store/authStore';
import SecureButton from '../../src/components/ui/SecureButton';
import SecureInput from '../../src/components/ui/SecureInput';
import LoginOTPScreen from '../../src/components/ui/LoginOTPScreen';
import { Spacing, FontSize, FontWeight, BorderRadius } from '../../src/theme/tokens';
import { authAPI, webSafeSecureStore } from '../../src/services/api';

interface PendingOTP {
  userId: string;
  deviceId?: string;
  maskedEmail: string;
  reason: string;
}

export default function RegisterScreen() {
  const { colors } = useTheme();
  const { setAuth } = useAuthStore();
  const params = useLocalSearchParams();
  const registerAsAdmin = params.registerAsAdmin === 'true';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLocalLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string>('');
  const [pendingOTP, setPendingOTP] = useState<PendingOTP | null>(null);

  const validate = () => {
    setApiError('');
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!email.trim()) newErrors.email = 'Email address is required';
    else if (!/\S+@\S+\.\S+/.test(email.trim())) newErrors.email = 'Enter a valid email address';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 8) newErrors.password = 'Minimum 8 characters required';
    if (!confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
    else if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const showAlert = (title: string, message: string) => {
    setApiError(message);
    Alert.alert(title, message);
  };

  const completeLogin = async (data: any) => {
    await webSafeSecureStore.setItemAsync('accessToken', data.accessToken);
    await webSafeSecureStore.setItemAsync('refreshToken', data.refreshToken);
    await webSafeSecureStore.setItemAsync('sessionId', data.sessionId);
    setAuth({
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      sessionId: data.sessionId,
    });
    router.replace('/(tabs)/dashboard');
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLocalLoading(true);
    setApiError('');

    try {
      const response = await authAPI.register({
        email: email.trim(),
        password,
        fullName,
        role: registerAsAdmin ? 'admin' : 'user',
      });

      const { success, data, message } = response.data;
      if (success && data?.requiresOtp) {
        setPendingOTP({
          userId: data.userId || data.user?.id,
          maskedEmail: data.maskedEmail || email,
          reason: 'email_verification',
        });
      } else if (success) {
        // Direct fallback
        router.replace('/auth/login');
      } else {
        showAlert('Registration Failed', message || 'Could not complete registration');
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Connection failed. Please try again.';
      showAlert('Error', errorMsg);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleOTPVerify = async (
    otp: string,
    trustDevice: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    if (!pendingOTP) {
      return { success: false, error: 'Session lost. Please try registering again.' };
    }

    try {
      const res = await authAPI.verifyLoginOTP({
        userId: pendingOTP.userId,
        otpCode: otp,
        deviceId: pendingOTP.deviceId,
        trustDevice,
      });

      const { success, data, message } = res.data;

      if (success && data) {
        setPendingOTP(null);
        await completeLogin(data);
        return { success: true };
      }

      return { success: false, error: message || 'Verification failed.' };
    } catch (err: any) {
      const msg =
        err.response?.data?.message || 'Network error. Please try again.';
      return { success: false, error: msg };
    }
  };

  const handleOTPResend = async () => {
    if (!pendingOTP) return;
    await authAPI.resendOTP({
      userId: pendingOTP.userId,
      type: pendingOTP.reason || 'email_verification',
    });
  };

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: Spacing['3xl'],
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ width: '100%', maxWidth: 420 }}>
            {/* Header */}
            <View style={{ marginBottom: Spacing['3xl'], alignItems: 'center' }}>
              <Text
                style={{
                  fontSize: FontSize['3xl'],
                  fontWeight: FontWeight.bold,
                  color: colors.text,
                  letterSpacing: -0.5,
                  marginBottom: Spacing.xs,
                }}
              >
                Create account
              </Text>
              <Text
                style={{
                  fontSize: FontSize.md,
                  color: colors.textSecondary,
                  textAlign: 'center',
                }}
              >
                Build your personal zero-knowledge encrypted vault
              </Text>
              {email.trim().toLowerCase() === 'nagababuy92@gmail.com' && (
                <View
                  style={{
                    backgroundColor: colors.warningBg,
                    borderColor: `${colors.warning}40`,
                    borderWidth: 1,
                    borderRadius: BorderRadius.full,
                    paddingHorizontal: Spacing.md,
                    paddingVertical: Spacing.xs,
                    marginTop: Spacing.md,
                  }}
                >
                  <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.warning, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    🛡️ Designated Administrator Account
                  </Text>
                </View>
              )}
            </View>

            {/* Form Card */}
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: BorderRadius.xl,
                padding: Spacing['2xl'],
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 1,
                shadowRadius: 16,
                elevation: 3,
                marginBottom: Spacing.xl,
              }}
            >
              <SecureInput
                label="Full Name"
                placeholder="John Doe"
                value={fullName}
                onChangeText={setFullName}
                error={errors.fullName}
              />

              <SecureInput
                label="Email address"
                placeholder="name@company.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                error={errors.email}
              />

              <SecureInput
                label="Master Password"
                placeholder="Min. 8 characters"
                isPassword
                value={password}
                onChangeText={setPassword}
                error={errors.password}
              />

              <SecureInput
                label="Confirm Password"
                placeholder="Re-enter your password"
                isPassword
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                error={errors.confirmPassword}
              />

              {apiError ? (
                <View
                  style={{
                    backgroundColor: colors.dangerBg,
                    borderColor: `${colors.danger}35`,
                    borderWidth: 1,
                    borderRadius: BorderRadius.md,
                    padding: Spacing.md,
                    marginBottom: Spacing.lg,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: Spacing.sm,
                  }}
                >
                  <AlertTriangle size={18} color={colors.danger} />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: FontSize.sm,
                      color: colors.danger,
                      fontWeight: FontWeight.medium,
                    }}
                  >
                    {apiError}
                  </Text>
                </View>
              ) : null}

              <SecureButton
                title="Create Account"
                onPress={handleRegister}
                loading={loading}
                size="lg"
                style={{ marginTop: Spacing.sm }}
              />
            </View>

            {/* Login Link */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                marginTop: Spacing.lg,
              }}
            >
              <Text
                style={{
                  fontSize: FontSize.md,
                  color: colors.textSecondary,
                }}
              >
                Already have an account?{' '}
              </Text>
              <TouchableOpacity onPress={() => router.replace('/auth/login')}>
                <Text
                  style={{
                    fontSize: FontSize.md,
                    color: colors.primary,
                    fontWeight: FontWeight.semibold,
                  }}
                >
                  Sign In
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Dynamic Gmail OTP Verification Overlay right in Create Account */}
      {pendingOTP && (
        <LoginOTPScreen
          visible={!!pendingOTP}
          userId={pendingOTP.userId}
          deviceId={pendingOTP.deviceId}
          maskedEmail={pendingOTP.maskedEmail}
          reason={pendingOTP.reason}
          onVerify={handleOTPVerify}
          onResend={handleOTPResend}
          onDismiss={() => setPendingOTP(null)}
        />
      )}
    </>
  );
}
