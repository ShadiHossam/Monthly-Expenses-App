import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUploadContext } from '../../context/UploadContext';
import { MSIcon } from '../ui/MSIcon';
import { useTheme } from '../../context/ThemeContext';
import { LIGHT, DARK } from '../../constants/colors';

const TAB_BAR_HEIGHT = 58;

export function UploadDoneToasts() {
  const { notifications, clearNotifications } = useUploadContext();
  const { isDark } = useTheme();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState<typeof notifications>([]);

  useEffect(() => {
    if (!pathname.includes('upload') && notifications.length > 0) {
      setVisible(notifications);
      clearNotifications();
      const t = setTimeout(() => setVisible([]), 5000);
      return () => clearTimeout(t);
    }
  }, [pathname, notifications, clearNotifications]);

  if (visible.length === 0) return null;

  return (
    <View
      style={{
        position: 'absolute',
        bottom: insets.bottom + TAB_BAR_HEIGHT + 8,
        left: 16,
        gap: 8,
      }}
    >
      {visible.map((n, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 16,
            backgroundColor: isDark ? DARK.surface : LIGHT.surface,
            borderWidth: 1,
            borderColor: isDark ? DARK.outline : LIGHT.outlineVariant,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 6,
            elevation: 6,
            maxWidth: 280,
          }}
        >
          <MSIcon name="check_circle" size={16} color="#10b981" />
          <Text style={{ fontSize: 13, color: isDark ? DARK.onSurface : LIGHT.onSurface }} numberOfLines={1}>
            <Text style={{ fontWeight: '600' }}>{n.filename}</Text>
            {n.txnCount > 0 ? ` — ${n.txnCount} transactions` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}
