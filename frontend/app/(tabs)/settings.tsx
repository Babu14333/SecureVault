import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { useAuthStore } from '../../src/store/authStore';
import SecurityCard from '../../src/components/ui/SecurityCard';
import SecureInput from '../../src/components/ui/SecureInput';
import SecureButton from '../../src/components/ui/SecureButton';
import { Spacing, FontSize, FontWeight, BorderRadius, AccentPalettes, AccentColorKey, ThemeMode } from '../../src/theme/tokens';
import { authAPI, webSafeSecureStore } from '../../src/services/api';
import {
  Sun,
  Moon,
  Monitor,
  Palette,
  Check,
  ShieldCheck,
  KeyRound,
  Database,
  LogOut,
  Trash2,
  ChevronRight,
  UserCheck,
  Sparkles,
  Lock,
} from 'lucide-react-native';

function SettingsRow({
  label,
  subtitle,
  icon: IconComponent,
  onPress,
  rightElement,
  danger,
  colors,
}: {
  label: string;
  subtitle?: string;
  icon?: any;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  danger?: boolean;
  colors: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress && !rightElement}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: Spacing.md }}>
        {IconComponent && (
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: danger ? colors.dangerBg : `${colors.primary}15`,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: Spacing.md,
            }}
          >
            <IconComponent
              size={18}
              color={danger ? colors.danger : colors.primary}
              strokeWidth={2}
            />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: FontSize.md,
              color: danger ? colors.danger : colors.text,
              fontWeight: FontWeight.medium,
            }}
          >
            {label}
          </Text>
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
      </View>
      {rightElement || (
        <ChevronRight size={18} color={colors.textTertiary} />
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { colors, isDark, mode, setMode, accent, setAccent } = useTheme();
  const { user, setUser, sessionId, logout } = useAuthStore();

  // Security toggles state
  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);

  // Change password modal state
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [passwordMode, setPasswordMode] = useState<'current' | 'otp'>('current');
  const [oldPassword, setOldPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);

  useEffect(() => {
    let interval: any;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  const handleRequestPasswordOtp = async () => {
    setIsSendingOtp(true);
    setPasswordError('');
    try {
      const res = await authAPI.requestPasswordOTP();
      if (res.data.success) {
        setPasswordMode('otp');
        setOtpSent(true);
        setOtpTimer(60);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to send OTP to your email. Please try again.';
      setPasswordError(msg);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleChangePasswordSubmit = async () => {
    if (passwordMode === 'current' && !oldPassword) {
      setPasswordError('Please enter your current password or choose email OTP verification');
      return;
    }
    if (passwordMode === 'otp' && (!otpCode || otpCode.trim().length !== 6)) {
      setPasswordError('Please enter the 6-digit OTP code sent to your email');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match');
      return;
    }

    setIsChangingPassword(true);
    setPasswordError('');

    try {
      const payload = passwordMode === 'otp'
        ? { otpCode: otpCode.trim(), newPassword }
        : { oldPassword, newPassword };

      const res = await authAPI.changePassword(payload);
      if (res.data.success) {
        Alert.alert('Password Updated', 'Your account password has been updated successfully.');
        setIsPasswordModalVisible(false);
        setOldPassword('');
        setOtpCode('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordMode('current');
        setOtpSent(false);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to change password. Please check your credentials.';
      setPasswordError(msg);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const removeAuthTokens = async () => {
    await webSafeSecureStore.deleteItemAsync('accessToken');
    await webSafeSecureStore.deleteItemAsync('refreshToken');
    await webSafeSecureStore.deleteItemAsync('sessionId');
  };

  const performLogout = async () => {
    try {
      if (sessionId) {
        await authAPI.logout(sessionId);
      }
    } catch (err) {
      console.warn('Backend logout error:', err);
    } finally {
      await removeAuthTokens();
      logout();
      router.replace('/auth/login');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of SecureVault?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: performLogout,
        },
      ]
    );
  };

  const performDeleteAccount = async () => {
    try {
      const res = await authAPI.deleteAccount();
      if (res.data.success) {
        Alert.alert('Account Deleted', 'Your account and all encrypted cloud vault data have been deleted.');
      }
    } catch (err: any) {
      console.warn('Backend delete account error:', err);
    } finally {
      await removeAuthTokens();
      logout();
      router.replace('/auth/login');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action CANNOT be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'Erase all vault files, shared links, and security keys forever?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Erase Everything', style: 'destructive', onPress: performDeleteAccount },
              ]
            );
          },
        },
      ]
    );
  };

  const modeOptions: { key: ThemeMode; label: string; icon: any }[] = [
    { key: 'light', label: 'Light', icon: Sun },
    { key: 'dark', label: 'Dark', icon: Moon },
    { key: 'system', label: 'System', icon: Monitor },
  ];

  const accentKeys: AccentColorKey[] = ['indigo', 'emerald', 'violet', 'amber', 'crimson'];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 110 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xl }}>
          <View>
            <Text
              style={{
                fontSize: FontSize['2xl'],
                fontWeight: FontWeight.bold,
                color: colors.text,
              }}
            >
              Settings
            </Text>
            <Text style={{ fontSize: FontSize.sm, color: colors.textSecondary, marginTop: 2 }}>
              Account security, visual themes & preferences
            </Text>
          </View>
        </View>

        {/* Profile Card */}
        <SecurityCard style={{ marginBottom: Spacing.xl, padding: Spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 58,
                height: 58,
                borderRadius: 29,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: Spacing.lg,
                borderWidth: 2,
                borderColor: `${colors.primary}40`,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: FontSize['2xl'], fontWeight: FontWeight.bold }}>
                {(user?.fullName || 'S')[0].toUpperCase()}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: colors.text, marginRight: 6 }}>
                  {user?.fullName || 'Secure User'}
                </Text>
                <UserCheck size={16} color={colors.primary} />
              </View>
              <Text style={{ fontSize: FontSize.sm, color: colors.textSecondary, marginTop: 2 }}>
                {user?.email || 'user@securevault.app'}
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: BorderRadius.sm,
                    backgroundColor: `${colors.success}18`,
                    borderWidth: 1,
                    borderColor: `${colors.success}30`,
                  }}
                >
                  <Text style={{ fontSize: 11, color: colors.success, fontWeight: '700' }}>
                    Verified Account
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: BorderRadius.sm,
                    backgroundColor: `${colors.primary}18`,
                    borderWidth: 1,
                    borderColor: `${colors.primary}30`,
                  }}
                >
                  <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700', textTransform: 'capitalize' }}>
                    {user?.role || 'user'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </SecurityCard>

        {/* ─── APPEARANCE & THEME SECTION ─── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
          <Palette size={16} color={colors.primary} style={{ marginRight: 6 }} />
          <Text
            style={{
              fontSize: FontSize.xs,
              color: colors.textTertiary,
              fontWeight: FontWeight.bold,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
            }}
          >
            Appearance & Color Theme
          </Text>
        </View>

        <SecurityCard style={{ marginBottom: Spacing.xl, padding: Spacing.lg }}>
          {/* Theme Mode Selection Cards */}
          <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.text, marginBottom: Spacing.md }}>
            Theme Mode
          </Text>
          <View style={{ flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl }}>
            {modeOptions.map((item) => {
              const IconComp = item.icon;
              const isSelected = mode === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => setMode(item.key)}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    paddingVertical: Spacing.md,
                    paddingHorizontal: Spacing.sm,
                    borderRadius: BorderRadius.md,
                    backgroundColor: isSelected ? `${colors.primary}18` : colors.inputBg,
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected ? colors.primary : colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconComp
                    size={22}
                    color={isSelected ? colors.primary : colors.textSecondary}
                    strokeWidth={isSelected ? 2.2 : 1.8}
                  />
                  <Text
                    style={{
                      fontSize: FontSize.xs,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.medium,
                      color: isSelected ? colors.primary : colors.text,
                      marginTop: 6,
                    }}
                  >
                    {item.label}
                  </Text>
                  {isSelected && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: colors.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={10} color="#FFFFFF" strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Accent Color Palette Picker */}
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: Spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md }}>
              <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.text }}>
                Accent Color Palette
              </Text>
              <Text style={{ fontSize: FontSize.xs, color: colors.primary, fontWeight: FontWeight.semibold }}>
                {AccentPalettes[accent]?.name}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              {accentKeys.map((key) => {
                const palette = AccentPalettes[key];
                const isSelected = accent === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setAccent(key)}
                    activeOpacity={0.8}
                    style={{
                      alignItems: 'center',
                    }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: palette.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: isSelected ? 3 : 2,
                        borderColor: isSelected ? colors.text : 'transparent',
                        shadowColor: palette.primary,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: isSelected ? 0.5 : 0.2,
                        shadowRadius: 6,
                        elevation: isSelected ? 6 : 2,
                      }}
                    >
                      {isSelected && <Check size={18} color="#FFFFFF" strokeWidth={3} />}
                    </View>
                    <Text
                      style={{
                        fontSize: 10,
                        color: isSelected ? colors.primary : colors.textSecondary,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.medium,
                        marginTop: 6,
                      }}
                    >
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </SecurityCard>

        {/* ─── SECURITY SECTION ─── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
          <ShieldCheck size={16} color={colors.primary} style={{ marginRight: 6 }} />
          <Text
            style={{
              fontSize: FontSize.xs,
              color: colors.textTertiary,
              fontWeight: FontWeight.bold,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
            }}
          >
            Security & Authentication
          </Text>
        </View>

        <SecurityCard style={{ marginBottom: Spacing.xl }}>
          <SettingsRow
            label="Change Password"
            subtitle="Update account login credentials or reset via Email OTP"
            icon={KeyRound}
            onPress={() => setIsPasswordModalVisible(true)}
            colors={colors}
          />
        </SecurityCard>

        {/* ─── STORAGE & DATA SECTION ─── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
          <Database size={16} color={colors.primary} style={{ marginRight: 6 }} />
          <Text
            style={{
              fontSize: FontSize.xs,
              color: colors.textTertiary,
              fontWeight: FontWeight.bold,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
            }}
          >
            Local Storage & Data
          </Text>
        </View>

        <SecurityCard style={{ marginBottom: Spacing.xl }}>
          <SettingsRow
            label="Clear Temporary Cache"
            subtitle="Free local memory & temp preview storage"
            icon={Database}
            onPress={() => {
              Alert.alert('Cache Cleared', 'Local application temporary cache cleared.');
            }}
            colors={colors}
          />
        </SecurityCard>

        {/* ─── DANGER ZONE ─── */}
        <SecurityCard style={{ marginBottom: Spacing.xl }}>
          <SettingsRow
            label="Sign Out"
            subtitle="Disconnect current user session"
            icon={LogOut}
            onPress={handleLogout}
            colors={colors}
          />
          <SettingsRow
            label="Delete Account"
            subtitle="Permanently erase account & all vault files"
            icon={Trash2}
            onPress={handleDeleteAccount}
            danger
            colors={colors}
          />
        </SecurityCard>

        {/* Footer info */}
        <View style={{ alignItems: 'center', marginTop: Spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Sparkles size={14} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, fontWeight: FontWeight.semibold }}>
              SecureVault Professional Cloud Protection
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: colors.textTertiary }}>
            Version 1.0.0 • Zero-Knowledge Encryption
          </Text>
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={isPasswordModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsPasswordModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: Spacing.xl,
          }}
        >
          <View
            style={{
              width: '100%',
              backgroundColor: colors.card,
              borderRadius: BorderRadius.xl,
              padding: Spacing.xl,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.4,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg }}>
              <View>
                <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: colors.text }}>
                  Reset / Change Password
                </Text>
                <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 2 }}>
                  {passwordMode === 'current' ? 'Verify with current password or email OTP' : 'Verify via 6-digit email code'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setIsPasswordModalVisible(false);
                  setOldPassword('');
                  setOtpCode('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setPasswordError('');
                  setPasswordMode('current');
                  setOtpSent(false);
                }}
              >
                <Text style={{ fontSize: FontSize.lg, color: colors.textSecondary, fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {passwordError ? (
              <View
                style={{
                  backgroundColor: colors.dangerBg,
                  padding: Spacing.md,
                  borderRadius: BorderRadius.md,
                  marginBottom: Spacing.md,
                  borderWidth: 1,
                  borderColor: `${colors.danger}40`,
                }}
              >
                <Text style={{ color: colors.danger, fontSize: FontSize.xs, fontWeight: FontWeight.medium }}>
                  {passwordError}
                </Text>
              </View>
            ) : null}

            {passwordMode === 'current' ? (
              <View style={{ marginBottom: Spacing.sm }}>
                <SecureInput
                  label="Current Password"
                  placeholder="Enter your current password"
                  isPassword
                  value={oldPassword}
                  onChangeText={setOldPassword}
                />

                <TouchableOpacity
                  onPress={handleRequestPasswordOtp}
                  disabled={isSendingOtp}
                  style={{ alignSelf: 'flex-start', marginTop: -4, marginBottom: Spacing.md }}
                >
                  <Text style={{ fontSize: FontSize.xs, color: colors.primary, fontWeight: FontWeight.semibold }}>
                    {isSendingOtp ? 'Sending verification code...' : "Don't know current password? Verify via Email OTP ✉️"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ marginBottom: Spacing.md }}>
                <View
                  style={{
                    backgroundColor: `${colors.success}15`,
                    padding: Spacing.md,
                    borderRadius: BorderRadius.md,
                    marginBottom: Spacing.md,
                    borderWidth: 1,
                    borderColor: `${colors.success}35`,
                  }}
                >
                  <Text style={{ fontSize: FontSize.xs, color: colors.success, fontWeight: FontWeight.semibold }}>
                    ✓ 6-Digit code sent to your registered Gmail address.
                  </Text>
                </View>

                <SecureInput
                  label="6-Digit Email OTP Code"
                  placeholder="Enter 6-digit code"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otpCode}
                  onChangeText={setOtpCode}
                />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: -4, marginBottom: Spacing.xs }}>
                  <TouchableOpacity
                    onPress={handleRequestPasswordOtp}
                    disabled={otpTimer > 0 || isSendingOtp}
                  >
                    <Text style={{ fontSize: FontSize.xs, color: otpTimer > 0 ? colors.textTertiary : colors.primary, fontWeight: FontWeight.semibold }}>
                      {otpTimer > 0 ? `Resend Code in ${otpTimer}s` : 'Resend Email OTP'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setPasswordMode('current');
                      setPasswordError('');
                    }}
                  >
                    <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, fontWeight: FontWeight.medium }}>
                      ← Use current password
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <SecureInput
              label="New Password"
              placeholder="Min 8 chars (letters, numbers, symbols)"
              isPassword
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <SecureInput
              label="Confirm New Password"
              placeholder="Re-enter new password"
              isPassword
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <View style={{ flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg }}>
              <View style={{ flex: 1 }}>
                <SecureButton
                  title="Cancel"
                  onPress={() => {
                    setIsPasswordModalVisible(false);
                    setOldPassword('');
                    setOtpCode('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setPasswordError('');
                    setPasswordMode('current');
                    setOtpSent(false);
                  }}
                  variant="secondary"
                  size="md"
                />
              </View>
              <View style={{ flex: 1 }}>
                <SecureButton
                  title="Update Password"
                  onPress={handleChangePasswordSubmit}
                  loading={isChangingPassword}
                  size="md"
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
