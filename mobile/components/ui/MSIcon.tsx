import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ICON_MAP } from '../../constants/icons';

interface Props {
  name: string;
  size?: number;
  color?: string;
  style?: any;
}

export function MSIcon({ name, size = 20, color, style }: Props) {
  const mapped = (ICON_MAP[name] ?? 'help-circle') as any;
  return <MaterialCommunityIcons name={mapped} size={size} color={color} style={style} />;
}
