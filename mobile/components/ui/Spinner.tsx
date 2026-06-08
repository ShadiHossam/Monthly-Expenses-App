import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { LIGHT, DARK } from '../../constants/colors';

interface Props {
  size?: 'small' | 'large';
  fullScreen?: boolean;
}

export function Spinner({ size = 'large', fullScreen = false }: Props) {
  const { isDark } = useTheme();
  const color = isDark ? DARK.primary : LIGHT.primary;

  if (fullScreen) {
    return (
      <View className="flex-1 items-center justify-center py-24">
        <ActivityIndicator size={size} color={color} />
      </View>
    );
  }
  return <ActivityIndicator size={size} color={color} />;
}
