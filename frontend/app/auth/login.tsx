import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
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

export default function LoginScreen() {
  const { colors } = useTheme();
  const { setAuth } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [apiError, setApiError] = useState<string>('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const [pendingOTP, setPendingOTP] = useState<PendingOTP | null>(null);

  useEffect(() => {
    const initScreen = async () => {
      try {
        await webSafeSecureStore.deleteItemAsync('saved_email');
        await webSafeSecureStore.deleteItemAsync('saved_password');
      } catch (err) {}
    };
    initScreen();
  }, []);

  const validate = () => {
    setApiError('');
    const errs: { email?: string; password?: string } = {};
    const cleanEmail = email.trim();
    if (!cleanEmail) errs.email = 'Email address is required';
    else if (!/\S+@\S+\.\S+/.test(cleanEmail)) errs.email = 'Enter a valid email address';
    if (!password) errs.password = 'Password is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const showAlert = (title: string, message: string) => {
    setApiError(message);
    Alert.alert(title, message);
  };

  const completeLogin = async (data: any) => {
    await webSafeSecureStore.setItemAsync('accessToken', data.accessToken);
    await webSafeSecureStore.setItemAsync('refreshToken', data.refreshToken);
    await webSafeSecureStore.setItemAsync('sessionId', data.sessionId);

    if (rememberMe && email && password) {
      await webSafeSecureStore.setItemAsync('saved_email', email.trim());
      await webSafeSecureStore.setItemAsync('saved_password', password);
    }

    setAuth({
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      sessionId: data.sessionId,
    });
    router.replace('/(tabs)/dashboard');
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    setApiError('');

    try {
      const res = await authAPI.login({ email: email.trim(), password });
      const { success, data, message } = res.data;

      if (!success) {
        await webSafeSecureStore.deleteItemAsync('saved_password').catch(() => {});
        showAlert('Login Failed', message || 'Invalid email or password credentials.');
        return;
      }

      if (data?.requiresOtp) {
        setPendingOTP({
          userId: data.userId,
          deviceId: data.deviceId,
          maskedEmail: data.maskedEmail || data.maskedPhone || email,
          reason: data.reason || 'login_verification',
        });
        return;
      }

      await completeLogin(data);
    } catch (error: any) {
      const msg =
        error.response?.data?.message ||
        'Connection failed. Ensure the backend server is running.';
      showAlert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOTPVerify = async (
    otp: string,
    trustDevice: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    if (!pendingOTP) {
      return { success: false, error: 'Session lost. Please log in again.' };
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
      type: pendingOTP.reason || 'login_verification',
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
            {/* Logo & Branding */}
            <View style={{ alignItems: 'center', marginBottom: Spacing['4xl'] }}>
              <View
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 20,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: Spacing.lg,
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.25,
                  shadowRadius: 12,
                  elevation: 6,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    borderWidth: 2.5,
                    borderColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 10,
                      height: 14,
                      borderRadius: 4,
                      backgroundColor: '#FFFFFF',
                    }}
                  />
                </View>
              </View>

              <Text
                style={{
                  fontSize: FontSize['3xl'],
                  fontWeight: FontWeight.bold,
                  color: colors.text,
                  letterSpacing: -0.5,
                  marginBottom: 4,
                }}
              >
                SecureVault
              </Text>
              <Text
                style={{
                  fontSize: FontSize.md,
                  color: colors.textSecondary,
                  textAlign: 'center',
                }}
              >
                Enterprise Zero-Knowledge Cloud Storage
              </Text>
            </View>

            {/* Login Form */}
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
              <Text
                style={{
                  fontSize: FontSize.xl,
                  fontWeight: FontWeight.bold,
                  color: colors.text,
                  marginBottom: Spacing.lg,
                }}
              >
                Sign in to your vault
              </Text>

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
                placeholder="Enter your password"
                isPassword
                value={password}
                onChangeText={setPassword}
                error={errors.password}
              />

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: Spacing['2xl'],
                  marginTop: Spacing.xs,
                }}
              >
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.8}
                >
                  <Switch
                    value={rememberMe}
                    onValueChange={setRememberMe}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#FFFFFF"
                    style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
                  />
                  <Text
                    style={{
                      fontSize: FontSize.xs,
                      color: colors.textSecondary,
                      fontWeight: FontWeight.medium,
                    }}
                  >
                    Save credentials
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/auth/forgot-password')}
                >
                  <Text
                    style={{
                      fontSize: FontSize.sm,
                      color: colors.primary,
                      fontWeight: FontWeight.semibold,
                    }}
                  >
                    Forgot password?
                  </Text>
                </TouchableOpacity>
              </View>

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
                title="Sign In"
                onPress={handleLogin}
                loading={loading}
                size="lg"
              />
            </View>

            {/* Register Link */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                marginTop: Spacing.xl,
              }}
            >
              <Text style={{ fontSize: FontSize.md, color: colors.textSecondary }}>
                New to SecureVault?{' '}
              </Text>
              <TouchableOpacity onPress={() => router.push('/auth/register')}>
                <Text
                  style={{
                    fontSize: FontSize.md,
                    color: colors.primary,
                    fontWeight: FontWeight.semibold,
                  }}
                >
                  Create account
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Dynamic Gmail OTP Verification Overlay */}
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
