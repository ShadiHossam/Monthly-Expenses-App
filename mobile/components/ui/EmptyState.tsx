import { View, Text, Pressable } from 'react-native';
import { MSIcon } from './MSIcon';
import { useTheme } from '../../context/ThemeContext';
import { LIGHT, DARK } from '../../constants/colors';

interface Props {
  icon?: string;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon = 'information', title, subtitle, action }: Props) {
  const { isDark } = useTheme();
  return (
    <View className="flex-1 items-center justify-center py-20 px-8 gap-4">
      <View className="w-16 h-16 rounded-2xl bg-ft-surface-low dark:bg-ve-surface-high items-center justify-center">
        <MSIcon
          name={icon}
          size={36}
          color={isDark ? DARK.onSurfaceVariant : LIGHT.onSurfaceVariant}
        />
      </View>
      <View className="items-center gap-1">
        <Text className="font-semibold text-ft-on-surface dark:text-ve-on-surface text-center">{title}</Text>
        {subtitle && (
          <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant text-center">
            {subtitle}
          </Text>
        )}
      </View>
      {action && (
        <Pressable
          onPress={action.onPress}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          className="px-5 py-2.5 rounded-xl bg-ft-primary dark:bg-ve-primary-dim"
        >
          <Text className="text-white dark:text-ve-background text-sm font-semibold">{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}
