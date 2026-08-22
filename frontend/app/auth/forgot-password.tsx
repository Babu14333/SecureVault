import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  TextInput,
  StyleSheet,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Mail, ArrowLeft, ShieldCheck, AlertCircle, UserPlus, KeyRound } from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme';
import SecureButton from '../../src/components/ui/SecureButton';
import SecureInput from '../../src/components/ui/SecureInput';
import { Spacing, FontSize, FontWeight, BorderRadius } from '../../src/theme/tokens';
import { authAPI } from '../../src/services/api';

const OTP_LENGTH = 6;

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();

  // Wizard Steps: 'email' | 'otp' | 'reset' | 'success'
  const [step, setStep] = useState<'email' | 'otp' | 'reset' | 'success'>('email');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [emailNotFound, setEmailNotFound] = useState(false);

  // Step 1: Email Request State
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  // Step 2: OTP Verification State
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [countdown, setCountdown] = useState(300); // 5 minutes
  const [resendTimer, setResendTimer] = useState(60);
  const inputRefs = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null));
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resendRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 3: Password Update State
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Animation values for smooth step transitions
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // ── Step Transition Animation ────────────────────────────────────────────────
  const transitionTo = (nextStep: 'email' | 'otp' | 'reset' | 'success') => {
    setErrorMsg('');
    setEmailNotFound(false);
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start(() => {
      setStep(nextStep);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: false,
      }).start(() => {
        if (nextStep === 'otp') {
          setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
      });
    });
  };

  // ── OTP Timers ───────────────────────────────────────────────────────────────
  const startTimers = () => {
    clearTimers();
    setCountdown(300);
    setResendTimer(60);

    countdownRef.current = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);

    resendRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          if (resendRef.current) clearInterval(resendRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const clearTimers = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (resendRef.current) clearInterval(resendRef.current);
  };

  useEffect(() => {
    if (step === 'otp') {
      startTimers();
    } else {
      clearTimers();
    }
    return clearTimers;
  }, [step]);

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 50, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 50, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: false }),
    ]).start();
  };

  const formatTime = (s: number) => {
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };

  // ── Step 1: Request OTP by Email ─────────────────────────────────────────────
  const handleRequestOTP = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg('Please enter your registered email address.');
      setEmailNotFound(false);
      return;
    }

    if (!/\S+@\S+\.\S+/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      setEmailNotFound(false);
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setEmailNotFound(false);

    try {
      const res = await authAPI.forgotPasswordRequest({ email: cleanEmail });
      if (res.data.success) {
        setUserId(res.data.data.userId);
        setMaskedEmail(res.data.data.maskedEmail || cleanEmail);
        transitionTo('otp');
      }
    } catch (err: any) {
      const status = err.response?.status;
      const message = err.response?.data?.message || 'Could not verify email address.';
      if (status === 404 || message.toLowerCase().includes('not exist')) {
        setEmailNotFound(true);
        setErrorMsg('This email does not exist. Please create an account.');
      } else {
        setErrorMsg(message);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ────────────────────────────────────────────────────────
  const handleVerifyOTP = async () => {
    const code = digits.join('');
    if (code.length < OTP_LENGTH) {
      setErrorMsg('Please enter all 6 digits of the verification code.');
      triggerShake();
      return;
    }

    if (countdown <= 0) {
      setErrorMsg('Code expired. Please request a new one.');
      triggerShake();
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await authAPI.forgotPasswordVerify(userId, code);
      if (res.data.success) {
        setResetToken(res.data.data.resetToken);
        transitionTo('reset');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Verification failed. Please check the code.');
      setDigits(Array(OTP_LENGTH).fill(''));
      setFocusedIndex(0);
      inputRefs.current[0]?.focus();
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0 || loading) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await authAPI.forgotPasswordRequest({ email: email.trim() });
      if (res.data.success) {
        Alert.alert('Code Resent', 'A new dynamic 6-digit code was sent to your registered Gmail address.');
        setDigits(Array(OTP_LENGTH).fill(''));
        setFocusedIndex(0);
        startTimers();
        setTimeout(() => inputRefs.current[0]?.focus(), 150);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2 Cell Navigation ───────────────────────────────────────────────────
  const handleDigitChange = (text: string, index: number) => {
    setErrorMsg('');
    const sanitized = text.replace(/[^0-9]/g, '');

    if (sanitized.length > 1) {
      const pasted = sanitized.slice(0, OTP_LENGTH).split('');
      const newDigits = [...digits];
      pasted.forEach((d, i) => {
        if (index + i < OTP_LENGTH) newDigits[index + i] = d;
      });
      setDigits(newDigits);
      const nextIdx = Math.min(index + pasted.length, OTP_LENGTH - 1);
      setFocusedIndex(nextIdx);
      inputRefs.current[nextIdx]?.focus();
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = sanitized;
    setDigits(newDigits);

    if (sanitized && index < OTP_LENGTH - 1) {
      setFocusedIndex(index + 1);
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const newDigits = [...digits];
      newDigits[index - 1] = '';
      setDigits(newDigits);
      setFocusedIndex(index - 1);
      inputRefs.current[index - 1]?.focus();
    }
  };

  // ── Step 3: Reset Password ────────────────────────────────────────────────────
  const handleResetPassword = async () => {
    if (newPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await authAPI.forgotPasswordReset(userId, resetToken, newPassword);
      if (res.data.success) {
        transitionTo('success');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to update password. Please request a new OTP.');
    } finally {
      setLoading(false);
    }
  };

  const allFilled = digits.every((d) => d !== '');

  return (
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
        <Animated.View style={{ opacity: fadeAnim, width: '100%', maxWidth: 440 }}>
          
          {/* Header Back Button */}
          {step !== 'success' && (
            <TouchableOpacity
              onPress={() => {
                if (step === 'otp') transitionTo('email');
                else if (step === 'reset') transitionTo('otp');
                else router.replace('/auth/login');
              }}
              style={{
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: Spacing['2xl'],
                gap: Spacing.sm,
              }}
            >
              <ArrowLeft size={16} color={colors.primary} />
              <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.primary }}>
                Back to {step === 'otp' ? 'Email' : step === 'reset' ? 'Verification' : 'Login'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Error Banner */}
          {!!errorMsg && (
            <View
              style={{
                backgroundColor: colors.dangerBg,
                borderColor: `${colors.danger}30`,
                borderWidth: 1,
                borderRadius: BorderRadius.md,
                padding: Spacing.md,
                marginBottom: Spacing.xl,
                flexDirection: 'row',
                alignItems: 'center',
                gap: Spacing.md,
              }}
            >
              <AlertCircle size={18} color={colors.danger} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FontSize.sm, color: colors.danger, fontWeight: FontWeight.medium }}>
                  {errorMsg}
                </Text>
                {emailNotFound && (
                  <TouchableOpacity
                    onPress={() => router.replace('/auth/register')}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginTop: 8,
                      gap: 4,
                    }}
                  >
                    <UserPlus size={14} color={colors.primary} />
                    <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.primary }}>
                      Create an account now →
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* ────────────────── Step 1: Request Email ────────────────── */}
          {step === 'email' && (
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
              }}
            >
              <View style={{ marginBottom: Spacing['2xl'] }}>
                <Text style={{ fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: colors.text, marginBottom: Spacing.xs }}>
                  Forgot Password?
                </Text>
                <Text style={{ fontSize: FontSize.sm, color: colors.textSecondary, lineHeight: 20 }}>
                  Enter your registered Gmail address. We will check if your account exists and send a live 6-digit verification code.
                </Text>
              </View>

              <SecureInput
                label="Email Address"
                placeholder="name@company.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(t) => { setEmail(t); setErrorMsg(''); setEmailNotFound(false); }}
              />

              <SecureButton
                title="Send Verification Code"
                onPress={handleRequestOTP}
                loading={loading}
                size="lg"
                style={{ marginTop: Spacing.lg }}
              />

              {emailNotFound && (
                <TouchableOpacity
                  onPress={() => router.replace('/auth/register')}
                  style={{
                    marginTop: Spacing.xl,
                    padding: Spacing.md,
                    borderRadius: BorderRadius.md,
                    backgroundColor: colors.cardAlt,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: Spacing.sm,
                  }}
                >
                  <UserPlus size={16} color={colors.primary} />
                  <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.primary }}>
                    Don't have an account? Sign Up
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ────────────────── Step 2: Verify OTP ────────────────── */}
          {step === 'otp' && (
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
              }}
            >
              <View style={{ marginBottom: Spacing['2xl'] }}>
                <Text style={{ fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: colors.text, marginBottom: Spacing.xs }}>
                  Gmail Verification
                </Text>
                <Text style={{ fontSize: FontSize.sm, color: colors.textSecondary, lineHeight: 20 }}>
                  We sent a live 6-digit verification code to your registered Gmail address:
                </Text>
                {maskedEmail && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardAlt, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: BorderRadius.full, alignSelf: 'flex-start', marginTop: Spacing.md, borderWidth: 1, borderColor: colors.border }}>
                    <Mail size={13} color={colors.primary} style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: FontSize.sm, color: colors.text, fontWeight: FontWeight.semibold }}>
                      {maskedEmail}
                    </Text>
                  </View>
                )}
              </View>

              {/* Digit input row */}
              <Animated.View style={[styles.cellsRow, { transform: [{ translateX: shakeAnim }] }]}>
                {digits.map((digit, idx) => (
                  <View key={idx}>
                    <View
                      style={[
                        styles.cell,
                        {
                          borderColor: focusedIndex === idx ? colors.primary : digit ? colors.primaryLight : colors.border,
                          backgroundColor: colors.inputBg,
                          borderWidth: focusedIndex === idx ? 2 : 1.5,
                        },
                      ]}
                    >
                      <Text style={[styles.cellText, { color: colors.text }]}>
                        {digit}
                      </Text>
                    </View>
                    <TextInput
                      ref={(el) => { inputRefs.current[idx] = el; }}
                      style={styles.hiddenInput}
                      value={digit}
                      onChangeText={(t) => handleDigitChange(t, idx)}
                      onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, idx)}
                      onFocus={() => setFocusedIndex(idx)}
                      keyboardType="number-pad"
                      maxLength={1}
                      caretHidden
                    />
                  </View>
                ))}
              </Animated.View>

              {/* Countdown timer */}
              <Text style={{ fontSize: FontSize.sm, color: colors.textTertiary, textAlign: 'center', marginBottom: Spacing.xl }}>
                {countdown > 0 ? `Code expires in ` : 'Code expired — '}
                <Text style={{ color: countdown > 0 && countdown < 60 ? colors.warning : colors.textSecondary, fontWeight: FontWeight.semibold }}>
                  {countdown > 0 ? formatTime(countdown) : 'request a new one'}
                </Text>
              </Text>

              <SecureButton
                title="Verify Code"
                onPress={handleVerifyOTP}
                loading={loading}
                disabled={!allFilled || countdown <= 0}
                size="lg"
              />

              {/* Resend Cooldown */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xl }}>
                <Text style={{ color: colors.textSecondary, fontSize: FontSize.sm }}>Didn't receive it? </Text>
                <TouchableOpacity onPress={handleResendOTP} disabled={resendTimer > 0 || loading}>
                  <Text style={{ color: resendTimer > 0 ? colors.textTertiary : colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold }}>
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ────────────────── Step 3: Reset Password ────────────────── */}
          {step === 'reset' && (
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
              }}
            >
              <View style={{ marginBottom: Spacing['2xl'] }}>
                <Text style={{ fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: colors.text, marginBottom: Spacing.xs }}>
                  Set New Password
                </Text>
                <Text style={{ fontSize: FontSize.sm, color: colors.textSecondary, lineHeight: 20 }}>
                  Enter a new secure password. Must be at least 8 characters long.
                </Text>
              </View>

              <SecureInput
                label="New Password"
                placeholder="Minimum 8 characters"
                isPassword
                value={newPassword}
                onChangeText={(t) => { setNewPassword(t); setErrorMsg(''); }}
              />

              <SecureInput
                label="Confirm Password"
                placeholder="Re-enter new password"
                isPassword
                value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); setErrorMsg(''); }}
              />

              <SecureButton
                title="Reset Password & Sign In"
                onPress={handleResetPassword}
                loading={loading}
                size="lg"
                style={{ marginTop: Spacing.lg }}
              />
            </View>
          )}

          {/* ────────────────── Step 4: Success ────────────────── */}
          {step === 'success' && (
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: BorderRadius.xl,
                padding: Spacing['3xl'],
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 1,
                shadowRadius: 16,
                elevation: 3,
                alignItems: 'center',
              }}
            >
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl, borderWidth: 1, borderColor: `${colors.success}30` }}>
                <ShieldCheck size={40} color={colors.success} strokeWidth={2.2} />
              </View>

              <Text style={{ fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.text, marginBottom: Spacing.md, textAlign: 'center' }}>
                Password Updated!
              </Text>
              
              <Text style={{ fontSize: FontSize.md, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing['3xl'], paddingHorizontal: Spacing.md }}>
                Your password was reset successfully. All active sessions on other devices have been securely logged out.
              </Text>

              <SecureButton
                title="Back to Sign In"
                onPress={() => router.replace('/auth/login')}
                size="lg"
                style={{ width: '100%' }}
              />
            </View>
          )}

        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  cellsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
    gap: 6,
  },
  cell: {
    width: 44,
    height: 54,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  hiddenInput: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0,
  },
});
