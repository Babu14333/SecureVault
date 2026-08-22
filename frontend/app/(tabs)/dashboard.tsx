import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { 
  LayoutDashboard,
  ShieldCheck, 
  Users,
  Folder,
  Link2,
  AlertTriangle,
  Trash2,
  ShieldAlert,
  CheckCircle2,
  Ban,
  Shield,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Globe,
  RefreshCw,
  Search,
  ChevronRight,
  Sparkles,
  UserCheck,
  UserX,
  HardDrive,
  Activity,
  Lock,
  Clock,
  ArrowUpRight,
  Sliders,
  Radio,
  FileSpreadsheet,
  AlertOctagon,
  Eye,
  KeyRound,
  FileCheck,
  FileX,
  ShieldOff,
  LogOut,
  X,
  Zap,
  SlidersHorizontal,
  Upload,
  FolderLock
} from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme';
import { useAuthStore } from '../../src/store/authStore';
import SecurityCard from '../../src/components/ui/SecurityCard';
import SecureButton from '../../src/components/ui/SecureButton';
import SecureInput from '../../src/components/ui/SecureInput';
import { Spacing, FontSize, FontWeight, BorderRadius } from '../../src/theme/tokens';
import { filesAPI, securityAPI, adminAPI, sharingAPI } from '../../src/services/api';

const { width } = Dimensions.get('window');

// ─── Utility Helpers ──────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(isoStr: string): string {
  if (!isoStr) return 'Never';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoStr;
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { colors } = useTheme();
  const { user } = useAuthStore();

  const isDedicatedAdmin = user?.role === 'admin' || user?.email?.toLowerCase() === 'nagababuy92@gmail.com';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Admin SOC Sub-Navigation Tabs:
  // 'overview' | 'users' | 'files' | 'threats' | 'sharing' | 'logs' | 'policies'
  const [adminTab, setAdminTab] = useState<'overview' | 'users' | 'files' | 'threats' | 'sharing' | 'logs' | 'policies'>('overview');

  // ─── Personal User State ───────────────────────────────────────────────────
  const [personalStats, setPersonalStats] = useState({
    totalFiles: 0,
    sharedCount: 0,
    sessionsCount: 0,
    alertsCount: 0,
    storageUsed: 0,
    storageLimit: 5368709120,
    securityScore: 70,
  });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  // ─── SOC Data States ───────────────────────────────────────────────────────
  const [overviewData, setOverviewData] = useState<any>(null);
  const [liveStream, setLiveStream] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [filesList, setFilesList] = useState<any[]>([]);
  const [alertsList, setAlertsList] = useState<any[]>([]);
  const [sharingList, setSharingList] = useState<any[]>([]);
  const [accessLogs, setAccessLogs] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any>({
    maxLoginAttempts: 5,
    otpExpirySeconds: 300,
    maxSharingDurationDays: 7,
    maxDownloadCount: 10,
    sessionTimeoutHours: 168,
    suspiciousDownloadThreshold: 15,
    maxUploadSizeBytes: 52428800,
  });

  // Search & Filter inputs
  const [userSearch, setUserSearch] = useState('');
  const [fileSearch, setFileSearch] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [logActionFilter, setLogActionFilter] = useState('all');
  const [alertSeverityFilter, setAlertSeverityFilter] = useState('all');

  // Modals
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [incidentLoading, setIncidentLoading] = useState(false);
  const [selectedUserDetail, setSelectedUserDetail] = useState<any>(null);
  const [userSessions, setUserSessions] = useState<any[]>([]);

  // ── Personal Fetch ─────────────────────────────────────────────────────────
  const fetchPersonalData = async () => {
    try {
      const [statsResult, alertsResult] = await Promise.allSettled([
        filesAPI.getStats(),
        securityAPI.getAlerts(),
      ]);

      if (statsResult.status === 'fulfilled' && statsResult.value.data.success) {
        const d = statsResult.value.data.data;
        const usedStorage = (typeof d.storage === 'object' && d.storage?.used !== undefined)
          ? d.storage.used
          : (d.totalSize ?? d.storageUsed ?? 0);
        const shares = d.sharedFiles ?? d.sharedCount ?? d.activeShares ?? 0;
        const total = d.totalFiles ?? d.filesCount ?? 0;

        setPersonalStats((prev) => ({
          ...prev,
          totalFiles: total,
          sharedCount: shares,
          storageUsed: usedStorage,
          securityScore: d.securityScore ?? prev.securityScore,
        }));
      }

      try {
        const sharesRes = await sharingAPI.getLinks();
        if (sharesRes.data.success) {
          const links = sharesRes.data.data || [];
          const activeCount = links.filter((l: any) => l.isActive).length;
          setPersonalStats((prev) => ({
            ...prev,
            sharedCount: activeCount,
          }));
        }
      } catch {}

      if (alertsResult.status === 'fulfilled' && alertsResult.value.data.success) {
        const d = alertsResult.value.data.data;
        setPersonalStats((prev) => ({
          ...prev,
          alertsCount: d.alerts?.filter((a: any) => !a.isRead)?.length ?? 0,
        }));
      }

      try {
        const secRes = await securityAPI.getSessions();
        if (secRes.data.success) {
          setPersonalStats((prev) => ({
            ...prev,
            sessionsCount: secRes.data.data?.length ?? 1,
          }));
        }
      } catch {}

      try {
        const actRes = await securityAPI.getLogs();
        if (actRes.data.success) {
          setRecentActivities((actRes.data.data?.logs || []).slice(0, 6));
        }
      } catch {}
    } catch (e) {
      console.warn('Error fetching personal dashboard data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ── Admin Fetch based on active tab ────────────────────────────────────────
  const fetchAdminData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      if (adminTab === 'overview') {
        const [ovRes, stRes] = await Promise.allSettled([
          adminAPI.getOverview(),
          adminAPI.getLiveStream({ limit: 15 }),
        ]);
        if (ovRes.status === 'fulfilled' && ovRes.value.data.success) setOverviewData(ovRes.value.data.data);
        if (stRes.status === 'fulfilled' && stRes.value.data.success) setLiveStream(stRes.value.data.data);
      } else if (adminTab === 'users') {
        const res = await adminAPI.getUsersMonitoring({ search: userSearch });
        if (res.data.success) setUsersList(res.data.data || []);
      } else if (adminTab === 'files') {
        const res = await adminAPI.getFilesMonitoring({ search: fileSearch });
        if (res.data.success) setFilesList(res.data.data || []);
      } else if (adminTab === 'threats') {
        const res = await adminAPI.getAlerts({ severity: alertSeverityFilter });
        if (res.data.success) setAlertsList(res.data.data || []);
      } else if (adminTab === 'sharing') {
        const res = await adminAPI.getSharingManagement();
        if (res.data.success) setSharingList(res.data.data || []);
      } else if (adminTab === 'logs') {
        const res = await adminAPI.getAccessLogs({ action: logActionFilter, search: logSearch, limit: 50 });
        if (res.data.success) setAccessLogs(res.data.data?.items || res.data.data || []);
      } else if (adminTab === 'policies') {
        const res = await adminAPI.getPolicies();
        if (res.data.success) setPolicies(res.data.data || {});
      }
    } catch (err) {
      console.warn('Failed to load admin SOC tab data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (isDedicatedAdmin) {
        fetchAdminData(false);
      } else {
        fetchPersonalData();
      }
    }, [isDedicatedAdmin, adminTab])
  );

  // Debounced search triggers
  useEffect(() => {
    if (isDedicatedAdmin) {
      const delay = setTimeout(() => {
        if (adminTab === 'users') fetchAdminData(false);
        if (adminTab === 'files') fetchAdminData(false);
        if (adminTab === 'logs') fetchAdminData(false);
        if (adminTab === 'threats') fetchAdminData(false);
      }, 300);
      return () => clearTimeout(delay);
    }
  }, [userSearch, fileSearch, logSearch, logActionFilter, alertSeverityFilter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (isDedicatedAdmin) {
      fetchAdminData(false);
    } else {
      fetchPersonalData();
    }
  }, [isDedicatedAdmin, adminTab]);

  // ── Incident Investigation Flow ───────────────────────────────────────────
  const openIncidentModal = async (alertItem: any) => {
    setIncidentLoading(true);
    try {
      const res = await adminAPI.getIncident(alertItem.id);
      if (res.data.success) {
        setSelectedIncident(res.data.data);
      } else {
        setSelectedIncident({ alert: alertItem, incidentId: alertItem.incidentId || 'SEC-ALERT', timeline: [] });
      }
    } catch {
      setSelectedIncident({ alert: alertItem, incidentId: alertItem.incidentId || 'SEC-ALERT', timeline: [] });
    } finally {
      setIncidentLoading(false);
    }
  };

  const handleRemediateIncident = async (actions: { blockUser?: boolean; revokeLinks?: boolean; terminateSessions?: boolean; markResolved?: boolean }) => {
    if (!selectedIncident?.alert) return;
    try {
      const res = await adminAPI.remediateIncident(selectedIncident.alert.id, {
        userId: selectedIncident.alert.user_id || selectedIncident.user?.id,
        ...actions,
      });
      if (res.data.success) {
        Alert.alert('Remediation Applied', 'Security actions executed and recorded in the audit log.');
        setSelectedIncident(null);
        fetchAdminData(false);
      }
    } catch (err: any) {
      Alert.alert('Action Failed', err.response?.data?.message || 'Failed to apply remediation.');
    }
  };

  // ── User Management Actions ────────────────────────────────────────────────
  const handleOpenUserDetail = async (u: any) => {
    setSelectedUserDetail(u);
    try {
      const res = await adminAPI.getUserSessions(u.id);
      if (res.data.success) setUserSessions(res.data.data || []);
      else setUserSessions(u.sessions || []);
    } catch {
      setUserSessions(u.sessions || []);
    }
  };

  const handleToggleUserSuspend = async (userId: string, currentlySuspended: boolean) => {
    Alert.alert(
      `${currentlySuspended ? 'Unsuspend' : 'Suspend'} User`,
      `Are you sure you want to ${currentlySuspended ? 'restore access for' : 'block'} this account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: currentlySuspended ? 'Unsuspend' : 'Suspend Account',
          style: currentlySuspended ? 'default' : 'destructive',
          onPress: async () => {
            try {
              const res = await adminAPI.suspendUser(userId, !currentlySuspended);
              if (res.data.success) {
                Alert.alert('Success', `User account ${currentlySuspended ? 'unsuspended' : 'suspended'}.`);
                fetchAdminData(false);
                if (selectedUserDetail) setSelectedUserDetail((prev: any) => ({ ...prev, is_suspended: !currentlySuspended }));
              }
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to update suspension.');
            }
          },
        },
      ]
    );
  };

  const handleRoleChange = (userId: string, currentRole: string) => {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin';
    Alert.alert(
      'Update User Role',
      `Change role from ${currentRole.toUpperCase()} to ${nextRole.toUpperCase()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Change to ${nextRole.toUpperCase()}`,
          onPress: async () => {
            try {
              const res = await adminAPI.updateRole(userId, nextRole);
              if (res.data.success) {
                Alert.alert('Role Updated', `Account role changed to ${nextRole}.`);
                fetchAdminData(false);
                if (selectedUserDetail) setSelectedUserDetail((prev: any) => ({ ...prev, role: nextRole }));
              }
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to update role.');
            }
          },
        },
      ]
    );
  };

  const handleRevokeUserSessions = async (userId: string) => {
    Alert.alert(
      'Terminate All Sessions',
      'This will immediately log the user out of all active web and mobile devices.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Terminate Sessions',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await adminAPI.revokeUserSessions(userId);
              if (res.data.success) {
                Alert.alert('Sessions Terminated', 'All active sessions for this account have been revoked.');
                setUserSessions([]);
                fetchAdminData(false);
              }
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to revoke sessions.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    Alert.alert(
      'Delete User Account',
      `Permanently delete account for "${userName || 'this user'}"? All stored files, vault keys, and records will be permanently erased in Supabase.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await adminAPI.deleteUser(userId);
              if (res.data.success) {
                Alert.alert('User Deleted', 'User account was permanently deleted from Supabase.');
                setSelectedUserDetail(null);
                fetchAdminData(false);
              }
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to delete user.');
            }
          },
        },
      ]
    );
  };

  const handleRevokeFileShares = async (fileId: string, fileName: string) => {
    Alert.alert(
      'Revoke File Sharing',
      `Are you sure you want to deactivate all active public sharing links for "${fileName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke Links',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await adminAPI.revokeFileSharing(fileId);
              if (res.data.success) {
                Alert.alert('Sharing Revoked', 'All active sharing links for this file have been disabled.');
                fetchAdminData(false);
              }
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to revoke file links.');
            }
          },
        },
      ]
    );
  };

  const handleRevokeSharedLink = async (linkId: string) => {
    Alert.alert(
      'Revoke Shared Link',
      'Deactivate this specific sharing link immediately?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke Link',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await adminAPI.revokeSharedLink(linkId);
              if (res.data.success) {
                Alert.alert('Revoked', 'The sharing link was deactivated.');
                fetchAdminData(false);
              }
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to revoke link.');
            }
          },
        },
      ]
    );
  };

  const handleSavePolicies = async () => {
    try {
      const res = await adminAPI.updatePolicies(policies);
      if (res.data.success) {
        Alert.alert('Policies Saved', 'Security policy thresholds and rules updated successfully.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update security policies.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ══════════════════════════════════════════════════════════════════
            CASE 1: REGULAR USER PERSONAL DASHBOARD
        ══════════════════════════════════════════════════════════════════ */}
        {!isDedicatedAdmin ? (
          <View style={{ maxWidth: 860, width: '100%', alignSelf: 'center' }}>
            {/* Header Greeting */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />
                  <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.success, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    Zero-Knowledge Vault Active
                  </Text>
                </View>
                <Text style={{ fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: colors.text }}>
                  Welcome, {user?.fullName || 'User'}
                </Text>
                <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 2 }}>
                  Your files are client-side encrypted with AES-256-GCM.
                </Text>
              </View>

              <TouchableOpacity
                onPress={onRefresh}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: BorderRadius.lg,
                  backgroundColor: colors.cardAlt,
                  borderWidth: 1.2,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RefreshCw size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* 4 Personal Metric Cards */}
            <View style={{ flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg }}>
              <View style={{ flex: 1, backgroundColor: colors.card, padding: Spacing.lg, borderRadius: BorderRadius.xl, borderWidth: 1.2, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, fontWeight: FontWeight.medium }}>Total Files</Text>
                  <FolderLock size={16} color={colors.primary} />
                </View>
                <Text style={{ fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: colors.text }}>
                  {personalStats.totalFiles}
                </Text>
                <Text style={{ fontSize: 11, color: colors.success, marginTop: 2 }}>Encrypted & Synchronized</Text>
              </View>

              <View style={{ flex: 1, backgroundColor: colors.card, padding: Spacing.lg, borderRadius: BorderRadius.xl, borderWidth: 1.2, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, fontWeight: FontWeight.medium }}>Active Shares</Text>
                  <Link2 size={16} color={colors.info} />
                </View>
                <Text style={{ fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: colors.text }}>
                  {personalStats.sharedCount}
                </Text>
                <Text style={{ fontSize: 11, color: colors.info, marginTop: 2 }}>Password/OTP Protected</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl }}>
              <View style={{ flex: 1, backgroundColor: colors.card, padding: Spacing.lg, borderRadius: BorderRadius.xl, borderWidth: 1.2, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, fontWeight: FontWeight.medium }}>Storage Consumed</Text>
                  <HardDrive size={16} color={colors.primary} />
                </View>
                <Text style={{ fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: colors.text }}>
                  {formatBytes(personalStats.storageUsed)}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>Limit: 5 GB Cloud Vault</Text>
              </View>

              <View style={{ flex: 1, backgroundColor: colors.card, padding: Spacing.lg, borderRadius: BorderRadius.xl, borderWidth: 1.2, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, fontWeight: FontWeight.medium }}>Security Score</Text>
                  <ShieldCheck size={16} color={colors.success} />
                </View>
                <Text style={{ fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: colors.success }}>
                  {user?.securityScore || 85}/100
                </Text>
                <Text style={{ fontSize: 11, color: colors.success, marginTop: 2 }}>Account Secure</Text>
              </View>
            </View>

            {/* Quick Action Buttons */}
            <View style={{ flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl }}>
              <TouchableOpacity
                onPress={() => router.push('/upload')}
                style={{
                  flex: 1,
                  backgroundColor: colors.primary,
                  paddingVertical: 14,
                  borderRadius: BorderRadius.xl,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Upload size={18} color="#FFFFFF" />
                <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#FFFFFF' }}>
                  Upload & Encrypt File
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/vault')}
                style={{
                  flex: 1,
                  backgroundColor: colors.cardAlt,
                  borderWidth: 1.2,
                  borderColor: colors.border,
                  paddingVertical: 14,
                  borderRadius: BorderRadius.xl,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <FolderLock size={18} color={colors.text} />
                <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.text }}>
                  Open Vault Files
                </Text>
              </TouchableOpacity>
            </View>

            {/* Recent Personal Activity */}
            <SecurityCard title="Recent Security Activity" badge="Audit Logs" badgeColor={colors.success}>
              {recentActivities.length === 0 ? (
                <Text style={{ color: colors.textTertiary, fontSize: FontSize.sm, textAlign: 'center', paddingVertical: 20 }}>
                  No recent activity recorded.
                </Text>
              ) : (
                <View style={{ gap: Spacing.sm, marginTop: Spacing.xs }}>
                  {recentActivities.map((log: any) => (
                    <View
                      key={log.id}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: colors.cardAlt,
                        padding: Spacing.md,
                        borderRadius: BorderRadius.lg,
                      }}
                    >
                      <View>
                        <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.text }}>
                          {log.action?.replace(/_/g, ' ')?.toUpperCase()}
                        </Text>
                        <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }}>
                          IP: {log.ip_address || '127.0.0.1'}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 10, color: colors.textTertiary }}>
                        {formatDate(log.created_at)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </SecurityCard>
          </View>
        ) : (
          // ══════════════════════════════════════════════════════════════════
          // CASE 2: DEDICATED ADMIN SECURITY OPERATIONS CENTER (SOC)
          // ══════════════════════════════════════════════════════════════════
          <View>
            {/* Top SOC Header Bar */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: Spacing.lg,
              }}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />
                  <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.success, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    ADMIN SECURITY OPERATIONS CENTER (SOC)
                  </Text>
                </View>
                <Text style={{ fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: colors.text, letterSpacing: -0.5 }}>
                  Central Security Governance
                </Text>
              </View>

              <TouchableOpacity
                onPress={onRefresh}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: BorderRadius.lg,
                  backgroundColor: colors.cardAlt,
                  borderWidth: 1.2,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RefreshCw size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Horizontal Scrollable SOC Navigation Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: Spacing.xs, paddingBottom: Spacing.lg }}
            >
              {[
                { key: 'overview', label: 'SOC Overview', icon: LayoutDashboard },
                { key: 'users', label: 'All Users Directory', icon: Users },
                { key: 'files', label: 'Encrypted Files', icon: Folder },
                { key: 'threats', label: 'Threat Center', icon: AlertTriangle },
                { key: 'sharing', label: 'Sharing Links', icon: Link2 },
                { key: 'logs', label: 'SIEM Access Logs', icon: FileSpreadsheet },
                { key: 'policies', label: 'Security Policies', icon: SlidersHorizontal },
              ].map((t) => {
                const isSelected = adminTab === t.key;
                const Icon = t.icon;
                return (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => setAdminTab(t.key as any)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      borderRadius: BorderRadius.full,
                      backgroundColor: isSelected ? colors.primary : colors.card,
                      borderWidth: 1.2,
                      borderColor: isSelected ? colors.primary : colors.border,
                      shadowColor: colors.shadow,
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.05,
                      shadowRadius: 4,
                    }}
                  >
                    <Icon size={14} color={isSelected ? '#FFFFFF' : colors.textSecondary} />
                    <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: isSelected ? '#FFFFFF' : colors.text }}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* TAB 1: SOC OVERVIEW */}
            {adminTab === 'overview' && (
              <View>
                {/* Master Security Status Indicator */}
                <View
                  style={{
                    backgroundColor: overviewData?.securityStatus === 'critical' ? colors.dangerBg : overviewData?.securityStatus === 'warning' ? colors.warningBg : colors.successBg,
                    borderWidth: 1.5,
                    borderColor: overviewData?.securityStatus === 'critical' ? colors.danger : overviewData?.securityStatus === 'warning' ? colors.warning : colors.success,
                    borderRadius: BorderRadius.xl,
                    padding: Spacing.lg,
                    marginBottom: Spacing.xl,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 }}>
                    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
                      {overviewData?.securityStatus === 'critical' ? (
                        <AlertOctagon size={22} color={colors.danger} />
                      ) : (
                        <ShieldCheck size={22} color={colors.success} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.text }}>
                        {overviewData?.statusMessage || '🟢 Security Monitoring Active'}
                      </Text>
                      <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 2 }}>
                        Automated zero-knowledge integrity & threat intelligence telemetry
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 2x2 Primary Security KPI Grid */}
                <View style={{ flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg }}>
                  <View style={{ flex: 1, backgroundColor: colors.card, padding: Spacing.lg, borderRadius: BorderRadius.xl, borderWidth: 1.2, borderColor: colors.border }}>
                    <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, fontWeight: FontWeight.medium }}>Managed Users</Text>
                    <Text style={{ fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: colors.text, marginVertical: 4 }}>
                      {overviewData?.users?.total ?? 0}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.primary }}>
                      {overviewData?.users?.active ?? 0} Active • {overviewData?.users?.suspended ?? 0} Suspended
                    </Text>
                  </View>

                  <View style={{ flex: 1, backgroundColor: colors.card, padding: Spacing.lg, borderRadius: BorderRadius.xl, borderWidth: 1.2, borderColor: colors.border }}>
                    <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, fontWeight: FontWeight.medium }}>Encrypted Vaults</Text>
                    <Text style={{ fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: colors.text, marginVertical: 4 }}>
                      {overviewData?.storage?.totalFiles ?? 0}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.success }}>
                      {formatBytes(overviewData?.storage?.totalBytes ?? 0)} Stored
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl }}>
                  <View style={{ flex: 1, backgroundColor: colors.card, padding: Spacing.lg, borderRadius: BorderRadius.xl, borderWidth: 1.2, borderColor: colors.border }}>
                    <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, fontWeight: FontWeight.medium }}>Today's Activity</Text>
                    <Text style={{ fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: colors.text, marginVertical: 4 }}>
                      {(overviewData?.activity?.uploadsToday ?? 0) + (overviewData?.activity?.downloadsToday ?? 0)}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.info }}>
                      {overviewData?.activity?.uploadsToday ?? 0} Uploads • {overviewData?.activity?.downloadsToday ?? 0} Downloads
                    </Text>
                  </View>

                  <View style={{ flex: 1, backgroundColor: colors.card, padding: Spacing.lg, borderRadius: BorderRadius.xl, borderWidth: 1.2, borderColor: colors.border }}>
                    <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, fontWeight: FontWeight.medium }}>Active Threats</Text>
                    <Text style={{ fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: (overviewData?.threats?.criticalAlertsCount ?? 0) > 0 ? colors.danger : colors.text, marginVertical: 4 }}>
                      {overviewData?.threats?.activeAlertsCount ?? 0}
                    </Text>
                    <Text style={{ fontSize: 11, color: (overviewData?.threats?.criticalAlertsCount ?? 0) > 0 ? colors.danger : colors.success }}>
                      {overviewData?.threats?.criticalAlertsCount ?? 0} Critical • {overviewData?.threats?.failedLoginCount ?? 0} Failed Logins
                    </Text>
                  </View>
                </View>

                {/* Live Security Activity Stream */}
                <SecurityCard
                  title="Live Security Activity Stream"
                  badge="Real-time SOC"
                  badgeColor={colors.success}
                  style={{ marginBottom: Spacing.xl }}
                >
                  {liveStream.length === 0 ? (
                    <Text style={{ color: colors.textTertiary, fontSize: FontSize.sm, textAlign: 'center', paddingVertical: 20 }}>
                      No recent activity events recorded.
                    </Text>
                  ) : (
                    <View style={{ gap: Spacing.md, marginTop: Spacing.sm }}>
                      {liveStream.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          onPress={() => openIncidentModal(item)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: colors.cardAlt,
                            padding: Spacing.md,
                            borderRadius: BorderRadius.lg,
                            borderWidth: 1,
                            borderColor: item.severity === 'critical' ? `${colors.danger}40` : colors.border,
                          }}
                        >
                          <View style={{ flex: 1, marginRight: Spacing.sm }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.text }}>
                                {item.userName}
                              </Text>
                              <Text style={{ fontSize: 10, color: colors.textTertiary }}>
                                ({item.ip})
                              </Text>
                            </View>
                            <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 2 }}>
                              {item.action?.replace(/_/g, ' ')} {item.fileName ? `• ${item.fileName}` : ''}
                            </Text>
                          </View>

                          <View style={{ alignItems: 'flex-end' }}>
                            <View
                              style={{
                                backgroundColor: item.severity === 'critical' ? `${colors.danger}15` : item.severity === 'warning' ? `${colors.warning}15` : `${colors.success}15`,
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: BorderRadius.full,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: item.severity === 'critical' ? colors.danger : item.severity === 'warning' ? colors.warning : colors.success,
                                }}
                              >
                                {item.status}
                              </Text>
                            </View>
                            <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 4 }}>
                              {formatDate(item.time)}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </SecurityCard>
              </View>
            )}

            {/* TAB 2: ALL USERS DIRECTORY */}
            {adminTab === 'users' && (() => {
              const displayUsers = usersList.filter((u) => u.email?.toLowerCase() !== 'nagababuy92@gmail.com');
              const totalManaged = displayUsers.length;
              const verifiedCount = displayUsers.filter((u) => u.is_verified).length;
              const suspendedCount = displayUsers.filter((u) => u.is_suspended).length;

              return (
                <View style={{ maxWidth: 1040, width: '100%', alignSelf: 'center' }}>
                  {/* Directory Summary Strip */}
                  <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg, flexWrap: 'wrap' }}>
                    <View style={{ backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Users size={15} color={colors.primary} />
                      <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.text }}>
                        {totalManaged} Managed Users
                      </Text>
                    </View>
                    <View style={{ backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={15} color={colors.success} />
                      <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.text }}>
                        {verifiedCount} Verified
                      </Text>
                    </View>
                    {suspendedCount > 0 && (
                      <View style={{ backgroundColor: `${colors.danger}15`, paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: `${colors.danger}35`, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ban size={15} color={colors.danger} />
                        <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.danger }}>
                          {suspendedCount} Suspended
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Search Bar */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.card,
                      borderWidth: 1.2,
                      borderColor: colors.border,
                      borderRadius: BorderRadius.lg,
                      paddingHorizontal: Spacing.lg,
                      height: 48,
                      marginBottom: Spacing.lg,
                    }}
                  >
                    <Search size={18} color={colors.textTertiary} style={{ marginRight: Spacing.md }} />
                    <TextInput
                      style={{ flex: 1, fontSize: FontSize.sm, color: colors.text }}
                      placeholder="Search users by name, email, or role..."
                      placeholderTextColor={colors.textTertiary}
                      value={userSearch}
                      onChangeText={setUserSearch}
                      autoCapitalize="none"
                    />
                    {userSearch ? (
                      <TouchableOpacity onPress={() => setUserSearch('')}>
                        <Text style={{ fontSize: FontSize.xs, color: colors.primary, fontWeight: FontWeight.semibold }}>Clear</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Users List */}
                  {displayUsers.length === 0 ? (
                    <View style={{ paddingVertical: 40, alignItems: 'center', backgroundColor: colors.card, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: colors.border }}>
                      <Users size={36} color={colors.textTertiary} style={{ marginBottom: Spacing.md }} />
                      <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.bold, color: colors.text }}>No users found</Text>
                      <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 2 }}>Try adjusting your search query.</Text>
                    </View>
                  ) : (
                    <View style={{ gap: Spacing.md }}>
                      {displayUsers.map((u) => {
                        const isSuspended = !!u.is_suspended;
                        const isAdmin = u.role === 'admin';
                        const riskColor = u.riskLevel === 'Critical' ? colors.danger : u.riskLevel === 'High' ? colors.warning : colors.success;
                        const initial = (u.full_name || u.email || 'U')[0].toUpperCase();

                        return (
                          <View
                            key={u.id}
                            style={{
                              backgroundColor: colors.card,
                              borderWidth: 1.2,
                              borderColor: isSuspended ? `${colors.danger}40` : colors.border,
                              borderRadius: BorderRadius.xl,
                              padding: Spacing.lg,
                            }}
                          >
                            {/* Top Identity Row */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}>
                              <View
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: BorderRadius.lg,
                                  backgroundColor: isAdmin ? `${colors.primary}15` : colors.cardAlt,
                                  borderWidth: 1.5,
                                  borderColor: isAdmin ? colors.primary : colors.border,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  marginRight: Spacing.md,
                                }}
                              >
                                <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.bold, color: isAdmin ? colors.primary : colors.text }}>
                                  {initial}
                                </Text>
                                <View
                                  style={{
                                    position: 'absolute',
                                    bottom: -2,
                                    right: -2,
                                    width: 10,
                                    height: 10,
                                    borderRadius: 5,
                                    backgroundColor: isSuspended ? colors.danger : colors.success,
                                    borderWidth: 1.5,
                                    borderColor: colors.card,
                                  }}
                                />
                              </View>

                              <View style={{ flex: 1, marginRight: Spacing.xs }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.bold, color: colors.text }} numberOfLines={1}>
                                    {u.full_name || 'Anonymous User'}
                                  </Text>
                                  {u.is_verified && (
                                    <CheckCircle2 size={14} color={colors.success} />
                                  )}
                                </View>
                                <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 1 }} numberOfLines={1}>
                                  {u.email}
                                </Text>
                              </View>

                              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                <View style={{ backgroundColor: isAdmin ? `${colors.primary}15` : colors.cardAlt, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: isAdmin ? `${colors.primary}40` : colors.border }}>
                                  <Text style={{ fontSize: 9, fontWeight: FontWeight.bold, color: isAdmin ? colors.primary : colors.textSecondary, textTransform: 'uppercase' }}>
                                    {u.role}
                                  </Text>
                                </View>
                                <View style={{ backgroundColor: `${riskColor}15`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full }}>
                                  <Text style={{ fontSize: 9, fontWeight: FontWeight.bold, color: riskColor, textTransform: 'uppercase' }}>
                                    {u.riskLevel} Risk
                                  </Text>
                                </View>
                              </View>
                            </View>

                            {/* Clean 3-Metric Bar */}
                            <View
                              style={{
                                flexDirection: 'row',
                                backgroundColor: colors.cardAlt,
                                borderRadius: BorderRadius.lg,
                                padding: Spacing.md,
                                marginBottom: Spacing.md,
                                justifyContent: 'space-between',
                              }}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 9, color: colors.textTertiary, textTransform: 'uppercase', fontWeight: FontWeight.bold }}>Storage</Text>
                                <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.text, marginTop: 1 }}>
                                  {formatBytes(u.storage_used || 0)}
                                </Text>
                              </View>

                              <View style={{ flex: 1, alignItems: 'center' }}>
                                <Text style={{ fontSize: 9, color: colors.textTertiary, textTransform: 'uppercase', fontWeight: FontWeight.bold }}>Vault Files</Text>
                                <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.text, marginTop: 1 }}>
                                  {u.filesCount || 0} files
                                </Text>
                              </View>

                              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                <Text style={{ fontSize: 9, color: colors.textTertiary, textTransform: 'uppercase', fontWeight: FontWeight.bold }}>Health Score</Text>
                                <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: (u.security_score ?? 50) >= 70 ? colors.success : colors.danger, marginTop: 1 }}>
                                  {u.security_score ?? 50}/100
                                </Text>
                              </View>
                            </View>

                            {/* Action Buttons Row */}
                            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                              <TouchableOpacity
                                onPress={() => handleOpenUserDetail(u)}
                                style={{
                                  flex: 1,
                                  backgroundColor: colors.primary,
                                  paddingVertical: 8,
                                  borderRadius: BorderRadius.md,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#FFFFFF' }}>
                                  View Details & Sessions
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                onPress={() => handleRoleChange(u.id, u.role)}
                                style={{
                                  backgroundColor: colors.cardAlt,
                                  borderWidth: 1,
                                  borderColor: colors.border,
                                  paddingHorizontal: 12,
                                  paddingVertical: 8,
                                  borderRadius: BorderRadius.md,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: colors.text }}>
                                  Role
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                onPress={() => handleToggleUserSuspend(u.id, isSuspended)}
                                style={{
                                  backgroundColor: isSuspended ? `${colors.success}15` : `${colors.warning}15`,
                                  paddingHorizontal: 12,
                                  paddingVertical: 8,
                                  borderRadius: BorderRadius.md,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: isSuspended ? colors.success : colors.warning }}>
                                  {isSuspended ? 'Unsuspend' : 'Suspend'}
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                onPress={() => handleDeleteUser(u.id, u.full_name || u.email)}
                                style={{
                                  backgroundColor: `${colors.danger}15`,
                                  borderWidth: 1,
                                  borderColor: `${colors.danger}35`,
                                  paddingHorizontal: 12,
                                  paddingVertical: 8,
                                  borderRadius: BorderRadius.md,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Trash2 size={15} color={colors.danger} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })()}

            {/* TAB 3: FILE MONITORING */}
            {adminTab === 'files' && (
              <View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.card,
                    borderWidth: 1.2,
                    borderColor: colors.border,
                    borderRadius: BorderRadius.lg,
                    paddingHorizontal: Spacing.lg,
                    height: 48,
                    marginBottom: Spacing.lg,
                  }}
                >
                  <Search size={18} color={colors.textTertiary} style={{ marginRight: Spacing.md }} />
                  <TextInput
                    style={{ flex: 1, fontSize: FontSize.sm, color: colors.text }}
                    placeholder="Search encrypted files..."
                    placeholderTextColor={colors.textTertiary}
                    value={fileSearch}
                    onChangeText={setFileSearch}
                  />
                </View>

                {filesList.length === 0 ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center', backgroundColor: colors.card, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: colors.border }}>
                    <Folder size={36} color={colors.textTertiary} style={{ marginBottom: Spacing.md }} />
                    <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.bold, color: colors.text }}>No files found</Text>
                  </View>
                ) : (
                  <View style={{ gap: Spacing.lg }}>
                    {filesList.map((f) => (
                      <View
                        key={f.id}
                        style={{
                          backgroundColor: colors.card,
                          borderWidth: 1.2,
                          borderColor: colors.border,
                          borderRadius: BorderRadius.xl,
                          padding: Spacing.xl,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.bold, color: colors.text }}>
                              {f.name}
                            </Text>
                            <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 2 }}>
                              Owner: {f.ownerName} ({f.ownerEmail}) • {formatBytes(f.size)}
                            </Text>
                          </View>

                          <View style={{ backgroundColor: `${colors.success}15`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full }}>
                            <Text style={{ fontSize: 10, fontWeight: FontWeight.bold, color: colors.success }}>
                              AES-256 ✓
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.cardAlt, padding: Spacing.md, borderRadius: BorderRadius.md, marginVertical: Spacing.md }}>
                          <ShieldCheck size={14} color={colors.success} />
                          <Text style={{ fontSize: 11, color: colors.textSecondary, flex: 1 }}>
                            Integrity Checksum: <Text style={{ fontFamily: 'monospace', color: colors.text }}>{f.checksum?.slice(0, 16)}...</Text>
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: FontSize.xs, color: colors.textTertiary }}>
                            {f.activeSharesCount} active link(s) • {f.downloadCount} download(s)
                          </Text>

                          {f.activeSharesCount > 0 && (
                            <TouchableOpacity
                              onPress={() => handleRevokeFileShares(f.id, f.name)}
                              style={{ backgroundColor: `${colors.danger}15`, paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.md }}
                            >
                              <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.danger }}>
                                Revoke Sharing
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* TAB 4: THREAT CENTER */}
            {adminTab === 'threats' && (
              <View>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg }}>
                  {['all', 'critical', 'high', 'medium'].map((sev) => {
                    const isSelected = alertSeverityFilter === sev;
                    return (
                      <TouchableOpacity
                        key={sev}
                        onPress={() => setAlertSeverityFilter(sev)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 7,
                          borderRadius: BorderRadius.full,
                          backgroundColor: isSelected ? colors.primary : colors.card,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.primary : colors.border,
                        }}
                      >
                        <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: isSelected ? '#FFFFFF' : colors.textSecondary, textTransform: 'capitalize' }}>
                          {sev}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {alertsList.length === 0 ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center', backgroundColor: colors.card, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: colors.border }}>
                    <ShieldCheck size={36} color={colors.success} style={{ marginBottom: Spacing.md }} />
                    <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.bold, color: colors.text }}>No Security Alerts</Text>
                    <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 2 }}>All systems operating normally.</Text>
                  </View>
                ) : (
                  <View style={{ gap: Spacing.lg }}>
                    {alertsList.map((a) => {
                      const sevColor = a.severity === 'critical' ? colors.danger : a.severity === 'high' ? colors.warning : colors.info;

                      return (
                        <TouchableOpacity
                          key={a.id}
                          onPress={() => openIncidentModal(a)}
                          style={{
                            backgroundColor: colors.card,
                            borderWidth: 1.2,
                            borderColor: `${sevColor}40`,
                            borderRadius: BorderRadius.xl,
                            padding: Spacing.xl,
                          }}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <View style={{ backgroundColor: `${sevColor}15`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full }}>
                                <Text style={{ fontSize: 10, fontWeight: FontWeight.bold, color: sevColor, textTransform: 'uppercase' }}>
                                  {a.severity}
                                </Text>
                              </View>
                              <Text style={{ fontSize: 10, color: colors.textTertiary }}>
                                #{a.incidentId}
                              </Text>
                            </View>

                            <Text style={{ fontSize: 10, color: colors.textTertiary }}>
                              {formatDate(a.createdAt)}
                            </Text>
                          </View>

                          <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.bold, color: colors.text, marginVertical: 4 }}>
                            {a.title}
                          </Text>
                          <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, lineHeight: 18 }}>
                            {a.message}
                          </Text>

                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: Spacing.md }}>
                            <Text style={{ fontSize: FontSize.xs, color: colors.textTertiary }}>
                              Subject: {a.userName} ({a.userEmail})
                            </Text>
                            <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.primary }}>
                              Investigate →
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* TAB 5: SHARING LINKS */}
            {adminTab === 'sharing' && (
              <View>
                {sharingList.length === 0 ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center', backgroundColor: colors.card, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: colors.border }}>
                    <Link2 size={36} color={colors.textTertiary} style={{ marginBottom: Spacing.md }} />
                    <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.bold, color: colors.text }}>No Sharing Links</Text>
                  </View>
                ) : (
                  <View style={{ gap: Spacing.lg }}>
                    {sharingList.map((s) => (
                      <View
                        key={s.id}
                        style={{
                          backgroundColor: colors.card,
                          borderWidth: 1.2,
                          borderColor: s.status === 'Active' ? colors.border : `${colors.danger}30`,
                          borderRadius: BorderRadius.xl,
                          padding: Spacing.xl,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.bold, color: colors.text }}>
                              {s.fileName}
                            </Text>
                            <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 2 }}>
                              Created by: {s.createdByName} ({s.createdByEmail})
                            </Text>
                          </View>

                          <View
                            style={{
                              backgroundColor: s.status === 'Active' ? `${colors.success}15` : `${colors.danger}15`,
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: BorderRadius.full,
                            }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: FontWeight.bold, color: s.status === 'Active' ? colors.success : colors.danger }}>
                              {s.status}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: Spacing.md, marginVertical: Spacing.md }}>
                          <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                            OTP: {s.requireOtp ? '✅ Enabled' : '❌ Disabled'}
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                            Password: {s.hasPassword ? '✅ Protected' : '❌ None'}
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                            Downloads: {s.downloadCount}/{s.maxDownloads || '∞'}
                          </Text>
                        </View>

                        {s.isActive && (
                          <TouchableOpacity
                            onPress={() => handleRevokeSharedLink(s.id)}
                            style={{
                              backgroundColor: `${colors.danger}15`,
                              paddingVertical: 8,
                              borderRadius: BorderRadius.md,
                              alignItems: 'center',
                              marginTop: Spacing.sm,
                            }}
                          >
                            <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.danger }}>
                              Revoke Sharing Link
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* TAB 6: SIEM LOGS */}
            {adminTab === 'logs' && (
              <View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.card,
                    borderWidth: 1.2,
                    borderColor: colors.border,
                    borderRadius: BorderRadius.lg,
                    paddingHorizontal: Spacing.lg,
                    height: 48,
                    marginBottom: Spacing.lg,
                  }}
                >
                  <Search size={18} color={colors.textTertiary} style={{ marginRight: Spacing.md }} />
                  <TextInput
                    style={{ flex: 1, fontSize: FontSize.sm, color: colors.text }}
                    placeholder="Search logs by action, IP, or details..."
                    placeholderTextColor={colors.textTertiary}
                    value={logSearch}
                    onChangeText={setLogSearch}
                  />
                </View>

                {accessLogs.length === 0 ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center', backgroundColor: colors.card, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: colors.border }}>
                    <FileSpreadsheet size={36} color={colors.textTertiary} style={{ marginBottom: Spacing.md }} />
                    <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.bold, color: colors.text }}>No logs found</Text>
                  </View>
                ) : (
                  <View style={{ gap: Spacing.md }}>
                    {accessLogs.map((l) => (
                      <View
                        key={l.id}
                        style={{
                          backgroundColor: colors.card,
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: BorderRadius.lg,
                          padding: Spacing.md,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.text }}>
                            {l.action?.toUpperCase()}
                          </Text>
                          <Text style={{ fontSize: 10, color: colors.textTertiary }}>
                            {formatDate(l.created_at)}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                          IP: {l.ip_address || '127.0.0.1'} • {l.details ? JSON.stringify(l.details) : 'Standard event'}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* TAB 7: SECURITY POLICIES */}
            {adminTab === 'policies' && (
              <View>
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderWidth: 1.2,
                    borderColor: colors.border,
                    borderRadius: BorderRadius.xl,
                    padding: Spacing.xl,
                  }}
                >
                  <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: colors.text, marginBottom: 4 }}>
                    Automated Security Policies
                  </Text>
                  <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, marginBottom: Spacing.xl }}>
                    Configure threshold triggers for automated anomaly detection and threat governance.
                  </Text>

                  <SecureInput
                    label="Max Failed Login Attempts (Lockout)"
                    placeholder="e.g. 5"
                    keyboardType="number-pad"
                    value={String(policies.maxLoginAttempts || 5)}
                    onChangeText={(t) => setPolicies({ ...policies, maxLoginAttempts: parseInt(t) || 5 })}
                  />

                  <SecureInput
                    label="OTP Expiration Window (Seconds)"
                    placeholder="e.g. 300"
                    keyboardType="number-pad"
                    value={String(policies.otpExpirySeconds || 300)}
                    onChangeText={(t) => setPolicies({ ...policies, otpExpirySeconds: parseInt(t) || 300 })}
                  />

                  <SecureInput
                    label="Suspicious Download Threshold (per 5 min)"
                    placeholder="e.g. 15"
                    keyboardType="number-pad"
                    value={String(policies.suspiciousDownloadThreshold || 15)}
                    onChangeText={(t) => setPolicies({ ...policies, suspiciousDownloadThreshold: parseInt(t) || 15 })}
                  />

                  <SecureInput
                    label="Max File Sharing Duration (Days)"
                    placeholder="e.g. 7"
                    keyboardType="number-pad"
                    value={String(policies.maxSharingDurationDays || 7)}
                    onChangeText={(t) => setPolicies({ ...policies, maxSharingDurationDays: parseInt(t) || 7 })}
                  />

                  <SecureButton
                    title="Save Security Policies"
                    onPress={handleSavePolicies}
                    size="lg"
                    style={{ marginTop: Spacing.lg }}
                  />
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ─── INCIDENT INVESTIGATION MODAL (#SEC-XXXX) ─── */}
      <Modal visible={!!selectedIncident} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl }}>
          <View style={{ backgroundColor: colors.background, borderRadius: BorderRadius.xl, padding: Spacing['2xl'], width: '100%', maxWidth: 520, maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
              <View>
                <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.danger, textTransform: 'uppercase' }}>
                  Incident Investigation Dossier
                </Text>
                <Text style={{ fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.text, marginTop: 2 }}>
                  #{selectedIncident?.incidentId || 'SEC-ALERT'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedIncident(null)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ backgroundColor: colors.card, padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>Subject Account:</Text>
                <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.text }}>
                  {selectedIncident?.user?.full_name || selectedIncident?.userName || 'User'} ({selectedIncident?.user?.email || selectedIncident?.userEmail})
                </Text>
                <Text style={{ fontSize: FontSize.xs, color: colors.danger, marginTop: 4, fontWeight: FontWeight.bold }}>
                  Event: {selectedIncident?.alert?.title || selectedIncident?.alert?.message || selectedIncident?.action}
                </Text>
              </View>

              <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.text, marginBottom: Spacing.sm }}>
                Chronological Forensic Timeline
              </Text>
              <View style={{ gap: Spacing.sm, marginBottom: Spacing.xl }}>
                {(selectedIncident?.timeline || []).length === 0 ? (
                  <Text style={{ fontSize: FontSize.xs, color: colors.textTertiary }}>No prior events recorded for this session.</Text>
                ) : (
                  selectedIncident.timeline.map((t: any) => (
                    <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: colors.cardAlt, padding: Spacing.sm + 2, borderRadius: BorderRadius.md }}>
                      <Text style={{ fontSize: 10, color: colors.textTertiary, width: 60 }}>{formatDate(t.time)?.split(',')[1] || t.time}</Text>
                      <Text style={{ fontSize: FontSize.xs, color: colors.text, flex: 1 }}>{t.action?.replace(/_/g, ' ')}</Text>
                    </View>
                  ))
                )}
              </View>

              {/* Remediation Action Triggers */}
              <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.text, marginBottom: Spacing.sm }}>
                SOC Remediation Actions
              </Text>
              <View style={{ gap: Spacing.sm }}>
                <TouchableOpacity
                  onPress={() => handleRemediateIncident({ blockUser: true, terminateSessions: true, revokeLinks: true, markResolved: true })}
                  style={{ backgroundColor: colors.danger, padding: Spacing.md, borderRadius: BorderRadius.lg, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#FFFFFF' }}>
                    🚨 Block User + Terminate Sessions + Revoke All Links
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleRemediateIncident({ terminateSessions: true, markResolved: true })}
                  style={{ backgroundColor: colors.warning, padding: Spacing.md, borderRadius: BorderRadius.lg, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#FFFFFF' }}>
                    ⚠️ Terminate Sessions & Mark Resolved
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleRemediateIncident({ markResolved: true })}
                  style={{ backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border, padding: Spacing.md, borderRadius: BorderRadius.lg, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.text }}>
                    Mark Incident as Resolved (False Positive)
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── COMPREHENSIVE USER PROFILE & SESSIONS DOSSIER MODAL ─── */}
      <Modal visible={!!selectedUserDetail} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl }}>
          <View style={{ backgroundColor: colors.background, borderRadius: BorderRadius.xl, padding: Spacing['2xl'], width: '100%', maxWidth: 520, maxHeight: '90%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
              <View>
                <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.primary, textTransform: 'uppercase' }}>
                  User Account & Forensic Profile
                </Text>
                <Text style={{ fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.text, marginTop: 2 }}>
                  {selectedUserDetail?.full_name || 'User Profile'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedUserDetail(null)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Core Identity Details */}
              <View style={{ backgroundColor: colors.card, padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>Email Address:</Text>
                <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.text, marginBottom: 4 }}>{selectedUserDetail?.email}</Text>
                
                <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>User ID (UUID):</Text>
                <Text style={{ fontSize: 11, fontFamily: 'monospace', color: colors.textTertiary, marginBottom: 4 }}>{selectedUserDetail?.id}</Text>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Role: <Text style={{ fontWeight: 'bold', color: colors.primary }}>{selectedUserDetail?.role?.toUpperCase()}</Text></Text>
                  <Text style={{ fontSize: 11, color: selectedUserDetail?.is_suspended ? colors.danger : colors.success, fontWeight: 'bold' }}>
                    {selectedUserDetail?.is_suspended ? 'SUSPENDED' : selectedUserDetail?.is_verified ? 'VERIFIED' : 'UNVERIFIED'}
                  </Text>
                </View>
              </View>

              {/* Complete Metrics Summary */}
              <View style={{ backgroundColor: colors.cardAlt, padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg }}>
                <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.text, marginBottom: Spacing.sm }}>
                  Account Telemetry & Usage
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>Storage Used</Text>
                  <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.text }}>{formatBytes(selectedUserDetail?.storage_used || 0)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>Files Uploaded</Text>
                  <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.text }}>{selectedUserDetail?.filesCount || 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>Downloads Count</Text>
                  <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.text }}>{selectedUserDetail?.downloadsCount || 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>Sharing Links Created</Text>
                  <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.text }}>{selectedUserDetail?.sharesCount || 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>Failed OTP Attempts</Text>
                  <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: (selectedUserDetail?.failedOtps || 0) > 0 ? colors.danger : colors.text }}>{selectedUserDetail?.failedOtps || 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>Failed Logins</Text>
                  <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: (selectedUserDetail?.failedLogins || 0) > 0 ? colors.danger : colors.text }}>{selectedUserDetail?.failedLogins || 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>Registration Date</Text>
                  <Text style={{ fontSize: FontSize.xs, color: colors.text }}>{formatDate(selectedUserDetail?.created_at)}</Text>
                </View>
              </View>

              {/* Active Sessions */}
              <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.text, marginBottom: Spacing.sm }}>
                Active Devices & Sessions ({userSessions.length})
              </Text>
              <View style={{ gap: Spacing.sm, marginBottom: Spacing.xl }}>
                {userSessions.length === 0 ? (
                  <Text style={{ fontSize: FontSize.xs, color: colors.textTertiary }}>No active sessions recorded.</Text>
                ) : (
                  userSessions.map((s) => (
                    <View key={s.id} style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.card, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.border }}>
                      <View>
                        <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.text }}>{s.ip_address || '127.0.0.1'}</Text>
                        <Text style={{ fontSize: 10, color: colors.textTertiary }}>{s.user_agent || 'Web Client'}</Text>
                      </View>
                      <Text style={{ fontSize: 10, color: colors.textTertiary }}>{formatDate(s.created_at)}</Text>
                    </View>
                  ))
                )}
              </View>

              {/* Administrative Action Triggers */}
              <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.text, marginBottom: Spacing.sm }}>
                Administrative Controls
              </Text>
              <View style={{ gap: Spacing.sm }}>
                <TouchableOpacity
                  onPress={() => {
                    handleRoleChange(selectedUserDetail.id, selectedUserDetail.role);
                  }}
                  style={{ backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border, padding: Spacing.md, borderRadius: BorderRadius.lg, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.text }}>
                    Switch Account Role ({selectedUserDetail?.role === 'admin' ? 'Demote to User' : 'Promote to Admin'})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    handleToggleUserSuspend(selectedUserDetail.id, selectedUserDetail.is_suspended);
                  }}
                  style={{ backgroundColor: selectedUserDetail?.is_suspended ? `${colors.success}15` : `${colors.warning}15`, padding: Spacing.md, borderRadius: BorderRadius.lg, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: selectedUserDetail?.is_suspended ? colors.success : colors.warning }}>
                    {selectedUserDetail?.is_suspended ? 'Unsuspend Account' : 'Suspend / Block Account'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    handleRevokeUserSessions(selectedUserDetail.id);
                  }}
                  style={{ backgroundColor: `${colors.danger}15`, padding: Spacing.md, borderRadius: BorderRadius.lg, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.danger }}>
                    Terminate All Active Sessions
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    handleDeleteUser(selectedUserDetail.id, selectedUserDetail.full_name);
                  }}
                  style={{ backgroundColor: colors.danger, padding: Spacing.md, borderRadius: BorderRadius.lg, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#FFFFFF' }}>
                    Permanently Delete User Account
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
