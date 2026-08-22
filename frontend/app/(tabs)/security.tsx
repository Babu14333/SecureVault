import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/useTheme';
import SecurityCard from '../../src/components/ui/SecurityCard';
import { Spacing, FontSize, FontWeight, BorderRadius } from '../../src/theme/tokens';
import { securityAPI, authAPI } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Lock,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  TrendingUp,
} from 'lucide-react-native';

const TABS = ['Overview', 'Sessions', 'Logs', 'Alerts'];

interface Session {
  id: string;
  device: string;
  ipAddress: string;
  location?: string;
  lastActive: string;
  isCurrent: boolean;
}

interface SecurityLog {
  id: string;
  action: string;
  ipAddress: string;
  createdAt: string;
  details?: any;
}

interface AlertItem {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'resolved';
  description?: string;
  message?: string;
  isRead?: boolean;
  createdAt: string;
}

export default function SecurityScreen() {
  const { colors } = useTheme();
  const { user, setUser, sessionId } = useAuthStore();
  const [activeTab, setActiveTab] = useState('Overview');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Live security state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [stats, setStats] = useState({
    securityScore: 50,
    loginAttempts: 0,
    failedAttempts: 0,
  });

  const getScoreDetails = (score: number) => {
    if (score >= 90) {
      return {
        label: 'Excellent',
        color: colors.success, // Emerald Teal
        bgColor: `${colors.success}15`,
        desc: 'Enterprise-grade protection. Active policies are fully enforced.',
        recommendation: 'Excellent security! Your account is fully protected under advanced threat policies.',
      };
    }
    if (score >= 70) {
      return {
        label: 'Secure',
        color: colors.success, // Emerald Green
        bgColor: `${colors.success}15`,
        desc: 'Highly secured. Zero-knowledge encryption and session telemetry are active.',
        recommendation: 'Nearly perfect! Upload an encrypted file or create a temporary secure link to boost your score to Excellent.',
      };
    }
    if (score >= 50) {
      return {
        label: 'Moderate',
        color: colors.warning, // Warm Yellow/Amber
        bgColor: `${colors.warning}15`,
        desc: 'Standard protection. Recommend setting strong passwords and OTP link transfers.',
        recommendation: 'Enhance transfer security. Enable OTP-protected sharing for better file transfer security.',
      };
    }
    if (score >= 30) {
      return {
        label: 'Risky',
        color: colors.warning, // Orange
        bgColor: `${colors.warning}15`,
        desc: 'Warning. Lower trust level. Suspicious logins possible.',
        recommendation: 'Your account protection is low. Add a recovery phone number to enable suspicious device logins.',
      };
    }
    return {
      label: 'Critical',
      color: colors.danger, // Critical Red
      bgColor: `${colors.danger}15`,
      desc: 'Danger. Suspicious activity patterns detected on your account.',
      recommendation: 'Suspicious activity detected! Review recent access logs immediately and revoke unfamiliar active sessions.',
    };
  };

  const getEventName = (action: string, details: any) => {
    if (details && details.eventType) {
      return details.eventType.replace(/_/g, ' ').replace(/\b\w/g, (c: any) => c.toUpperCase());
    }
    return action.replace(/_/g, ' ').replace(/\b\w/g, (c: any) => c.toUpperCase());
  };

  const fetchSecurityData = async () => {
    try {
      // Fetch Latest Profile for Security Score
      const profileRes = await authAPI.getProfile();
      if (profileRes.data.success) {
        const p = profileRes.data.data;
        setUser(p);
        setStats(prev => ({
          ...prev,
          securityScore: p.securityScore || 50,
        }));
      }

      // Fetch Sessions
      const sessionsRes = await securityAPI.getSessions();
      if (sessionsRes.data.success) {
        const mappedSessions = (sessionsRes.data.data || []).map((s: any) => ({
          id: s.id,
          device: s.deviceInfo || 'Unknown Device',
          ipAddress: s.ipAddress,
          lastActive: s.createdAt,
          isCurrent: s.id === sessionId,
        }));
        setSessions(mappedSessions);
      }

      // Fetch Logs
      const logsRes = await securityAPI.getLogs({ limit: 30 });
      if (logsRes.data.success) {
        const liveLogs = logsRes.data.data || [];
        setLogs(liveLogs);
        
        // Compute simple stats from logs
        const logins = liveLogs.filter((l: any) => l.action.startsWith('login'));
        const failed = liveLogs.filter((l: any) => l.action === 'login_failed');
        setStats(prev => ({
          ...prev,
          loginAttempts: logins.length,
          failedAttempts: failed.length,
        }));
      }

      // Fetch Alerts
      const alertsRes = await securityAPI.getAlerts();
      if (alertsRes.data.success) {
        setAlerts(alertsRes.data.data || []);
      }

    } catch (error) {
      console.warn('Security Center fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchSecurityData();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSecurityData();
  }, []);

  const handleRevokeSession = (sessionId: string, deviceName: string) => {
    Alert.alert(
      'Revoke Session',
      `Are you sure you want to log out of "${deviceName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await securityAPI.terminateSession(sessionId);
              if (res.data.success) {
                Alert.alert('Success', 'Session revoked successfully');
                fetchSecurityData();
              }
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Could not revoke session');
            }
          },
        },
      ]
    );
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'warning':
      case 'medium':
        return colors.warning;
      case 'critical':
      case 'high':
        return colors.danger;
      default:
        return colors.success;
    }
  };

  const renderOverview = () => {
    const details = getScoreDetails(stats.securityScore);
    const hasPhone = !!user?.phone;

    return (
      <View style={{ gap: Spacing.xl }}>
        {/* Dynamic Security Score Gauge Card */}
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: BorderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: Spacing.xl,
            alignItems: 'center',
            shadowColor: details.color,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          {/* Radial score representation */}
          <View
            style={{
              width: 130,
              height: 130,
              borderRadius: 65,
              borderWidth: 6,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              backgroundColor: `${colors.background}40`,
            }}
          >
            {/* Dynamic gauge outline overlay */}
            <View
              style={{
                position: 'absolute',
                top: -6,
                left: -6,
                right: -6,
                bottom: -6,
                borderRadius: 71,
                borderWidth: 6,
                borderColor: details.color,
                opacity: 0.3,
              }}
            />
            
            <Text style={{ fontSize: FontSize['4xl'], fontWeight: FontWeight.bold, color: colors.text }}>
              {stats.securityScore}
            </Text>
            <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, marginTop: -4 }}>
              / 100
            </Text>
          </View>

          {/* Security Status Badge */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: details.bgColor,
              paddingHorizontal: Spacing.lg,
              paddingVertical: Spacing.sm - 2,
              borderRadius: BorderRadius.full,
              marginTop: Spacing.lg,
              gap: Spacing.sm - 2,
            }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: details.color }} />
            <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: details.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Status: {details.label}
            </Text>
          </View>

          <Text style={{ fontSize: FontSize.sm, color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.md, lineHeight: 18 }}>
            {details.desc}
          </Text>
        </View>

        {/* Dynamic Context Recommendations Alert */}
        <View
          style={{
            backgroundColor: `${details.color}08`,
            borderRadius: BorderRadius.lg,
            borderWidth: 1,
            borderColor: `${details.color}20`,
            padding: Spacing.lg,
            flexDirection: 'row',
            gap: Spacing.md,
            alignItems: 'flex-start',
          }}
        >
          {stats.securityScore < 50 ? (
            <ShieldAlert size={20} color={details.color} style={{ marginTop: 2 }} />
          ) : (
            <ShieldCheck size={20} color={details.color} style={{ marginTop: 2 }} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.text, marginBottom: 4 }}>
              Security Advisor
            </Text>
            <Text style={{ fontSize: FontSize.sm, color: colors.textSecondary, lineHeight: 18 }}>
              {details.recommendation}
            </Text>
          </View>
        </View>

        {/* Security Checklist Widget */}
        <SecurityCard title="Security Diagnostics" subtitle="Dynamic protection parameters">
          {[
            {
              label: 'Client-Side Encryption',
              status: true,
              desc: 'Files are encrypted on-device before sync.',
            },
            {
              label: 'Two-Factor Suspicious Login Gate',
              status: hasPhone,
              desc: hasPhone ? 'Active using Twilio phone verification OTP.' : 'Low trust. Set registered phone number in profile settings.',
            },
            {
              label: 'Active System Threat Monitoring',
              status: stats.securityScore >= 50,
              desc: stats.securityScore >= 50 ? 'Real-time suspicious login logs.' : 'High warning. Low trust score compromises security.',
            },
            {
              label: 'Access Logs Verification',
              status: user?.isVerified || false,
              desc: user?.isVerified ? 'Fully verified access controls.' : 'Unverified account credentials.',
            },
          ].map((check, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                paddingVertical: Spacing.md,
                borderBottomWidth: i < 3 ? 1 : 0,
                borderBottomColor: colors.border,
                gap: Spacing.md,
              }}
            >
              <View style={{ marginTop: 2 }}>
                {check.status ? (
                  <CheckCircle2 size={18} color={colors.success} />
                ) : (
                  <AlertTriangle size={18} color={colors.warning} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.text }}>
                  {check.label}
                </Text>
                <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 2 }}>
                  {check.desc}
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: Spacing.sm,
                  paddingVertical: 2,
                  borderRadius: BorderRadius.sm,
                  backgroundColor: check.status ? `${colors.success}10` : `${colors.warning}10`,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: FontWeight.semibold, color: check.status ? colors.success : colors.warning }}>
                  {check.status ? 'ACTIVE' : 'WARNING'}
                </Text>
              </View>
            </View>
          ))}
        </SecurityCard>

        {/* Real-time Security Events Log Widget */}
        <SecurityCard title="Recent Security Activity" subtitle="Verified database occurrences">
          {logs.filter(l => l.action.startsWith('security') || l.action.startsWith('login') || l.action.startsWith('file_upload') || l.action.startsWith('failed') || l.action.startsWith('otp_verification')).slice(0, 3).length === 0 ? (
            <Text style={{ color: colors.textTertiary, paddingVertical: Spacing.xl, textAlign: 'center' }}>
              No recent security activity logged.
            </Text>
          ) : (
            logs
              .filter(l => l.action.startsWith('security') || l.action.startsWith('login') || l.action.startsWith('file_upload') || l.action.startsWith('failed') || l.action.startsWith('otp_verification'))
              .slice(0, 3)
              .map((log, i, arr) => {
                const isPositive = log.action === 'security_score_increase' || log.action === 'login_success' || log.action === 'otp_verification';
                const isScoreUpdate = log.action.includes('security_score');
                const delta = log.details?.delta;
                
                return (
                  <View
                    key={log.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: Spacing.md,
                      borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: isPositive ? `${colors.success}15` : `${colors.danger}15`,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: Spacing.md,
                      }}
                    >
                      {isPositive ? (
                        <ShieldCheck size={16} color={colors.success} />
                      ) : (
                        <ShieldAlert size={16} color={colors.danger} />
                      )}
                    </View>
                    
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: colors.text }}>
                        {getEventName(log.action, log.details)}
                      </Text>
                      <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 2 }}>
                        {new Date(log.createdAt).toLocaleDateString()} at {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>

                    {isScoreUpdate && delta && (
                      <View
                        style={{
                          backgroundColor: isPositive ? `${colors.success}10` : `${colors.danger}10`,
                          paddingHorizontal: Spacing.sm,
                          paddingVertical: 2,
                          borderRadius: BorderRadius.sm,
                        }}
                      >
                        <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: isPositive ? colors.success : colors.danger }}>
                          {isPositive ? `+${delta}` : `-${delta}`}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
          )}
        </SecurityCard>

        {/* Quick Stats Grid */}
        <View style={{ flexDirection: 'row', gap: Spacing.md }}>
          {[
            { label: 'Login Events', value: String(stats.loginAttempts), sub: 'Logged logins' },
            { label: 'Suspicious attempts', value: String(stats.failedAttempts), sub: 'Blocked threats' },
          ].map((stat, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                backgroundColor: colors.card,
                borderRadius: BorderRadius.lg,
                padding: Spacing.lg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat.label}</Text>
              <Text style={{ fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: colors.text, marginTop: 4 }}>{stat.value}</Text>
              <Text style={{ fontSize: FontSize.xs, color: colors.textTertiary, marginTop: 2 }}>{stat.sub}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderSessions = () => (
    <SecurityCard title="Active Sessions" subtitle={`${sessions.length} sessions`}>
      {sessions.length === 0 ? (
        <Text style={{ color: colors.textTertiary, paddingVertical: Spacing.xl, textAlign: 'center' }}>
          No active sessions found.
        </Text>
      ) : (
        sessions.map((session, i) => (
          <View
            key={session.id}
            style={{
              paddingVertical: Spacing.lg,
              borderBottomWidth: i < sessions.length - 1 ? 1 : 0,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.medium, color: colors.text }}>
                    {session.device || 'Unknown Device'}
                  </Text>
                  {session.isCurrent && (
                    <View style={{ marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: `${colors.success}15` }}>
                      <Text style={{ fontSize: 10, color: colors.success, fontWeight: '600' }}>Current</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>
                  IP: {session.ipAddress}
                </Text>
                <Text style={{ fontSize: FontSize.xs, color: colors.textTertiary, marginTop: 2 }}>
                  Last active: {new Date(session.lastActive).toLocaleString()}
                </Text>
              </View>
              {!session.isCurrent && (
                <TouchableOpacity
                  onPress={() => handleRevokeSession(session.id, session.device)}
                  style={{
                    paddingHorizontal: Spacing.md,
                    paddingVertical: Spacing.sm,
                    borderRadius: BorderRadius.sm,
                    borderWidth: 1,
                    borderColor: colors.danger,
                  }}
                >
                  <Text style={{ fontSize: FontSize.xs, color: colors.danger, fontWeight: FontWeight.medium }}>
                    Revoke
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))
      )}
    </SecurityCard>
  );

  const renderLogs = () => (
    <SecurityCard title="Access Logs">
      {logs.length === 0 ? (
        <Text style={{ color: colors.textTertiary, paddingVertical: Spacing.xl, textAlign: 'center' }}>
          No access logs recorded yet.
        </Text>
      ) : (
        logs.map((log, i) => (
          <View
            key={log.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: Spacing.md,
              borderBottomWidth: i < logs.length - 1 ? 1 : 0,
              borderBottomColor: colors.border,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: log.action.includes('failed') || log.action.includes('decrease') ? colors.danger : colors.success,
                marginRight: Spacing.md,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FontSize.sm, color: colors.text, fontWeight: FontWeight.medium }}>
                {getEventName(log.action, log.details)}
              </Text>
              <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>
                IP: {log.ipAddress || '127.0.0.1'}
              </Text>
            </View>
            <Text style={{ fontSize: FontSize.xs, color: colors.textTertiary }}>
              {new Date(log.createdAt).toLocaleDateString()}
            </Text>
          </View>
        ))
      )}
    </SecurityCard>
  );

  const renderAlerts = () => {
    const activeAlerts = alerts.filter(a => a.status === 'open' || !a.isRead);

    return (
      <SecurityCard title="Security Threats & Alerts">
        {activeAlerts.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: Spacing['4xl'] }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: `${colors.success}15`,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: Spacing.lg,
              }}
            >
              <Text style={{ fontSize: 20, color: colors.success }}>✓</Text>
            </View>
            <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.text, marginBottom: 4 }}>
              All Clear
            </Text>
            <Text style={{ fontSize: FontSize.sm, color: colors.textSecondary, textAlign: 'center' }}>
              No open security alerts at this time. Your account is completely secure.
            </Text>
          </View>
        ) : (
          activeAlerts.map((alert, i) => (
            <View
              key={alert.id}
              style={{
                paddingVertical: Spacing.lg,
                borderBottomWidth: i < activeAlerts.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.bold, color: getSeverityColor(alert.severity) }}>
                  {alert.type.replace(/_/g, ' ').toUpperCase()}
                </Text>
                <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: `${getSeverityColor(alert.severity)}15` }}>
                  <Text style={{ fontSize: FontSize.xs, color: getSeverityColor(alert.severity), fontWeight: '600', textTransform: 'capitalize' }}>
                    {alert.severity}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: FontSize.sm, color: colors.text, marginBottom: 4 }}>
                {alert.message}
              </Text>
              <Text style={{ fontSize: FontSize.xs, color: colors.textTertiary }}>
                Detected: {new Date(alert.createdAt).toLocaleString()}
              </Text>
            </View>
          ))
        )}
      </SecurityCard>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {loading && !refreshing ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          <Text style={{ fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.text, marginBottom: Spacing.lg }}>
            Security Center
          </Text>

          {/* Tabs */}
          <View style={{ flexDirection: 'row', marginBottom: Spacing['2xl'], gap: 2, backgroundColor: colors.card, borderRadius: BorderRadius.md, padding: 3, borderWidth: 1, borderColor: colors.border }}>
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  paddingVertical: Spacing.sm + 2,
                  borderRadius: BorderRadius.sm,
                  backgroundColor: activeTab === tab ? colors.primary : 'transparent',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: FontSize.sm,
                    fontWeight: FontWeight.medium,
                    color: activeTab === tab ? '#FFFFFF' : colors.textSecondary,
                  }}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'Overview' && renderOverview()}
          {activeTab === 'Sessions' && renderSessions()}
          {activeTab === 'Logs' && renderLogs()}
          {activeTab === 'Alerts' && renderAlerts()}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
