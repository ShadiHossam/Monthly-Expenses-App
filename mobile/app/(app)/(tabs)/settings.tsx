import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView,
  Switch, Alert, ActivityIndicator, Modal as RNModal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { api } from '../../../lib/api';
import { MSIcon } from '../../../components/ui/MSIcon';
import { LIGHT, DARK } from '../../../constants/colors';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { isDark, toggleDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [profileEmail, setProfileEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  useEffect(() => { if (user?.email) setProfileEmail(user.email); }, [user]);

  async function handleProfileSave() {
    setProfileSaving(true); setProfileError(''); setProfileSaved(false);
    try {
      const payload: any = {};
      if (profileEmail !== user?.email) payload.email = profileEmail;
      if (newPassword) { payload.currentPassword = currentPassword; payload.newPassword = newPassword; }
      if (Object.keys(payload).length === 0) { setProfileSaving(false); return; }
      await api.updateProfile(payload);
      setProfileSaved(true);
      setCurrentPassword(''); setNewPassword('');
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to save');
    } finally { setProfileSaving(false); }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'DELETE') return;
    try {
      await api.deleteAccount('DELETE');
      await logout();
    } catch (err: any) {
      setProfileError(err.message || 'Failed to delete account');
    }
  }

  const inactiveColor = isDark ? DARK.onSurfaceVariant : LIGHT.onSurfaceVariant;

  const inputClass = 'w-full text-sm bg-ft-surface-low dark:bg-ve-surface-high border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2.5 text-ft-on-surface dark:text-ve-on-surface';

  return (
    <ScrollView
      className="flex-1 bg-ft-background dark:bg-ve-background"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 100, paddingHorizontal: 16 }}
    >
      <Text className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface mb-6">Settings</Text>

      {/* Account info */}
      <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl overflow-hidden mb-4">
        <View className="px-5 py-4 border-b border-ft-outline-variant dark:border-ve-outline flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: (isDark ? DARK.primary : LIGHT.primary) + '15' }}>
            <MSIcon name="person" size={20} color={isDark ? DARK.primary : LIGHT.primary} />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="font-semibold text-ft-on-surface dark:text-ve-on-surface" numberOfLines={1}>{user?.username ?? '—'}</Text>
            {user?.email ? <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant" numberOfLines={1}>{user.email}</Text> : null}
          </View>
        </View>
        <View className="px-5 py-3 flex-row items-center justify-between">
          <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">User ID</Text>
          <Text className="text-xs font-mono text-ft-on-surface dark:text-ve-on-surface">#{user?.id}</Text>
        </View>
      </View>

      {/* Appearance */}
      <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl overflow-hidden mb-4">
        <View className="px-5 py-4 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <MSIcon name={isDark ? 'light_mode' : 'dark_mode'} size={20} color={inactiveColor} />
            <Text className="text-sm text-ft-on-surface dark:text-ve-on-surface">{isDark ? 'Light mode' : 'Dark mode'}</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleDark}
            trackColor={{ false: isDark ? DARK.outline : LIGHT.outlineVariant, true: isDark ? DARK.primary : LIGHT.primary }}
            thumbColor="white"
          />
        </View>
      </View>

      {/* Change credentials */}
      <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 mb-4 gap-4">
        <Text className="text-xs font-semibold text-ft-on-surface-variant dark:text-ve-on-surface-variant uppercase tracking-wider">Change Credentials</Text>

        {profileError ? (
          <View className="bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">
            <Text className="text-red-500 text-sm">{profileError}</Text>
          </View>
        ) : null}

        <View className="gap-1.5">
          <Text className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant">Email</Text>
          <TextInput
            className={inputClass}
            value={profileEmail}
            onChangeText={setProfileEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={inactiveColor}
          />
        </View>
        <View className="gap-1.5">
          <Text className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant">Current password</Text>
          <TextInput
            className={inputClass}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            placeholder="Required to change password"
            placeholderTextColor={inactiveColor}
          />
        </View>
        <View className="gap-1.5">
          <Text className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant">New password</Text>
          <TextInput
            className={inputClass}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="Leave blank to keep current"
            placeholderTextColor={inactiveColor}
          />
        </View>

        <Pressable
          onPress={handleProfileSave}
          disabled={profileSaving}
          style={({ pressed }) => ({ opacity: pressed || profileSaving ? 0.7 : 1 })}
          className="px-4 py-2 bg-ft-primary dark:bg-ve-primary rounded-xl items-center self-start"
        >
          {profileSaving
            ? <ActivityIndicator size="small" color="white" />
            : <Text className="text-white text-sm font-medium">{profileSaved ? 'Saved!' : 'Save changes'}</Text>
          }
        </Pressable>

        <Pressable onPress={() => setShowDeleteModal(true)}>
          <Text className="text-red-500 dark:text-red-400 text-sm underline">Delete account</Text>
        </Pressable>
      </View>

      {/* Log out */}
      <Pressable
        onPress={() => Alert.alert('Log out?', 'You will need to sign in again.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log out', style: 'destructive', onPress: logout },
        ])}
        className="w-full py-3 flex-row items-center justify-center gap-2 bg-red-50 dark:bg-ve-error/10 border border-red-100 dark:border-ve-error/20 rounded-2xl"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <MSIcon name="logout" size={18} color={isDark ? DARK.error : '#ef4444'} />
        <Text className="text-sm font-semibold text-red-600 dark:text-ve-error">Log Out</Text>
      </Pressable>

      {/* Delete account modal */}
      <RNModal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 }} onPress={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}>
            <Pressable style={{ backgroundColor: isDark ? DARK.surface : LIGHT.surface, borderRadius: 16, padding: 24, width: '100%', borderWidth: 1, borderColor: isDark ? DARK.outline : LIGHT.outlineVariant }} onPress={e => e.stopPropagation()}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: isDark ? DARK.onSurface : LIGHT.onSurface, marginBottom: 8 }}>Delete account?</Text>
              <Text style={{ fontSize: 14, color: inactiveColor, marginBottom: 16 }}>
                This permanently deletes all your data. Type{' '}
                <Text style={{ fontWeight: '700', color: isDark ? DARK.error : '#ef4444' }}>DELETE</Text>
                {' '}to confirm.
              </Text>
              <TextInput
                value={deleteConfirm}
                onChangeText={setDeleteConfirm}
                placeholder="DELETE"
                placeholderTextColor={inactiveColor}
                style={{ borderWidth: 1, borderColor: isDark ? DARK.outline : LIGHT.outlineVariant, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: isDark ? DARK.onSurface : LIGHT.onSurface, marginBottom: 16, backgroundColor: isDark ? DARK.surfaceHigh : LIGHT.surfaceLow }}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}
                  style={{ flex: 1, borderWidth: 1, borderColor: isDark ? DARK.outline : LIGHT.outlineVariant, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 14, color: isDark ? DARK.onSurface : LIGHT.onSurface }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleDeleteAccount}
                  disabled={deleteConfirm !== 'DELETE'}
                  style={{ flex: 1, backgroundColor: '#ef4444', borderRadius: 12, paddingVertical: 10, alignItems: 'center', opacity: deleteConfirm !== 'DELETE' ? 0.4 : 1 }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: 'white' }}>Delete</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </RNModal>
    </ScrollView>
  );
}
