import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { useTheme } from '../../theme/useTheme';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '../../theme/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OTPModalProps {
  visible: boolean;
  /** Title shown at top of modal */
  title?: string;
  /** Subtitle / context message */
  subtitle?: string;
  /** Masked phone string e.g. "••••••7357" */
  maskedPhone?: string;
  /** OTP expiry in seconds (default 300) */
  expiresIn?: number;
  /** Resend cooldown in seconds (default 60) */
  resendCooldown?: number;
  /** Called when user submits the 6-digit code */
  onVerify: (otp: string) => Promise<{ success: boolean; error?: string }>;
  /** Called when user requests resend */
  onResend: () => Promise<void>;
  /** Called when user dismisses modal */
  onDismiss: () => void;
  /** Additional context below code cells (optional) */
  footerNote?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OTP_LENGTH = 6;

// ─── OTP Cell ─────────────────────────────────────────────────────────────────

function OTPCell({
  value,
  isFocused,
  hasError,
  colors,
}: {
  value: string;
  isFocused: boolean;
  hasError: boolean;
  colors: any;
}) {
  const borderColor = hasError
    ? colors.danger
    : isFocused
    ? colors.primary
    : value
    ? colors.primaryLight
    : colors.border;

  return (
    <View
      style={{
        width: 46,
        height: 56,
        borderRadius: BorderRadius.md,
        borderWidth: isFocused ? 2 : 1.5,
        borderColor,
        backgroundColor: colors.inputBg,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: isFocused ? colors.primary : 'transparent',
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: isFocused ? 4 : 0,
      }}
    >
      <Text
        style={{
          fontSize: FontSize['2xl'],
          fontWeight: FontWeight.bold,
          color: hasError ? colors.danger : colors.text,
          letterSpacing: 1,
        }}
      >
        {value ? '•' : ''}
      </Text>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OTPModal({
  visible,
  title = 'Verify Your Identity',
  subtitle = 'Enter the 6-digit code sent to your phone.',
  maskedPhone,
  expiresIn = 300,
  resendCooldown = 60,
  onVerify,
  onResend,
  onDismiss,
  footerNote,
}: OTPModalProps) {
  const { colors } = useTheme();

  // OTP state
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Timers
  const [countdown, setCountdown] = useState(expiresIn);
  const [resendTimer, setResendTimer] = useState(resendCooldown);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resendRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animation
  const slideAnim = useRef(new Animated.Value(400)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Single Input ref
  const inputRef = useRef<TextInput | null>(null);

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (visible) {
      resetState();
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: false,
        tension: 65,
        friction: 11,
      }).start();
      startCountdowns();
      setTimeout(() => inputRef.current?.focus(), 400);
    } else {
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 200,
        useNativeDriver: false,
        easing: Easing.in(Easing.ease),
      }).start();
      clearIntervals();
    }
    return clearIntervals;
  }, [visible]);

  const resetState = () => {
    setCode('');
    setErrorMsg('');
    setSuccessMsg('');
    setIsVerifying(false);
    setCountdown(expiresIn);
    setResendTimer(resendCooldown);
  };

  const startCountdowns = () => {
    clearIntervals();

    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    resendRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          clearInterval(resendRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const clearIntervals = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (resendRef.current) clearInterval(resendRef.current);
  };

  // ── Shake animation on error ───────────────────────────────────────────────

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: false }),
    ]).start();
  };

  // ── Digit input handling ───────────────────────────────────────────────────

  const handleTextChange = (text: string) => {
    setErrorMsg('');
    const sanitized = text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
    setCode(sanitized);
  };

  // ── Verify ─────────────────────────────────────────────────────────────────

  const handleVerify = async () => {
    if (code.length < OTP_LENGTH) {
      setErrorMsg('Please enter all 6 digits.');
      triggerShake();
      return;
    }
    if (countdown <= 0) {
      setErrorMsg('Code has expired. Please request a new one.');
      triggerShake();
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');
    try {
      const result = await onVerify(code);
      if (result.success) {
        setSuccessMsg('Verified successfully!');
        clearIntervals();
      } else {
        setErrorMsg(result.error || 'Invalid verification code.');
        setCode('');
        inputRef.current?.focus();
        triggerShake();
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      triggerShake();
    } finally {
      setIsVerifying(false);
    }
  };

  // ── Resend ─────────────────────────────────────────────────────────────────

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setIsResending(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await onResend();
      setCode('');
      inputRef.current?.focus();
      startCountdowns();
      setSuccessMsg('New code sent!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to resend. Try again.');
    } finally {
      setIsResending(false);
    }
  };

  // ── Timer display ──────────────────────────────────────────────────────────

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const hasError = !!errorMsg;
  const allFilled = code.length === OTP_LENGTH;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={onDismiss}
          activeOpacity={1}
        />

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Handle bar */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            {/* Shield icon */}
            <View style={[styles.iconWrap, { backgroundColor: colors.infoBg }]}>
              <Text style={{ fontSize: 28 }}>🔐</Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
            {maskedPhone && (
              <View style={[styles.phoneBadge, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
                <Text style={{ fontSize: FontSize.sm, color: colors.textSecondary }}>
                  📱 Sent to{' '}
                  <Text style={{ color: colors.text, fontWeight: FontWeight.semibold }}>
                    {maskedPhone}
                  </Text>
                </Text>
              </View>
            )}
          </View>

          {/* OTP cells */}
          <View style={{ position: 'relative', width: '100%', marginBottom: Spacing.xl }}>
            <Animated.View
              style={[styles.cellsRow, { transform: [{ translateX: shakeAnim }] }]}
            >
              {Array(OTP_LENGTH)
                .fill('')
                .map((_, idx) => {
                  const digit = code[idx] || '';
                  const isFocused = code.length === idx;
                  return (
                    <OTPCell
                      key={idx}
                      value={digit}
                      isFocused={isFocused && visible}
                      hasError={hasError}
                      colors={colors}
                    />
                  );
                })}
            </Animated.View>
            <TextInput
              ref={inputRef}
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                opacity: 0,
              }}
              value={code}
              onChangeText={handleTextChange}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
            />
          </View>

          {/* Error / success feedback */}
          {errorMsg ? (
            <Text style={[styles.feedbackMsg, { color: colors.danger }]}>
              ⚠ {errorMsg}
            </Text>
          ) : successMsg ? (
            <Text style={[styles.feedbackMsg, { color: colors.success }]}>
              ✓ {successMsg}
            </Text>
          ) : null}

          {/* Expiry timer */}
          {countdown > 0 ? (
            <Text style={[styles.timerText, { color: colors.textTertiary }]}>
              Code expires in{' '}
              <Text style={{ color: countdown < 60 ? colors.warning : colors.textSecondary, fontWeight: FontWeight.semibold }}>
                {formatTime(countdown)}
              </Text>
            </Text>
          ) : (
            <Text style={[styles.timerText, { color: colors.danger }]}>
              Code expired — request a new one below.
            </Text>
          )}

          {/* Verify button */}
          <TouchableOpacity
            style={[
              styles.verifyBtn,
              {
                backgroundColor: allFilled && !isVerifying ? colors.primary : colors.border,
                opacity: allFilled && !isVerifying ? 1 : 0.6,
              },
            ]}
            onPress={handleVerify}
            disabled={!allFilled || isVerifying}
            activeOpacity={0.85}
          >
            {isVerifying ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.verifyBtnText}>Verify & Continue</Text>
            )}
          </TouchableOpacity>

          {/* Resend */}
          <View style={styles.resendRow}>
            <Text style={{ color: colors.textSecondary, fontSize: FontSize.sm }}>
              Didn't receive it?{' '}
            </Text>
            <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0 || isResending}>
              {isResending ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text
                  style={{
                    fontSize: FontSize.sm,
                    fontWeight: FontWeight.semibold,
                    color: resendTimer > 0 ? colors.textTertiary : colors.primary,
                  }}
                >
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Optional footer note */}
          {footerNote && (
            <Text style={[styles.footerNote, { color: colors.textTertiary }]}>
              {footerNote}
            </Text>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing['3xl'],
    paddingBottom: Spacing['5xl'],
    paddingTop: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  phoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  cellsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
    gap: 8,
  },
  hiddenInput: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0,
  },
  feedbackMsg: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginBottom: Spacing.md,
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
    marginBottom: Spacing.xl,
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
  footerNote: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.lg,
  },
});
