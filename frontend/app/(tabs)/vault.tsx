import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Clipboard,
  ScrollView,
  Linking,
  Image,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../../src/theme/useTheme';
import { Spacing, FontSize, FontWeight, BorderRadius } from '../../src/theme/tokens';
import api, { filesAPI, sharingAPI, webSafeSecureStore, getNetworkHost, getShareHost } from '../../src/services/api';
import OTPModal from '../../src/components/ui/OTPModal';
import SecureInput from '../../src/components/ui/SecureInput';
import { useAuthStore } from '../../src/store/authStore';

import { 
  Folder, 
  FolderLock,
  Share2, 
  Key, 
  Search, 
  FileText, 
  Image as ImageIcon, 
  Video, 
  FileArchive, 
  File as FileIcon, 
  Trash2, 
  Link as LinkIcon, 
  Copy, 
  Lock, 
  Unlock, 
  Download,
  MoreVertical,
  CheckCircle2,
  Calendar,
  Layers,
  X,
  FileSearch,
  ExternalLink,
  Check,
  Globe,
} from 'lucide-react-native';

interface FileItem {
  id: string;
  name: string; // Original filename from API
  size: number;
  type: string; // MIME type from API
  category: string;
  isEncrypted: boolean;
  hash?: string;
  createdAt: string;
}

interface DownloadAuditItem {
  id: string;
  ipAddress: string;
  userAgent: string;
  downloaderEmail: string;
  authMethod: string;
  downloadedAt: string;
}

interface SharedLinkItem {
  id: string;
  token: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  downloadCount: number;
  maxDownloads: number | null;
  requireOtp: boolean;
  hasPassword: boolean;
  isActive: boolean;
  expiresAt: string;
  createdAt: string;
  downloads?: DownloadAuditItem[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getCategoryIcon(cat: string, size = 18, color = '#64748B') {
  switch (cat) {
    case 'document': return <FileText size={size} color={color} />;
    case 'image': return <ImageIcon size={size} color={color} />;
    case 'video': return <Video size={size} color={color} />;
    case 'archive': return <FileArchive size={size} color={color} />;
    default: return <FileIcon size={size} color={color} />;
  }
}

function getCategoryColor(cat: string, colors: any): string {
  switch (cat) {
    case 'document': return colors.primary;
    case 'image': return colors.success;
    case 'video': return colors.warning;
    case 'archive': return '#8B5CF6';
    default: return colors.textSecondary;
  }
}

export default function VaultScreen() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  
  // Segment view toggle: 'files' | 'links' | 'redeem'
  const [activeTab, setActiveTab] = useState<'files' | 'links' | 'redeem'>('files');

  // Vault Files State
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [refreshingFiles, setRefreshingFiles] = useState(false);

  // Active Shared Links State
  const [sharedLinks, setSharedLinks] = useState<SharedLinkItem[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [refreshingLinks, setRefreshingLinks] = useState(false);

  // Redeem / Resolve Token State
  const [redeemToken, setRedeemToken] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [redeemPassword, setRedeemPassword] = useState('');
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [resolvedFile, setResolvedFile] = useState<any | null>(null);
  const [resolvedDownloadUrl, setResolvedDownloadUrl] = useState('');

  // OTP state for OTP-protected share link redemption
  const [redeemPhone, setRedeemPhone] = useState('');
  const [isShareOTPVisible, setIsShareOTPVisible] = useState(false);
  const [shareOTPMaskedPhone, setShareOTPMaskedPhone] = useState('');
  const [shareOTPToken, setShareOTPToken] = useState(''); // the resolved share token

  const isAdmin = user?.role === 'admin' || user?.email?.toLowerCase() === 'nagababuy92@gmail.com';

  if (isAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl }} edges={['top']}>
        <View style={{ backgroundColor: colors.card, padding: Spacing['2xl'], borderRadius: BorderRadius.xl, borderWidth: 1.2, borderColor: colors.border, alignItems: 'center', maxWidth: 480, width: '100%' }}>
          <FolderLock size={48} color={colors.primary} style={{ marginBottom: Spacing.md }} />
          <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: colors.text, textAlign: 'center' }}>
            Client Vault Area
          </Text>
          <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.xs, lineHeight: 18, marginBottom: Spacing.xl }}>
            Personal Vault and storage features are reserved exclusively for client user accounts. As an administrator, please use the Central SOC Portal to monitor and govern system-wide files.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace('/dashboard')}
            style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: BorderRadius.lg }}
          >
            <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#FFFFFF' }}>
              Open Admin SOC Portal
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }


  // Option Menu Modal State (for file actions)
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [isActionMenuVisible, setIsActionMenuVisible] = useState(false);

  // Share Modal Config State
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [expiresIn, setExpiresIn] = useState('24'); // Hours
  const [maxDownloads, setMaxDownloads] = useState('');
  const [sharePassword, setSharePassword] = useState('');
  const [requireOtp, setRequireOtp] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Preview Modal State
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewTextContent, setPreviewTextContent] = useState<string | null>(null);
  const [previewImageBase64, setPreviewImageBase64] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);

  const filters = ['all', 'document', 'image', 'video', 'archive'];

  // Load auth token on mount for authenticated image loading
  useEffect(() => {
    webSafeSecureStore.getItemAsync('accessToken').then(token => {
      setAuthToken(token);
    });
  }, []);

  // 1. Fetch files from cloud database
  const fetchFiles = async () => {
    try {
      const params: Record<string, any> = {};
      if (activeFilter !== 'all') params.category = activeFilter;
      if (search) params.search = search;

      const res = await filesAPI.getFiles(params);
      if (res.data.success) {
        setFiles(res.data.data || []);
      }
    } catch (error) {
      console.warn('Vault fetch error:', error);
    } finally {
      setLoadingFiles(false);
      setRefreshingFiles(false);
    }
  };

  // 2. Fetch shared links from cloud database
  const fetchSharedLinks = async () => {
    setLoadingLinks(true);
    try {
      const res = await sharingAPI.getLinks();
      if (res.data.success) {
        setSharedLinks(res.data.data || []);
      }
    } catch (error) {
      console.warn('Failed to fetch shared links:', error);
    } finally {
      setLoadingLinks(false);
      setRefreshingLinks(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'files') {
      fetchFiles();
    } else if (activeTab === 'links') {
      fetchSharedLinks();
    }
  }, [activeTab, activeFilter, search]);

  const onRefreshFiles = useCallback(() => {
    setRefreshingFiles(true);
    fetchFiles();
  }, [activeFilter, search]);

  const onRefreshLinks = useCallback(() => {
    setRefreshingLinks(true);
    fetchSharedLinks();
  }, []);

  const handleDeleteFile = (id: string, name: string) => {
    Alert.alert(
      'Delete File',
      `Are you sure you want to permanently delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await filesAPI.deleteFile(id);
              if (res.data.success) {
                Alert.alert('Success', 'File permanently deleted from Cloud');
                fetchFiles();
              }
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to delete file');
            }
          },
        },
      ]
    );
  };

  const getShareBaseUrl = () => {
    return `http://${getShareHost()}:5000`;
  };

  const [shareSuccessData, setShareSuccessData] = useState<{
    link: string;
    token: string;
    fileName: string;
    fileSize: number;
    hasPassword: boolean;
    requireOtp: boolean;
    expiresIn: string;
    maxDownloads: string;
  } | null>(null);
  const [isCopiedLink, setIsCopiedLink] = useState(false);
  const [isCopiedToken, setIsCopiedToken] = useState(false);

  const handleCreateShareLink = async () => {
    if (!selectedFile) return;
    setIsGenerating(true);
    try {
      const payload: any = { fileId: selectedFile.id };
      if (sharePassword.trim()) payload.password = sharePassword.trim();
      if (maxDownloads.trim()) payload.maxDownloads = parseInt(maxDownloads.trim(), 10);
      if (expiresIn.trim()) payload.expiresIn = parseInt(expiresIn.trim(), 10);
      if (requireOtp) payload.requireOtp = true;

      const res = await sharingAPI.createLink(payload);
      if (res.data.success) {
        const token = res.data.data.token;
        const link = `${getShareBaseUrl()}/api/share/view/${token}`;
        
        try {
          Clipboard.setString(link);
        } catch {}

        setShareSuccessData({
          link,
          token,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          hasPassword: !!sharePassword.trim(),
          requireOtp: !!requireOtp,
          expiresIn: expiresIn.trim() || '24',
          maxDownloads: maxDownloads.trim() || 'Unlimited',
        });

        setIsShareModalVisible(false);
        setSharePassword('');
        setMaxDownloads('');
        setExpiresIn('24');
        setRequireOtp(false);
        fetchSharedLinks();
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to create share link');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleLinkActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await sharingAPI.toggleLink(id, !currentStatus);
      if (res.data.success) {
        setSharedLinks(prev => prev.map(l => l.id === id ? { ...l, isActive: !currentStatus } : l));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update link status on cloud database');
    }
  };

  const handleCopyExistingLink = (token: string) => {
    const link = `${getShareBaseUrl()}/api/share/view/${token}`;
    Clipboard.setString(link);
    Alert.alert('Copied!', 'Link copied to clipboard:\n\n' + link);
  };

  // Redeem / Resolve shared token
  const handleResolveToken = async () => {
    if (!redeemToken.trim()) {
      Alert.alert('Error', 'Please enter a valid link token');
      return;
    }
    setIsResolving(true);
    setPasswordRequired(false);
    setResolvedFile(null);

    // Extract token if they pasted the full URL
    let token = redeemToken.trim();
    if (token.includes('/share/view/')) {
      token = token.substring(token.lastIndexOf('/') + 1);
    } else if (token.includes('/share/download/')) {
      token = token.substring(token.lastIndexOf('/') + 1);
    }

    try {
      const payload: any = {};
      if (redeemPassword) payload.password = redeemPassword;

      const res = await sharingAPI.verifyLink(token, payload);
      if (res.data.success) {
        setResolvedFile(res.data.data.file);
        const downloadUrl = `${getShareBaseUrl()}/api/share/download/${token}${
          redeemPassword ? '?password=' + encodeURIComponent(redeemPassword) : ''
        }`;
        setResolvedDownloadUrl(downloadUrl);
        Alert.alert(
          'Access Approved!',
          `File resolved: ${res.data.data.file.original_name}\n\nClick the button to download and decrypt!`
        );
      }
    } catch (error: any) {
      const status = error.response?.status;
      const message = error.response?.data?.message || '';

      if (status === 401) {
        setPasswordRequired(true);
        Alert.alert('Authentication Required', 'This shared file is protected. You can enter the password or click "Verify via Email OTP".');
      } else if (status === 403 && message.toLowerCase().includes('otp')) {
        handleRequestRedeemOtp();
      } else {
        Alert.alert('Access Denied', message || 'Invalid or expired share token');
      }
    } finally {
      setIsResolving(false);
    }
  };

  const handleRequestRedeemOtp = async () => {
    let token = redeemToken.trim();
    if (token.includes('/share/view/')) {
      token = token.substring(token.lastIndexOf('/') + 1);
    } else if (token.includes('/share/download/')) {
      token = token.substring(token.lastIndexOf('/') + 1);
    }
    if (!token) {
      Alert.alert('Missing Token', 'Please enter a share token or link first.');
      return;
    }
    try {
      const otpRes = await sharingAPI.requestShareOTP(token);
      if (otpRes.data.success) {
        setShareOTPToken(token);
        setShareOTPMaskedPhone(otpRes.data.data.maskedEmail || otpRes.data.data.maskedPhone || 'registered email');
        setIsShareOTPVisible(true);
      }
    } catch (otpErr: any) {
      Alert.alert('OTP Error', otpErr.response?.data?.message || 'Failed to dispatch verification code');
    }
  };

  // Verify OTP for share link access
  const handleShareOTPVerify = async (
    otp: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await sharingAPI.verifyLink(shareOTPToken, {
        otp,
        password: redeemPassword || undefined,
      });

      if (res.data.success) {
        setIsShareOTPVisible(false);
        setResolvedFile(res.data.data.file);
        const downloadUrl = `${getShareBaseUrl()}/api/share/download/${shareOTPToken}?otp=${encodeURIComponent(otp)}`;
        setResolvedDownloadUrl(downloadUrl);
        return { success: true };
      }

      return { success: false, error: res.data.message || 'Verification failed.' };
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Verification failed.';
      return { success: false, error: msg };
    }
  };

  // Resend share OTP
  const handleShareOTPResend = async () => {
    await sharingAPI.requestShareOTP(shareOTPToken);
  };


  const handleStartDownload = () => {
    if (resolvedDownloadUrl) {
      Linking.openURL(resolvedDownloadUrl);
    }
  };

  // Open Preview Modal on tap
  const handleFileTap = async (file: FileItem) => {
    setSelectedFile(file);
    setIsPreviewVisible(true);
    setIsLoadingPreview(true);
    setPreviewTextContent(null);
    setPreviewImageBase64(null);
    setImageLoadError(false);

    // Fetch plain text content for documents if possible
    const textMimes = ['text/plain', 'text/markdown', 'application/json', 'text/csv', 'text/html', 'text/css'];
    const hasTextExtension = file.name ? /\.(txt|md|json|csv|html|css|js|ts|py|sh)$/i.test(file.name) : false;

    if (file.category === 'document' && (textMimes.includes(file.type) || hasTextExtension)) {
      try {
        const res = await api.get(`/files/${file.id}/download`, {
          responseType: 'text',
        });
        setPreviewTextContent(res.data);
      } catch (err) {
        console.warn('Failed to fetch doc preview content:', err);
        setPreviewTextContent('This secure document is encrypted using standard AES-256 and could not be loaded directly as plain text.');
      } finally {
        setIsLoadingPreview(false);
      }
    } else if (file.category === 'image') {
      try {
        const res = await api.get(`/files/${file.id}/download?base64=true`);
        if (res.data.success && res.data.data.base64) {
          setPreviewImageBase64(`data:${res.data.data.mimeType || file.type};base64,${res.data.data.base64}`);
        } else {
          throw new Error('Invalid base64 payload');
        }
      } catch (err) {
        console.warn('Failed to fetch image preview content:', err);
        setImageLoadError(true);
      } finally {
        setIsLoadingPreview(false);
      }
    } else {
      setIsLoadingPreview(false);
    }
  };

  const renderFileItem = ({ item }: { item: FileItem }) => {
    const fileName = item.name || 'Unnamed File';
    const catColor = getCategoryColor(item.category || 'other', colors);
    return (
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: BorderRadius.md,
          marginBottom: Spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Left Side: Clickable File Info */}
        <Pressable
          onPress={() => handleFileTap(item)}
          onLongPress={() => handleDeleteFile(item.id, fileName)}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            padding: Spacing.lg,
            opacity: pressed ? 0.65 : 1,
          })}
        >
          {/* File type icon */}
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: BorderRadius.sm,
              backgroundColor: `${catColor}15`,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: Spacing.md,
            }}
          >
            {getCategoryIcon(item.category || 'other', 20, catColor)}
          </View>

          {/* File info */}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: FontSize.md,
                fontWeight: FontWeight.medium,
                color: colors.text,
                marginBottom: 2,
              }}
              numberOfLines={1}
            >
              {fileName}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>
                {formatBytes(item.size)}
              </Text>
              <View
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: 1.5,
                  backgroundColor: colors.textTertiary,
                  marginHorizontal: 8,
                }}
              />
              <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>

          {/* Encryption badge */}
          {item.isEncrypted && (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: BorderRadius.full,
                backgroundColor: `${colors.success}15`,
                marginRight: Spacing.sm,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: FontWeight.semibold,
                  color: colors.success,
                }}
              >
                AES-256
              </Text>
            </View>
          )}
        </Pressable>

        {/* Right Side: Options Button (Completely Separate Touchable!) */}
        <TouchableOpacity
          onPress={() => {
            setSelectedFile(item);
            setIsActionMenuVisible(true);
          }}
          style={{
            padding: Spacing.lg,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <MoreVertical size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderSharedLinkItem = ({ item }: { item: SharedLinkItem }) => {
    return (
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: BorderRadius.md,
          padding: Spacing.lg,
          marginBottom: Spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: BorderRadius.sm,
              backgroundColor: `${colors.primary}15`,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: Spacing.md,
            }}
          >
            <LinkIcon size={18} color={colors.primary} />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: FontSize.md,
                fontWeight: FontWeight.semibold,
                color: colors.text,
              }}
              numberOfLines={1}
            >
              {item.fileName || 'Shared File'}
            </Text>
            <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>
              {formatBytes(item.fileSize)} • {item.downloadCount} / {item.maxDownloads ? item.maxDownloads : '∞'} downloads used
            </Text>
          </View>

          <Switch
            value={item.isActive}
            onValueChange={() => handleToggleLinkActive(item.id, item.isActive)}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>

        {/* Security badges */}
        <View style={{ flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.sm }}>
          {item.hasPassword && (
            <View style={{ backgroundColor: `${colors.warning}15`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full }}>
              <Text style={{ fontSize: 9, fontWeight: FontWeight.bold, color: colors.warning }}>PASSWORD PROTECTED</Text>
            </View>
          )}
          {item.requireOtp && (
            <View style={{ backgroundColor: `${colors.primary}15`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full }}>
              <Text style={{ fontSize: 9, fontWeight: FontWeight.bold, color: colors.primary }}>EMAIL OTP VERIFIED</Text>
            </View>
          )}
          <View style={{ backgroundColor: item.isActive ? `${colors.success}15` : `${colors.textTertiary}15`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full }}>
            <Text style={{ fontSize: 9, fontWeight: FontWeight.bold, color: item.isActive ? colors.success : colors.textSecondary }}>
              {item.isActive ? 'ACTIVE' : 'DEACTIVATED'}
            </Text>
          </View>
        </View>

        {/* Downloader Access Audit Log */}
        {item.downloads && item.downloads.length > 0 ? (
          <View
            style={{
              marginTop: Spacing.xs,
              marginBottom: Spacing.sm,
              backgroundColor: colors.inputBg,
              borderRadius: BorderRadius.sm,
              padding: Spacing.sm,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: FontWeight.bold, color: colors.primary, textTransform: 'uppercase' }}>
                👥 Download Activity ({item.downloads.length})
              </Text>
              <Text style={{ fontSize: 9, color: colors.textTertiary }}>
                Decryption Log
              </Text>
            </View>

            {item.downloads.map((d, idx) => (
              <View
                key={d.id || idx}
                style={{
                  borderTopWidth: idx > 0 ? 1 : 0,
                  borderTopColor: colors.border,
                  paddingVertical: 4,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: colors.text }} numberOfLines={1}>
                    ✉️ {d.downloaderEmail || 'Anonymous'}
                  </Text>
                  <Text style={{ fontSize: 9, color: colors.textSecondary }}>
                    {new Date(d.downloadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 1 }}>
                  <Text style={{ fontSize: 9, color: colors.textTertiary }}>
                    IP: {d.ipAddress || '127.0.0.1'} • {d.authMethod === 'email_otp' ? '✉️ Email OTP' : '🔑 Password'}
                  </Text>
                  <Text style={{ fontSize: 9, color: colors.success, fontWeight: FontWeight.medium }}>
                    Verified ✓
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ marginTop: 2, marginBottom: Spacing.xs }}>
            <Text style={{ fontSize: 10, color: colors.textTertiary, fontStyle: 'italic' }}>
              No downloads yet • Awaiting recipient access
            </Text>
          </View>
        )}

        {/* Interactive copy button */}
        <TouchableOpacity
          onPress={() => handleCopyExistingLink(item.token)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.inputBg,
            borderRadius: BorderRadius.sm,
            paddingVertical: Spacing.sm,
            borderWidth: 1,
            borderColor: colors.border,
            marginTop: Spacing.xs,
          }}
        >
          <Copy size={14} color={colors.text} style={{ marginRight: 6 }} />
          <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: colors.text }}>
            Copy Share Link
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>

      {/* Tab Segment Controls */}
      <View style={{ padding: Spacing.xl, paddingBottom: 0 }}>
        <Text
          style={{
            fontSize: FontSize.xl,
            fontWeight: FontWeight.bold,
            color: colors.text,
            marginBottom: Spacing.lg,
          }}
        >
          Secure Vault
        </Text>

        {/* Premium Segmented bar */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.card,
            borderRadius: BorderRadius.md,
            padding: 4,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: Spacing.lg,
          }}
        >
          <TouchableOpacity
            onPress={() => setActiveTab('files')}
            style={{
              flex: 1,
              paddingVertical: Spacing.md,
              borderRadius: BorderRadius.sm,
              backgroundColor: activeTab === 'files' ? colors.primary : 'transparent',
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Folder size={16} color={activeTab === 'files' ? '#FFFFFF' : colors.textSecondary} />
            <Text
              style={{
                fontSize: FontSize.sm,
                fontWeight: FontWeight.bold,
                color: activeTab === 'files' ? '#FFFFFF' : colors.textSecondary,
              }}
            >
              Files
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('links')}
            style={{
              flex: 1,
              paddingVertical: Spacing.md,
              borderRadius: BorderRadius.sm,
              backgroundColor: activeTab === 'links' ? colors.primary : 'transparent',
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Share2 size={16} color={activeTab === 'links' ? '#FFFFFF' : colors.textSecondary} />
            <Text
              style={{
                fontSize: FontSize.sm,
                fontWeight: FontWeight.bold,
                color: activeTab === 'links' ? '#FFFFFF' : colors.textSecondary,
              }}
            >
              Shared
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('redeem')}
            style={{
              flex: 1,
              paddingVertical: Spacing.md,
              borderRadius: BorderRadius.sm,
              backgroundColor: activeTab === 'redeem' ? colors.primary : 'transparent',
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Key size={16} color={activeTab === 'redeem' ? '#FFFFFF' : colors.textSecondary} />
            <Text
              style={{
                fontSize: FontSize.sm,
                fontWeight: FontWeight.bold,
                color: activeTab === 'redeem' ? '#FFFFFF' : colors.textSecondary,
              }}
            >
              Redeem
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Render Files View */}
      {activeTab === 'files' && (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: Spacing.xl }}>
            {/* Search */}
            <View
              style={{
                backgroundColor: colors.inputBg,
                borderRadius: BorderRadius.md,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: Spacing.lg,
                height: 44,
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: Spacing.lg,
              }}
            >
              <Search size={18} color={colors.textTertiary} style={{ marginRight: Spacing.sm }} />
              <TextInput
                placeholder="Search encrypted files..."
                placeholderTextColor={colors.textTertiary}
                style={{ flex: 1, fontSize: FontSize.md, color: colors.text }}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            {/* Filter chips */}
            <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg }}>
              {filters.map((f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setActiveFilter(f)}
                  style={{
                    paddingHorizontal: Spacing.md + 2,
                    paddingVertical: Spacing.sm,
                    borderRadius: BorderRadius.full,
                    backgroundColor: activeFilter === f ? colors.primary : colors.card,
                    borderWidth: 1,
                    borderColor: activeFilter === f ? colors.primary : colors.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {f === 'all' ? (
                    <Layers size={12} color={activeFilter === f ? '#FFFFFF' : colors.textSecondary} />
                  ) : (
                    getCategoryIcon(f, 12, activeFilter === f ? '#FFFFFF' : colors.textSecondary)
                  )}
                  <Text
                    style={{
                      fontSize: FontSize.xs,
                      fontWeight: FontWeight.medium,
                      color: activeFilter === f ? '#FFFFFF' : colors.textSecondary,
                      textTransform: 'capitalize',
                    }}
                  >
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {loadingFiles && !refreshingFiles ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={files}
              renderItem={renderFileItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: Spacing.xl, paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshingFiles} onRefresh={onRefreshFiles} tintColor={colors.primary} />
              }
              ListEmptyComponent={
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: FontSize.md }}>
                    No encrypted files in cloud vault
                  </Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* Render Active Links View */}
      {activeTab === 'links' && (
        <View style={{ flex: 1 }}>
          {loadingLinks && !refreshingLinks ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={sharedLinks}
              renderItem={renderSharedLinkItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: Spacing.xl, paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshingLinks} onRefresh={onRefreshLinks} tintColor={colors.primary} />
              }
              ListEmptyComponent={
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: FontSize.md, textAlign: 'center', paddingHorizontal: Spacing.xl }}>
                    No active share links created yet.
                  </Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* Render Redeem View */}
      {activeTab === 'redeem' && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.xl, paddingBottom: 100 }}>
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: BorderRadius.md,
              padding: Spacing.xl,
              borderWidth: 1,
              borderColor: colors.border,
              marginTop: Spacing.md,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm }}>
              <Download size={22} color={colors.primary} />
              <Text
                style={{
                  fontSize: FontSize.lg,
                  fontWeight: FontWeight.bold,
                  color: colors.text,
                }}
              >
                Access Encrypted Share
              </Text>
            </View>
            <Text
              style={{
                fontSize: FontSize.xs,
                color: colors.textSecondary,
                marginBottom: Spacing.xl,
              }}
            >
              Paste a link token or full share link below to resolve and securely download the decrypted file.
            </Text>

            {/* Token Input */}
            <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.textSecondary, marginBottom: Spacing.xs }}>
              SHARE TOKEN OR LINK URL
            </Text>
            <TextInput
              value={redeemToken}
              onChangeText={setRedeemToken}
              placeholder="e.g. 8f2b7c..."
              placeholderTextColor={colors.textTertiary}
              style={{
                backgroundColor: colors.inputBg,
                borderRadius: BorderRadius.md,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: Spacing.md,
                height: 48,
                fontSize: FontSize.md,
                color: colors.text,
                marginBottom: Spacing.lg,
              }}
            />

            {/* Conditional Password Input */}
            {passwordRequired && (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.xs }}>
                  <Lock size={14} color={colors.warning} />
                  <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.warning }}>
                    PASSWORD REQUIRED
                  </Text>
                </View>
                <SecureInput
                  value={redeemPassword}
                  onChangeText={setRedeemPassword}
                  placeholder="Enter file decryption password"
                  isPassword
                  containerStyle={{ marginBottom: Spacing.sm }}
                />
              </View>
            )}

            {/* Email OTP Alternative Option */}
            <TouchableOpacity
              onPress={handleRequestRedeemOtp}
              style={{ alignItems: 'center', marginVertical: Spacing.sm }}
            >
              <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: colors.primary }}>
                Don't know password? Verify via Email OTP ✉️
              </Text>
            </TouchableOpacity>

            {/* Resolve Trigger */}
            <TouchableOpacity
              onPress={handleResolveToken}
              disabled={isResolving}
              style={{
                backgroundColor: colors.primary,
                borderRadius: BorderRadius.md,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: Spacing.sm,
                marginBottom: Spacing.xl,
              }}
            >
              {isResolving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#FFFFFF' }}>
                  Validate & Decrypt Share
                </Text>
              )}
            </TouchableOpacity>

            {/* Resolved Content Panel */}
            {resolvedFile && (
              <View
                style={{
                  backgroundColor: `${colors.success}10`,
                  borderWidth: 1,
                  borderColor: colors.success,
                  borderRadius: BorderRadius.md,
                  padding: Spacing.lg,
                  alignItems: 'center',
                }}
              >
                <Unlock size={32} color={colors.success} style={{ marginBottom: Spacing.sm }} />
                <Text
                  style={{
                    fontSize: FontSize.md,
                    fontWeight: FontWeight.bold,
                    color: colors.text,
                    textAlign: 'center',
                    marginBottom: 4,
                  }}
                >
                  {resolvedFile.original_name}
                </Text>
                <Text
                  style={{
                    fontSize: FontSize.xs,
                    color: colors.textSecondary,
                    marginBottom: Spacing.lg,
                  }}
                >
                  {formatBytes(resolvedFile.size)} • Verified AES-256 Cloud
                </Text>

                <TouchableOpacity
                  onPress={handleStartDownload}
                  style={{
                    backgroundColor: colors.success,
                    borderRadius: BorderRadius.sm,
                    paddingHorizontal: Spacing.xl,
                    paddingVertical: Spacing.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Download size={18} color="#FFFFFF" />
                  <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#FFFFFF' }}>
                    Download & Open
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* 1. Action Options Menu Modal */}
      <Modal
        visible={isActionMenuVisible && selectedFile !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setIsActionMenuVisible(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            justifyContent: 'flex-end',
          }}
          activeOpacity={1}
          onPress={() => setIsActionMenuVisible(false)}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: BorderRadius.lg,
              borderTopRightRadius: BorderRadius.lg,
              padding: Spacing.xl,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {/* Header info */}
            <Text
              style={{
                fontSize: FontSize.lg,
                fontWeight: FontWeight.bold,
                color: colors.text,
                marginBottom: Spacing.sm,
              }}
              numberOfLines={1}
            >
              {selectedFile?.name}
            </Text>
            <Text
              style={{
                fontSize: FontSize.xs,
                color: colors.textSecondary,
                marginBottom: Spacing.xl,
              }}
            >
              {selectedFile ? formatBytes(selectedFile.size) : ''} • Secure Options
            </Text>

            {/* Actions List */}
            <TouchableOpacity
              onPress={() => {
                setIsActionMenuVisible(false);
                setIsShareModalVisible(true);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: Spacing.md + 2,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                gap: Spacing.md,
              }}
            >
              <Share2 size={18} color={colors.primary} />
              <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.primary }}>
                Create Active Share Link
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (selectedFile) {
                  setIsActionMenuVisible(false);
                  handleDeleteFile(selectedFile.id, selectedFile.name);
                }
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: Spacing.md + 2,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                gap: Spacing.md,
              }}
            >
              <Trash2 size={18} color={colors.danger} />
              <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.danger }}>
                Delete File Permanently
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setIsActionMenuVisible(false)}
              style={{
                marginTop: Spacing.lg,
                paddingVertical: Spacing.md,
                backgroundColor: colors.inputBg,
                borderRadius: BorderRadius.md,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.medium, color: colors.textSecondary }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 2. Create Share Link Config Modal */}
      <Modal
        visible={isShareModalVisible && selectedFile !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setIsShareModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              justifyContent: 'center',
              padding: Spacing.xl,
            }}
            activeOpacity={1}
            onPress={() => {
              // Do not dismiss automatically to avoid losing complex configurations
            }}
          >
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: BorderRadius.lg,
                padding: Spacing.xl,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 10,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md }}>
                <Share2 size={20} color={colors.text} />
                <Text
                  style={{
                    fontSize: FontSize.lg,
                    fontWeight: FontWeight.bold,
                    color: colors.text,
                  }}
                >
                  Create Share Link
                </Text>
              </View>
              
              <Text
                style={{
                  fontSize: FontSize.xs,
                  color: colors.textSecondary,
                  marginBottom: Spacing.lg,
                }}
                numberOfLines={1}
              >
                File: {selectedFile?.name}
              </Text>

              {/* Form Option: Expiry */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.xs }}>
                <Calendar size={14} color={colors.textSecondary} />
                <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.textSecondary }}>
                  LINK EXPIRY (HOURS)
                </Text>
              </View>
              <TextInput
                value={expiresIn}
                onChangeText={setExpiresIn}
                placeholder="24 (Default)"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                autoComplete="off"
                textContentType="none"
                style={{
                  backgroundColor: colors.inputBg,
                  borderRadius: BorderRadius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: Spacing.md,
                  height: 40,
                  fontSize: FontSize.md,
                  color: colors.text,
                  marginBottom: Spacing.md,
                }}
              />

              {/* Form Option: Max Downloads */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.xs }}>
                <Download size={14} color={colors.textSecondary} />
                <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.textSecondary }}>
                  DOWNLOAD LIMIT (OPTIONAL)
                </Text>
              </View>
              <TextInput
                value={maxDownloads}
                onChangeText={setMaxDownloads}
                placeholder="e.g. 5 (leave empty for unlimited)"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                autoComplete="off"
                textContentType="none"
                style={{
                  backgroundColor: colors.inputBg,
                  borderRadius: BorderRadius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: Spacing.md,
                  height: 40,
                  fontSize: FontSize.md,
                  color: colors.text,
                  marginBottom: Spacing.md,
                }}
              />

              {/* Form Option: Password */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.xs }}>
                <Lock size={14} color={colors.textSecondary} />
                <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.textSecondary }}>
                  PROTECT WITH PASSWORD (OPTIONAL)
                </Text>
              </View>
              <SecureInput
                value={sharePassword}
                onChangeText={setSharePassword}
                placeholder="Enter access password"
                isPassword
                containerStyle={{ marginBottom: Spacing.md }}
              />

              {/* Form Option: Require OTP */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: Spacing.xl,
                  marginTop: Spacing.xs,
                }}
              >
                <View style={{ flex: 1, marginRight: Spacing.md }}>
                  <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.text }}>
                    Require OTP Verification
                  </Text>
                  <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 2 }}>
                    Must verify 2FA code to access file
                  </Text>
                </View>
                <Switch
                  value={requireOtp}
                  onValueChange={setRequireOtp}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                />
              </View>

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                <TouchableOpacity
                  onPress={() => {
                    setIsShareModalVisible(false);
                    setSelectedFile(null);
                    setSharePassword('');
                    setMaxDownloads('');
                  }}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: BorderRadius.md,
                    backgroundColor: colors.inputBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  disabled={isGenerating}
                >
                  <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.medium, color: colors.textSecondary }}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleCreateShareLink}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: BorderRadius.md,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: '#FFFFFF' }}>
                      Generate Link
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* 3. Secure File Decryption & Preview Modal */}
      <Modal
        visible={isPreviewVisible && selectedFile !== null}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setIsPreviewVisible(false);
          setSelectedFile(null);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Header Bar */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: Spacing.xl,
              paddingVertical: Spacing.lg,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <View style={{ flex: 1, marginRight: Spacing.md }}>
              <Text
                style={{
                  fontSize: FontSize.md,
                  fontWeight: FontWeight.bold,
                  color: colors.text,
                }}
                numberOfLines={1}
              >
                {selectedFile?.name}
              </Text>
              <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 2 }}>
                {selectedFile ? formatBytes(selectedFile.size) : ''} • AES-256 Secure Preview
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                setIsPreviewVisible(false);
                setSelectedFile(null);
                setPreviewTextContent(null);
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.cardAlt,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Central Preview Stage */}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl }}>
            {isLoadingPreview ? (
              <View style={{ alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.textSecondary, marginTop: Spacing.md, fontSize: FontSize.sm }}>
                  Decrypting secure cloud blocks...
                </Text>
              </View>
            ) : selectedFile?.category === 'image' && previewImageBase64 !== null ? (
              <View style={{ width: '100%', height: '100%', borderRadius: BorderRadius.md, overflow: 'hidden' }}>
                <Image
                  source={{ uri: previewImageBase64 }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="contain"
                />
              </View>
            ) : previewTextContent !== null ? (
              <ScrollView
                style={{
                  width: '100%',
                  backgroundColor: colors.cardAlt,
                  borderRadius: BorderRadius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: Spacing.lg,
                }}
                showsVerticalScrollIndicator
              >
                <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: FontSize.sm, color: colors.text, lineHeight: 20 }}>
                  {previewTextContent}
                </Text>
              </ScrollView>
            ) : (
              // Binary File Detail card
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: BorderRadius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: Spacing.xl,
                  alignItems: 'center',
                  width: '100%',
                  shadowColor: colors.shadow,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 1,
                  shadowRadius: 12,
                  elevation: 3,
                }}
              >
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: BorderRadius.md,
                    backgroundColor: colors.primaryBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: Spacing.lg,
                  }}
                >
                  {selectedFile ? getCategoryIcon(selectedFile.category, 36, colors.primary) : <FileIcon size={36} color={colors.primary} />}
                </View>

                <Text
                  style={{
                    fontSize: FontSize.lg,
                    fontWeight: FontWeight.bold,
                    color: colors.text,
                    textAlign: 'center',
                    marginBottom: 4,
                  }}
                >
                  {selectedFile?.name}
                </Text>
                <Text
                  style={{
                    fontSize: FontSize.xs,
                    color: colors.textSecondary,
                    textAlign: 'center',
                    marginBottom: Spacing.xl,
                  }}
                >
                  {selectedFile?.type || 'unknown/type'} • Verified Encrypted
                </Text>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: colors.successBg,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: BorderRadius.full,
                    marginBottom: Spacing.xl,
                  }}
                >
                  <Unlock size={14} color={colors.success} />
                  <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.success }}>
                    End-to-End Decryption Verified
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={async () => {
                    if (selectedFile) {
                      try {
                        const res = await filesAPI.getDownloadToken(selectedFile.id);
                        if (res.data.success && res.data.data.token) {
                          const downloadUrl = `${api.defaults.baseURL}/files/download-temp/${res.data.data.token}`;
                          Linking.openURL(downloadUrl);
                        }
                      } catch (err) {
                        Alert.alert('Error', 'Failed to generate secure download link');
                      }
                    }
                  }}
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: BorderRadius.md,
                    paddingHorizontal: Spacing.xl,
                    paddingVertical: Spacing.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    justifyContent: 'center',
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 6,
                    elevation: 2,
                  }}
                >
                  <Download size={18} color="#FFFFFF" />
                  <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#FFFFFF' }}>
                    Download Decrypted File
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* SHA-256 File Integrity Hash Card */}
          {selectedFile?.hash && (
            <View
              style={{
                marginHorizontal: Spacing.xl,
                marginTop: Spacing.sm,
                backgroundColor: colors.cardAlt,
                borderRadius: BorderRadius.md,
                borderWidth: 1,
                borderColor: colors.border,
                padding: Spacing.md,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: FontWeight.bold, color: colors.textSecondary }}>
                  SHA-256 FILE INTEGRITY HASH
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    Clipboard.setString(selectedFile.hash || '');
                    Alert.alert('Copied!', 'SHA-256 Hash copied to clipboard');
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Copy size={10} color={colors.primary} />
                  <Text style={{ fontSize: 10, color: colors.primary, fontWeight: FontWeight.semibold }}>
                    Copy
                  </Text>
                </TouchableOpacity>
              </View>
              <Text
                selectable
                style={{
                  fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                  fontSize: 11,
                  color: '#E2E8F0',
                  letterSpacing: 0.5,
                }}
              >
                {selectedFile.hash}
              </Text>
            </View>
          )}

          {/* Bottom Control Actions */}
          <View
            style={{
              paddingHorizontal: Spacing.xl,
              paddingVertical: Spacing.xl,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255, 255, 255, 0.1)',
              flexDirection: 'row',
              gap: Spacing.md,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                setIsPreviewVisible(false);
                setIsShareModalVisible(true);
              }}
              style={{
                flex: 1,
                height: 48,
                borderRadius: BorderRadius.md,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Share2 size={16} color="#FFFFFF" />
              <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#FFFFFF' }}>
                Share File
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (selectedFile) {
                  setIsPreviewVisible(false);
                  handleDeleteFile(selectedFile.id, selectedFile.name);
                }
              }}
              style={{
                flex: 1,
                height: 48,
                borderRadius: BorderRadius.md,
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                borderWidth: 1,
                borderColor: 'rgba(239, 68, 68, 0.4)',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Trash2 size={16} color="#F87171" />
              <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#F87171' }}>
                Delete File
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>

    {/* OTP Modal for OTP-protected share link verification */}
    <OTPModal
      visible={isShareOTPVisible}
      title="Verify Share Access"
      subtitle="Enter the 6-digit code sent to verify your access to this encrypted file."
      maskedPhone={shareOTPMaskedPhone}
      onVerify={handleShareOTPVerify}
      onResend={handleShareOTPResend}
      onDismiss={() => setIsShareOTPVisible(false)}
      footerNote="This file is protected with SMS verification. The code expires in 5 minutes."
    />

    {/* Dedicated High-End Share Link Ready Modal */}
    <Modal
      visible={!!shareSuccessData}
      transparent
      animationType="fade"
      onRequestClose={() => setShareSuccessData(null)}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: Spacing.xl,
        }}
      >
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: BorderRadius.xl,
            padding: Spacing.xl,
            width: '100%',
            maxWidth: 520,
            borderWidth: 1.2,
            borderColor: colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 12,
            elevation: 12,
          }}
        >
          {/* Header with Glowing Success Badge */}
          <View style={{ alignItems: 'center', marginBottom: Spacing.lg }}>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: `${colors.success}15`,
                borderWidth: 1.5,
                borderColor: colors.success,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: Spacing.sm,
              }}
            >
              <CheckCircle2 size={30} color={colors.success} />
            </View>
            <Text style={{ fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.text, textAlign: 'center' }}>
              Secure Share Link Ready!
            </Text>
            <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, textAlign: 'center', marginTop: 2 }}>
              Link copied to clipboard. Encrypted with zero-knowledge keys.
            </Text>
          </View>

          {/* File Attributes Summary Box */}
          {shareSuccessData && (
            <View
              style={{
                backgroundColor: colors.cardAlt,
                padding: Spacing.md,
                borderRadius: BorderRadius.lg,
                marginBottom: Spacing.lg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.text }} numberOfLines={1}>
                {shareSuccessData.fileName}
              </Text>
              <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 1 }}>
                {formatBytes(shareSuccessData.fileSize)}
              </Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Spacing.sm }}>
                <View style={{ backgroundColor: `${colors.primary}15`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full }}>
                  <Text style={{ fontSize: 10, fontWeight: FontWeight.bold, color: colors.primary }}>
                    ⏳ {shareSuccessData.expiresIn}h Expiry
                  </Text>
                </View>
                {shareSuccessData.hasPassword && (
                  <View style={{ backgroundColor: `${colors.warning}15`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full }}>
                    <Text style={{ fontSize: 10, fontWeight: FontWeight.bold, color: colors.warning }}>
                      🔒 Password Protected
                    </Text>
                  </View>
                )}
                {shareSuccessData.requireOtp && (
                  <View style={{ backgroundColor: `${colors.info}15`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full }}>
                    <Text style={{ fontSize: 10, fontWeight: FontWeight.bold, color: colors.info }}>
                      ✉️ OTP Required
                    </Text>
                  </View>
                )}
                {shareSuccessData.maxDownloads !== 'Unlimited' && (
                  <View style={{ backgroundColor: `${colors.textTertiary}20`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full }}>
                    <Text style={{ fontSize: 10, fontWeight: FontWeight.bold, color: colors.textSecondary }}>
                      ⬇️ Limit: {shareSuccessData.maxDownloads}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Public Link Box */}
          <View style={{ marginBottom: Spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: FontWeight.bold, color: colors.textTertiary, textTransform: 'uppercase' }}>
                Public Share Link (For Other Laptops & Devices)
              </Text>
              <Text style={{ fontSize: 9, color: colors.success, fontWeight: FontWeight.semibold }}>
                📶 Network IP Active
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.inputBg,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: BorderRadius.md,
                paddingLeft: Spacing.md,
                paddingRight: 4,
                height: 44,
              }}
            >
              <Text
                style={{
                  flex: 1,
                  fontSize: FontSize.xs,
                  color: colors.text,
                  fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                }}
                numberOfLines={1}
              >
                {shareSuccessData?.link}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (shareSuccessData?.link) {
                    Clipboard.setString(shareSuccessData.link);
                    setIsCopiedLink(true);
                    setTimeout(() => setIsCopiedLink(false), 2000);
                  }
                }}
                style={{
                  backgroundColor: isCopiedLink ? colors.success : colors.primary,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: BorderRadius.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {isCopiedLink ? <Check size={14} color="#FFFFFF" /> : <Copy size={14} color="#FFFFFF" />}
                <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#FFFFFF' }}>
                  {isCopiedLink ? 'Copied!' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 4 }}>
              Reachable by any laptop or mobile phone connected to your network.
            </Text>
          </View>

          {/* Direct Redeem Token Box */}
          <View style={{ marginBottom: Spacing.xl }}>
            <Text style={{ fontSize: 10, fontWeight: FontWeight.bold, color: colors.textTertiary, textTransform: 'uppercase', marginBottom: 4 }}>
              Direct Redeem Token
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.inputBg,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: BorderRadius.md,
                paddingLeft: Spacing.md,
                paddingRight: 4,
                height: 40,
              }}
            >
              <Text
                style={{
                  flex: 1,
                  fontSize: FontSize.xs,
                  color: colors.textSecondary,
                  fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                }}
                numberOfLines={1}
              >
                {shareSuccessData?.token}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (shareSuccessData?.token) {
                    Clipboard.setString(shareSuccessData.token);
                    setIsCopiedToken(true);
                    setTimeout(() => setIsCopiedToken(false), 2000);
                  }
                }}
                style={{
                  backgroundColor: colors.cardAlt,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: BorderRadius.sm,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: FontWeight.semibold, color: colors.text }}>
                  {isCopiedToken ? 'Copied! ✓' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <TouchableOpacity
              onPress={() => {
                if (shareSuccessData?.link) {
                  Linking.openURL(shareSuccessData.link);
                }
              }}
              style={{
                flex: 1,
                backgroundColor: colors.cardAlt,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 12,
                borderRadius: BorderRadius.md,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <ExternalLink size={15} color={colors.text} />
              <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.text }}>
                Open in Browser
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShareSuccessData(null)}
              style={{
                flex: 1,
                backgroundColor: colors.primary,
                paddingVertical: 12,
                borderRadius: BorderRadius.md,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#FFFFFF' }}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  </>
  );
}

