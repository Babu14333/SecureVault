import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Alert as RNAlert,
  AlertButton as RNAlertButton,
} from 'react-native';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Shield,
  Trash2,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../theme/useTheme';
import { FontSize, FontWeight, BorderRadius, Spacing } from '../../theme/tokens';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertConfig {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  type?: 'success' | 'danger' | 'warning' | 'info';
}

interface AlertContextType {
  showAlert: (config: AlertConfig) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType>({
  showAlert: () => {},
  hideAlert: () => {},
});

// Global alert invoker for non-hook callers
let globalShowAlert: ((config: AlertConfig) => void) | null = null;

export const customAlert = (
  title: string,
  message?: string,
  buttons?: AlertButton[],
  type?: 'success' | 'danger' | 'warning' | 'info'
) => {
  if (globalShowAlert) {
    globalShowAlert({ title, message, buttons, type });
  } else {
    // Fallback if provider not ready yet
    console.log(`[Alert] ${title}: ${message}`);
  }
};

export const useAlert = () => useContext(AlertContext);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);
  const [visible, setVisible] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  const showAlert = (config: AlertConfig) => {
    setAlertConfig(config);
    setVisible(true);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const hideAlert = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setVisible(false);
      setAlertConfig(null);
    });
  };

  useEffect(() => {
    globalShowAlert = showAlert;

    // Polyfill React Native's global Alert.alert so all existing Alert.alert calls everywhere use our custom popup
    const originalAlert = RNAlert.alert;
    RNAlert.alert = (
      title: string,
      message?: string,
      buttons?: RNAlertButton[],
      _options?: any
    ) => {
      const formattedButtons: AlertButton[] | undefined = buttons?.map((b) => ({
        text: b.text || 'OK',
        style: b.style as any,
        onPress: b.onPress,
      }));

      showAlert({
        title,
        message,
        buttons: formattedButtons,
      });
    };

    return () => {
      globalShowAlert = null;
      RNAlert.alert = originalAlert;
    };
  }, []);

  // Determine icon & theme color
  const getAlertDetails = () => {
    if (!alertConfig) return { icon: <Info size={24} color={colors.primary} />, badgeBg: `${colors.primary}15`, borderColor: `${colors.primary}30` };

    const lowerTitle = (alertConfig.title || '').toLowerCase();
    const lowerMessage = (alertConfig.message || '').toLowerCase();
    const isDestructive =
      alertConfig.type === 'danger' ||
      lowerTitle.includes('delete') ||
      lowerTitle.includes('error') ||
      lowerTitle.includes('failed') ||
      lowerTitle.includes('denied') ||
      lowerTitle.includes('revoke') ||
      lowerTitle.includes('suspend') ||
      alertConfig.buttons?.some((b) => b.style === 'destructive');

    const isSuccess =
      alertConfig.type === 'success' ||
      lowerTitle.includes('success') ||
      lowerTitle.includes('copied') ||
      lowerTitle.includes('updated') ||
      lowerTitle.includes('verified') ||
      lowerTitle.includes('cleared');

    const isWarning =
      alertConfig.type === 'warning' ||
      lowerTitle.includes('warning') ||
      lowerTitle.includes('required') ||
      lowerTitle.includes('notice') ||
      lowerTitle.includes('attention');

    if (isDestructive) {
      return {
        icon: lowerTitle.includes('delete') ? <Trash2 size={24} color={colors.danger} /> : <AlertTriangle size={24} color={colors.danger} />,
        badgeBg: `${colors.danger}15`,
        borderColor: `${colors.danger}35`,
        accentColor: colors.danger,
      };
    }

    if (isSuccess) {
      return {
        icon: <CheckCircle2 size={24} color={colors.success} />,
        badgeBg: `${colors.success}15`,
        borderColor: `${colors.success}35`,
        accentColor: colors.success,
      };
    }

    if (isWarning) {
      return {
        icon: <AlertCircle size={24} color={colors.warning} />,
        badgeBg: `${colors.warning}15`,
        borderColor: `${colors.warning}35`,
        accentColor: colors.warning,
      };
    }

    return {
      icon: <Shield size={24} color={colors.primary} />,
      badgeBg: `${colors.primary}15`,
      borderColor: `${colors.primary}35`,
      accentColor: colors.primary,
    };
  };

  const { icon, badgeBg, borderColor, accentColor } = getAlertDetails();

  const buttons = alertConfig?.buttons && alertConfig.buttons.length > 0
    ? alertConfig.buttons
    : [{ text: 'OK', style: 'default' as const }];

  const isMultiple = buttons.length > 2;

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      {visible && (
        <Modal
          transparent
          visible={visible}
          animationType="none"
          onRequestClose={hideAlert}
        >
          <View style={styles.overlay}>
            <Animated.View
              style={[
                styles.backdrop,
                { opacity: fadeAnim }
              ]}
              // @ts-ignore
              onClick={hideAlert}
            />

            <Animated.View
              style={[
                styles.dialogCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }],
                  shadowColor: colors.shadow,
                },
              ]}
            >
              {/* Close X */}
              <TouchableOpacity
                onPress={hideAlert}
                style={styles.closeBtn}
                activeOpacity={0.7}
              >
                <X size={18} color={colors.textTertiary} />
              </TouchableOpacity>

              {/* Icon Badge */}
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: badgeBg, borderColor }
                ]}
              >
                {icon}
              </View>

              {/* Title */}
              <Text style={[styles.title, { color: colors.text }]}>
                {alertConfig?.title}
              </Text>

              {/* Message */}
              {!!alertConfig?.message && (
                <Text style={[styles.message, { color: colors.textSecondary }]}>
                  {alertConfig.message}
                </Text>
              )}

              {/* Buttons */}
              <View
                style={[
                  styles.buttonsContainer,
                  isMultiple ? styles.buttonsColumn : styles.buttonsRow,
                ]}
              >
                {buttons.map((btn, index) => {
                  const isCancel = btn.style === 'cancel';
                  const isDestructive = btn.style === 'destructive';

                  let btnBg = colors.primary;
                  let textColor = '#FFFFFF';
                  let btnBorder = 'transparent';

                  if (isCancel) {
                    btnBg = colors.cardAlt;
                    textColor = colors.textSecondary;
                    btnBorder = colors.border;
                  } else if (isDestructive) {
                    btnBg = colors.danger;
                    textColor = '#FFFFFF';
                  }

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.button,
                        !isMultiple && { flex: 1 },
                        {
                          backgroundColor: btnBg,
                          borderColor: btnBorder,
                          borderWidth: isCancel ? 1 : 0,
                        },
                      ]}
                      activeOpacity={0.85}
                      onPress={() => {
                        hideAlert();
                        if (btn.onPress) {
                          setTimeout(() => {
                            btn.onPress?.();
                          }, 100);
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          {
                            color: textColor,
                            fontWeight: isCancel ? FontWeight.medium : FontWeight.semibold,
                          },
                        ]}
                      >
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}
    </AlertContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    zIndex: 99999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  dialogCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: BorderRadius.xl,
    padding: Spacing['2xl'],
    borderWidth: 1.2,
    alignItems: 'center',
    position: 'relative',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
    zIndex: 100000,
  },
  closeBtn: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    padding: 6,
    borderRadius: BorderRadius.full,
    zIndex: 10,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: Spacing.lg,
    marginTop: Spacing.xs,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    letterSpacing: -0.2,
  },
  message: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  buttonsContainer: {
    width: '100%',
    gap: Spacing.md,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonsColumn: {
    flexDirection: 'column',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  buttonText: {
    fontSize: FontSize.sm,
    letterSpacing: 0.2,
  },
});
