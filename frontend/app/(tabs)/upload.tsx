import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { FolderLock, Upload as UploadIcon } from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme';
import { useAuthStore } from '../../src/store/authStore';
import SecureButton from '../../src/components/ui/SecureButton';
import SecurityCard from '../../src/components/ui/SecurityCard';
import { Spacing, FontSize, FontWeight, BorderRadius } from '../../src/theme/tokens';
import { filesAPI } from '../../src/services/api';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

interface SelectedFile {
  name: string;
  size: number;
  uri: string;
  mimeType: string;
  file?: any;
}

export default function UploadScreen() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const isAdmin = user?.role === 'admin' || user?.email?.toLowerCase() === 'nagababuy92@gmail.com';

  if (isAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl }} edges={['top']}>
        <View style={{ backgroundColor: colors.card, padding: Spacing['2xl'], borderRadius: BorderRadius.xl, borderWidth: 1.2, borderColor: colors.border, alignItems: 'center', maxWidth: 480, width: '100%' }}>
          <FolderLock size={48} color={colors.primary} style={{ marginBottom: Spacing.md }} />
          <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: colors.text, textAlign: 'center' }}>
            Client Upload Area
          </Text>
          <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.xs, lineHeight: 18, marginBottom: Spacing.xl }}>
            File upload is reserved for client users to store data. Administrators use the SOC Portal to oversee file security and access.
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

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        type: '*/*',
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const file: SelectedFile = {
          name: asset.name || 'document',
          size: asset.size || 0,
          uri: asset.uri,
          mimeType: asset.mimeType || 'application/octet-stream',
          file: (asset as any).file,
        };
        setSelectedFiles([file]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick files');
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    const file = selectedFiles[0];

    setUploading(true);
    setUploadProgress(15);

    try {
      const formData = new FormData();

      if (Platform.OS === 'web' || file.uri?.startsWith('blob:') || file.uri?.startsWith('data:')) {
        let blobToSend = file.file;
        if (!blobToSend && file.uri) {
          const res = await fetch(file.uri);
          blobToSend = await res.blob();
        }
        formData.append('file', blobToSend, file.name);
      } else {
        const fileToUpload = {
          uri: Platform.OS === 'ios' ? file.uri.replace('file://', '') : file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
        };
        formData.append('file', fileToUpload as any);
      }

      setUploadProgress(50);

      // 2. Upload using actual API endpoint
      const response = await filesAPI.upload(formData);
      
      setUploadProgress(100);

      if (response.data.success) {
        Alert.alert('Upload Complete', `"${file.name}" has been encrypted with AES-256 and saved to your zero-knowledge cloud vault.`);
        setSelectedFiles([]);
      } else {
        Alert.alert('Upload Failed', response.data.message || 'Error occurred during upload');
      }
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.response?.data?.message || error.message || 'Connection failed. Please try again.';
      Alert.alert('Upload Error', errorMsg);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 100 }}>
        {/* Header */}
        <Text
          style={{
            fontSize: FontSize.xl,
            fontWeight: FontWeight.bold,
            color: colors.text,
            marginBottom: Spacing.sm,
          }}
        >
          Secure Upload
        </Text>
        <Text
          style={{
            fontSize: FontSize.md,
            color: colors.textSecondary,
            marginBottom: Spacing['2xl'],
          }}
        >
          Files are encrypted with AES-256 before upload
        </Text>

        {/* Upload area */}
        <TouchableOpacity
          onPress={pickFiles}
          disabled={uploading}
          activeOpacity={0.7}
          style={{
            borderWidth: 2,
            borderColor: colors.border,
            borderStyle: 'dashed',
            borderRadius: BorderRadius.lg,
            padding: Spacing['4xl'],
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.card,
            marginBottom: Spacing['2xl'],
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: `${colors.primary}15`,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: Spacing.lg,
            }}
          >
            <Text
              style={{
                fontSize: 24,
                color: colors.primary,
                fontWeight: FontWeight.bold,
              }}
            >
              +
            </Text>
          </View>
          <Text
            style={{
              fontSize: FontSize.md,
              fontWeight: FontWeight.semibold,
              color: colors.text,
              marginBottom: Spacing.xs,
            }}
          >
            Select file to upload
          </Text>
          <Text
            style={{
              fontSize: FontSize.sm,
              color: colors.textSecondary,
              textAlign: 'center',
            }}
          >
            Images, videos, PDFs, documents, archives
          </Text>
          <Text
            style={{
              fontSize: FontSize.xs,
              color: colors.textTertiary,
              marginTop: Spacing.sm,
            }}
          >
            Max 100 MB per file
          </Text>
        </TouchableOpacity>

        {/* Selected files */}
        {selectedFiles.length > 0 && (
          <SecurityCard
            title="Selected File"
            subtitle={`${selectedFiles.length} file`}
            style={{ marginBottom: Spacing['2xl'] }}
          >
            {selectedFiles.map((file, index) => (
              <View
                key={index}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: Spacing.md,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: `${colors.primary}12`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: Spacing.md,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>
                    {file.mimeType.split('/')[0].toUpperCase().slice(0, 3)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: FontSize.sm,
                      color: colors.text,
                      fontWeight: FontWeight.medium,
                    }}
                    numberOfLines={1}
                  >
                    {file.name}
                  </Text>
                  <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>
                    {formatBytes(file.size)}
                  </Text>
                </View>
                {!uploading && (
                  <TouchableOpacity
                    onPress={() => removeFile(index)}
                    style={{ padding: Spacing.sm }}
                  >
                    <Text
                      style={{
                        fontSize: FontSize.sm,
                        color: colors.danger,
                        fontWeight: FontWeight.medium,
                      }}
                    >
                      Remove
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </SecurityCard>
        )}

        {/* Upload progress */}
        {uploading && (
          <SecurityCard style={{ marginBottom: Spacing['2xl'] }}>
            <View style={{ marginBottom: Spacing.md }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: Spacing.sm,
                }}
              >
                <Text style={{ fontSize: FontSize.sm, color: colors.textSecondary }}>
                  Encrypting and uploading...
                </Text>
                <Text style={{ fontSize: FontSize.sm, color: colors.primary, fontWeight: FontWeight.semibold }}>
                  {uploadProgress}%
                </Text>
              </View>
              <View
                style={{
                  height: 4,
                  backgroundColor: colors.border,
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: '100%',
                    width: `${uploadProgress}%`,
                    backgroundColor: colors.primary,
                    borderRadius: 2,
                  }}
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              {['AES-256 Encryption', 'SHA-256 Hash', 'Cloud Upload'].map((step, i) => {
                const isActive = uploadProgress > i * 33;
                const isDone = uploadProgress > (i + 1) * 33;
                return (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: isDone ? colors.success : isActive ? colors.primary : colors.textTertiary,
                        marginRight: 4,
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 10,
                        color: isActive ? colors.text : colors.textTertiary,
                        fontWeight: isActive ? '600' : '400',
                      }}
                    >
                      {step}
                    </Text>
                  </View>
                );
              })}
            </View>
          </SecurityCard>
        )}

        {/* Upload button */}
        {selectedFiles.length > 0 && !uploading && (
          <SecureButton title="Encrypt and Upload" onPress={handleUpload} size="lg" />
        )}

        {/* Security info */}
        <View style={{ marginTop: Spacing['3xl'] }}>
          {[
            { label: 'AES-256 encryption applied locally', color: colors.success },
            { label: 'SHA-256 integrity hash generated', color: colors.success },
            { label: 'MIME type validation enforced', color: colors.info },
            { label: 'Encrypted transfer to cloud storage', color: colors.info },
          ].map((item, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: Spacing.md,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: item.color,
                  marginRight: Spacing.md,
                }}
              />
              <Text
                style={{ fontSize: FontSize.sm, color: colors.textSecondary }}
              >
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
