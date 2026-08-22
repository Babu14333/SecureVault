import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Shield, Lock, Smartphone, AlertTriangle, AlertCircle, Mail } from 'lucide-react-native';
import { useTheme } from '../../theme/useTheme';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '../../theme/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoginOTPScreenProps {
  visible: boolean;
  userId: string;
  deviceId?: string;
  maskedEmail?: string;
  maskedPhone?: string;
  reason: string;
  onVerify: (otp: string, trustDevice: boolean) => Promise<{ success: boolean; error?: string }>;
  onResend: () => Promise<void>;
  onDismiss: () => void;
}

// ─── Reason display map ───────────────────────────────────────────────────────

const REASON_INFO: Record<string, { iconName: string; label: string; severity: 'info' | 'warn' | 'critical' }> = {
  login_verification: {
    iconName: 'Mail',
    label: 'Dynamic Gmail verification required',
    severity: 'info',
  },
  email_verification: {
    iconName: 'Mail',
    label: 'Dynamic Gmail verification required',
    severity: 'info',
  },
  new_device: {
    iconName: 'Smartphone',
    label: 'Login from a new device detected',
    severity: 'info',
  },
  untrusted_device: {
    iconName: 'AlertTriangle',
    label: 'Login from an untrusted device',
    severity: 'warn',
  },
  repeated_failures: {
    iconName: 'AlertCircle',
    label: 'Multiple failed login attempts detected',
    severity: 'critical',
  },
  admin_account: {
    iconName: 'Lock',
    label: 'Admin account — extra verification required',
    severity: 'warn',
  },
};

const OTP_LENGTH = 6;

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoginOTPScreen({
  visible,
  userId,
  deviceId,
  maskedEmail,
  maskedPhone,
  reason,
  onVerify,
  onResend,
  onDismiss,
}: LoginOTPScreenProps) {
  const { colors } = useTheme();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(300);
  const [resendTimer, setResendTimer] = useState(60);

  const inputRefs = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null));
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resendRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reasonInfo = REASON_INFO[reason] || REASON_INFO['new_device'];

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (visible) {
      resetState();
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: false }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 70, friction: 10, useNativeDriver: false }),
      ]).start();
      startTimers();
      setTimeout(() => inputRefs.current[0]?.focus(), 350);
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
        Animated.timing(scaleAnim, { toValue: 0.92, duration: 200, useNativeDriver: false }),
      ]).start();
      clearTimers();
    }
    return clearTimers;
  }, [visible]);

  const resetState = () => {
    setDigits(Array(OTP_LENGTH).fill(''));
    setFocusedIndex(0);
    setErrorMsg('');
    setIsVerifying(false);
    setCountdown(300);
    setResendTimer(60);
  };

  const startTimers = () => {
    clearTimers();
    countdownRef.current = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    resendRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) { clearInterval(resendRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const clearTimers = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (resendRef.current) clearInterval(resendRef.current);
  };

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 55, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 55, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 55, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: false }),
    ]).start();
  };

  // ── Digit input ────────────────────────────────────────────────────────────

  const handleDigitChange = (text: string, index: number) => {
    setErrorMsg('');
    const sanitized = text.replace(/[^0-9]/g, '');
    if (sanitized.length > 1) {
      const pasted = sanitized.slice(0, OTP_LENGTH).split('');
      const newDigits = [...digits];
      pasted.forEach((d, i) => { if (index + i < OTP_LENGTH) newDigits[index + i] = d; });
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

  // ── Verify ─────────────────────────────────────────────────────────────────

  const handleVerify = async () => {
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) {
      setErrorMsg('Please enter all 6 digits.');
      triggerShake();
      return;
    }
    if (countdown <= 0) {
      setErrorMsg('Code expired. Please request a new one.');
      triggerShake();
      return;
    }
    setIsVerifying(true);
    setErrorMsg('');
    try {
      const result = await onVerify(otp, false);
      if (!result.success) {
        setErrorMsg(result.error || 'Invalid verification code.');
        setDigits(Array(OTP_LENGTH).fill(''));
        setFocusedIndex(0);
        inputRefs.current[0]?.focus();
        triggerShake();
      }
      // On success, parent handles navigation — don't reset here
    } catch {
      setErrorMsg('Network error. Please try again.');
      triggerShake();
    } finally {
      setIsVerifying(false);
    }
  };

  // ── Resend ─────────────────────────────────────────────────────────────────

  const handleResend = async () => {
    if (resendTimer > 0 || isResending) return;
    setIsResending(true);
    setErrorMsg('');
    try {
      await onResend();
      setDigits(Array(OTP_LENGTH).fill(''));
      setFocusedIndex(0);
      inputRefs.current[0]?.focus();
      setResendTimer(60);
      setCountdown(300);
      startTimers();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to resend. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const hasError = !!errorMsg;
  const allFilled = digits.every((d) => d !== '');

  const severityColor = {
    info: colors.info,
    warn: colors.warning,
    critical: colors.danger,
  }[reasonInfo.severity];

  const renderBannerIcon = (name: string, color: string) => {
    const iconProps = { size: 18, color };
    switch (name) {
      case 'Mail': return <Mail {...iconProps} />;
      case 'Smartphone': return <Smartphone {...iconProps} />;
      case 'AlertTriangle': return <AlertTriangle {...iconProps} />;
      case 'AlertCircle': return <AlertCircle {...iconProps} />;
      case 'Lock': return <Lock {...iconProps} />;
      default: return <Mail {...iconProps} />;
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (!visible) return null;

  const displayTarget = maskedEmail || maskedPhone;

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.centerer}
      >
        <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Spacing.xl }}
            >
              {/* Security alert banner */}
              <View style={[styles.alertBanner, { backgroundColor: `${severityColor}12`, borderColor: `${severityColor}24` }]}>
                {renderBannerIcon(reasonInfo.iconName, severityColor)}
                <Text style={[styles.alertText, { color: severityColor }]}>
                  {reasonInfo.label}
                </Text>
              </View>

              {/* Header */}
              <View style={styles.header}>
                <View style={[styles.shieldWrap, { backgroundColor: colors.infoBg }]}>
                  <Shield size={34} color={colors.info} strokeWidth={2.2} />
                </View>
                <Text style={[styles.title, { color: colors.text }]}>
                  Gmail Verification
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  We sent a dynamic 6-digit code to your registered Gmail address.
                </Text>
                {displayTarget && (
                  <View style={[styles.phonePill, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
                    {maskedEmail ? (
                      <Mail size={14} color={colors.primary} style={{ marginRight: 6 }} />
                    ) : (
                      <Smartphone size={13} color={colors.textSecondary} style={{ marginRight: 6 }} />
                    )}
                    <Text style={{ fontSize: FontSize.sm, color: colors.textSecondary }}>
                      <Text style={{ color: colors.text, fontWeight: FontWeight.semibold }}>
                        {displayTarget}
                      </Text>
                    </Text>
                  </View>
                )}
              </View>

              {/* OTP digit cells */}
              <Animated.View style={[styles.cellsRow, { transform: [{ translateX: shakeAnim }] }]}>
                {digits.map((digit, idx) => (
                  <View key={idx}>
                    <View
                      style={[
                        styles.cell,
                        {
                          borderColor: hasError
                            ? colors.danger
                            : focusedIndex === idx
                            ? colors.primary
                            : digit
                            ? colors.primaryLight
                            : colors.border,
                          backgroundColor: colors.inputBg,
                          borderWidth: focusedIndex === idx ? 2 : 1.5,
                          shadowColor: focusedIndex === idx ? colors.primary : 'transparent',
                          shadowOpacity: 0.35,
                          elevation: focusedIndex === idx ? 4 : 0,
                        },
                      ]}
                    >
                      <Text style={[styles.cellText, { color: hasError ? colors.danger : colors.text }]}>
                        {digit ? '•' : ''}
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
                      maxLength={OTP_LENGTH}
                      caretHidden
                      textContentType="oneTimeCode"
                      autoComplete="sms-otp"
                    />
                  </View>
                ))}
              </Animated.View>

              {/* Feedback */}
              {hasError && (
                <View style={styles.errorBanner}>
                  <AlertCircle size={14} color={colors.danger} style={{ marginRight: 6 }} />
                  <Text style={[styles.feedback, { color: colors.danger }]}>{errorMsg}</Text>
                </View>
              )}

              {/* Countdown */}
              <Text style={[styles.timerText, { color: colors.textTertiary }]}>
                {countdown > 0
                  ? `Expires in `
                  : 'Code expired — '}
                <Text style={{ color: countdown > 0 && countdown < 60 ? colors.warning : colors.textSecondary, fontWeight: FontWeight.semibold }}>
                  {countdown > 0 ? formatTime(countdown) : 'request a new one'}
                </Text>
              </Text>

              {/* Verify button */}
              <TouchableOpacity
                style={[
                  styles.verifyBtn,
                  {
                    backgroundColor: allFilled && !isVerifying ? colors.primary : colors.border,
                    opacity: allFilled && !isVerifying ? 1 : 0.55,
                  },
                ]}
                onPress={handleVerify}
                disabled={!allFilled || isVerifying}
                activeOpacity={0.85}
              >
                {isVerifying ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.verifyBtnText}>Verify & Sign In</Text>
                )}
              </TouchableOpacity>

              {/* Resend */}
              <View style={styles.resendRow}>
                <Text style={{ color: colors.textSecondary, fontSize: FontSize.sm }}>Didn't receive it? </Text>
                <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0 || isResending}>
                  {isResending ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <Text style={{ color: resendTimer > 0 ? colors.textTertiary : colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold }}>
                      {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Back */}
              <TouchableOpacity onPress={onDismiss} style={styles.backBtn}>
                <Text style={{ color: colors.textSecondary, fontSize: FontSize.sm }}>
                  ← Back to login
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    zIndex: 999,
  },
  centerer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['2xl'],
  },
  card: {
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing['2xl'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 440,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xl,
  },
  alertText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  shieldWrap: {
    width: 80,
    height: 80,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  phonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  cellsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
    gap: 6,
  },
  cell: {
    width: 44,
    height: 54,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowRadius: 6,
  },
  cellText: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
  },
  hiddenInput: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  feedback: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  timerText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  verifyBtn: {
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  verifyBtnText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.3,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  backBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
});
