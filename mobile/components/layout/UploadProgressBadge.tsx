import { Pressable, View, Text } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUploadContext } from '../../context/UploadContext';
import { ProgressBar } from '../ui/ProgressBar';
import { useTheme } from '../../context/ThemeContext';
import { LIGHT, DARK } from '../../constants/colors';

const TAB_BAR_HEIGHT = 58;

export function UploadProgressBadge() {
  const { entries, hasActiveUploads } = useUploadContext();
  const { isDark } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  if (!hasActiveUploads || pathname.includes('upload')) return null;

  const active = entries.filter(e => e.status === 'uploading' || e.status === 'processing');
  const queued = entries.filter(e => e.status === 'queued');
  const maxPct = active.length > 0 ? Math.max(...active.map(e => e.progress?.pct ?? 5)) : 0;

  return (
    <Pressable
      onPress={() => router.push('/(app)/(tabs)/upload')}
      style={{
        position: 'absolute',
        bottom: insets.bottom + TAB_BAR_HEIGHT + 8,
        right: 72,
        backgroundColor: isDark ? DARK.surface : LIGHT.surface,
        borderWidth: 1,
        borderColor: isDark ? DARK.outline : LIGHT.outlineVariant,
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 6,
      }}
    >
      <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: isDark ? DARK.primary : LIGHT.primary, borderTopColor: 'transparent', transform: [{ rotate: '0deg' }] }} />
      <View>
        <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? DARK.onSurface : LIGHT.onSurface }}>
          {active.length} uploading{queued.length > 0 ? `, ${queued.length} queued` : ''}
        </Text>
        {active.length > 0 && (
          <View style={{ marginTop: 3, width: 100 }}>
            <ProgressBar pct={maxPct} height={4} color={isDark ? DARK.primary : LIGHT.primary} />
          </View>
        )}
      </View>
    </Pressable>
  );
}
