import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { setServerUrl, testServerUrls, DEFAULT_PORT } from '../../services/api';
import { Spacing, FontSize, FontWeight, BorderRadius } from '../../theme/tokens';

interface Props {
  onConnected: () => void;
}

export default function ServerSetupScreen({ onConnected }: Props) {
  const { colors } = useTheme();
  const [ip, setIp] = useState('');
  const [port, setPort] = useState(DEFAULT_PORT);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const buildUrl = (portOverride?: string) => {
    let cleanIp = ip.trim();
    const cleanPort = (portOverride ?? port).trim() || DEFAULT_PORT;

    // Remove trailing slashes and '/api' or '/api/health' suffixes if copy-pasted
    cleanIp = cleanIp.replace(/\/+$/, '').replace(/\/api\/health$/, '').replace(/\/api$/, '');

    // If it is an ngrok tunnel, it uses standard HTTPS (port 443 / no port suffix needed)
    if (cleanIp.includes('ngrok')) {
      if (cleanIp.startsWith('http://') || cleanIp.startsWith('https://')) {
        return cleanIp.replace('http://', 'https://'); // Force HTTPS for ngrok
      }
      return `https://${cleanIp}`;
    }

    if (cleanIp.startsWith('http://') || cleanIp.startsWith('https://')) {
      const hasPort = cleanIp.split('//')[1]?.includes(':');
      if (hasPort) return cleanIp;
      return `${cleanIp}:${cleanPort}`;
    }

    return `http://${cleanIp}:${cleanPort}`;
  };

  const handleConnect = async () => {
    const cleanIp = ip.trim();
    if (!cleanIp) {
      setErrorMsg('Please enter the server IP address');
      setStatus('error');
      return;
    }

    setTesting(true);
    setStatus('idle');
    setErrorMsg('');

    const candidateUrls = [buildUrl(), buildUrl(DEFAULT_PORT), buildUrl('5001')].filter(
      (value, index, array) => array.indexOf(value) === index
    );
    const reachableUrl = await testServerUrls(candidateUrls);

    if (reachableUrl) {
      await setServerUrl(reachableUrl);
      setStatus('success');
      setTimeout(() => onConnected(), 800);
    } else {
      const primaryUrl = candidateUrls[0];
      setStatus('error');
      setErrorMsg(`Cannot reach server at ${primaryUrl}\nMake sure:\n• Server is running\n• Phone & PC on same WiFi\n• IP address is correct`);
    }

    setTesting(false);
  };

  const statusColor =
    status === 'success' ? colors.success :
    status === 'error' ? colors.danger :
    colors.textTertiary;

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
        <View style={{ width: '100%', maxWidth: 420 }}>
          {/* ─── Logo ─── */}
          <View style={{ alignItems: 'center', marginBottom: Spacing['4xl'] }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: Spacing.xl,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.4,
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            {/* Server icon — 3 stacked lines */}
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={{
                  width: 36,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  marginVertical: 2,
                }}
              />
            ))}
          </View>

          <Text
            style={{
              fontSize: FontSize['2xl'],
              fontWeight: FontWeight.bold,
              color: colors.text,
              marginBottom: Spacing.xs,
            }}
          >
            Connect to Server
          </Text>
          <Text
            style={{
              fontSize: FontSize.md,
              color: colors.textSecondary,
              textAlign: 'center',
              lineHeight: 22,
            }}
          >
            Enter your server's IP address.{'\n'}You only need to do this once.
          </Text>
        </View>

        {/* ─── Form Card ─── */}
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: BorderRadius.xl,
            padding: Spacing['3xl'],
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: Spacing['2xl'],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 4,
          }}
        >
          {/* IP Address */}
          <Text
            style={{
              fontSize: FontSize.sm,
              fontWeight: FontWeight.semibold,
              color: colors.textSecondary,
              marginBottom: Spacing.sm,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
            }}
          >
            Server IP Address
          </Text>
          <TextInput
            value={ip}
            onChangeText={(t) => { setIp(t); setStatus('idle'); }}
            placeholder="e.g. 192.168.1.100"
            placeholderTextColor={colors.textTertiary}
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              backgroundColor: colors.inputBg,
              borderWidth: 1.5,
              borderColor: status === 'error' ? colors.danger : status === 'success' ? colors.success : colors.border,
              borderRadius: BorderRadius.md,
              padding: Spacing.lg,
              fontSize: FontSize.lg,
              color: colors.text,
              marginBottom: Spacing.xl,
              fontWeight: FontWeight.medium,
            }}
          />

          {/* Port */}
          <Text
            style={{
              fontSize: FontSize.sm,
              fontWeight: FontWeight.semibold,
              color: colors.textSecondary,
              marginBottom: Spacing.sm,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
            }}
          >
            Port
          </Text>
          <TextInput
            value={port}
            onChangeText={(t) => { setPort(t); setStatus('idle'); }}
            placeholder="5001"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
            style={{
              backgroundColor: colors.inputBg,
              borderWidth: 1.5,
              borderColor: colors.border,
              borderRadius: BorderRadius.md,
              padding: Spacing.lg,
              fontSize: FontSize.lg,
              color: colors.text,
              marginBottom: Spacing['2xl'],
            }}
          />

          {/* URL Preview */}
          {ip.trim().length > 0 && (
            <View
              style={{
                backgroundColor: `${colors.primary}10`,
                borderRadius: BorderRadius.sm,
                padding: Spacing.md,
                marginBottom: Spacing['2xl'],
                borderLeftWidth: 3,
                borderLeftColor: colors.primary,
              }}
            >
              <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, marginBottom: 2 }}>
                Will connect to:
              </Text>
              <Text style={{ fontSize: FontSize.sm, color: colors.primary, fontWeight: FontWeight.semibold }}>
                {buildUrl()}
              </Text>
            </View>
          )}

          {/* Connect Button */}
          <TouchableOpacity
            onPress={handleConnect}
            disabled={testing}
            activeOpacity={0.85}
            style={{
              backgroundColor: status === 'success' ? colors.success : colors.primary,
              borderRadius: BorderRadius.md,
              padding: Spacing.lg,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: Spacing.sm,
              opacity: testing ? 0.7 : 1,
            }}
          >
            {testing ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={{ color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.semibold }}>
                  Testing connection...
                </Text>
              </>
            ) : status === 'success' ? (
              <Text style={{ color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.semibold }}>
                ✓ Connected! Entering app...
              </Text>
            ) : (
              <Text style={{ color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.semibold }}>
                Connect to Server
              </Text>
            )}
          </TouchableOpacity>

          {/* Error message */}
          {status === 'error' && errorMsg ? (
            <View
              style={{
                marginTop: Spacing.lg,
                backgroundColor: `${colors.danger}12`,
                borderRadius: BorderRadius.sm,
                padding: Spacing.md,
                borderLeftWidth: 3,
                borderLeftColor: colors.danger,
              }}
            >
              <Text style={{ fontSize: FontSize.sm, color: colors.danger, lineHeight: 20 }}>
                {errorMsg}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ─── Help text ─── */}
        <View
          style={{
            backgroundColor: colors.cardAlt,
            borderRadius: BorderRadius.md,
            padding: Spacing.lg,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.text, marginBottom: Spacing.sm }}>
            How to find the server IP:
          </Text>
          {[
            '1. On the server laptop, open Command Prompt',
            '2. Type: ipconfig',
            '3. Look for "IPv4 Address" under Wi-Fi',
            '4. Enter that IP here (e.g. 192.168.1.100)',
            '5. Make sure phone & laptop are on same WiFi',
          ].map((line, i) => (
            <Text key={i} style={{ fontSize: FontSize.xs, color: colors.textSecondary, lineHeight: 20 }}>
              {line}
            </Text>
          ))}
        </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
