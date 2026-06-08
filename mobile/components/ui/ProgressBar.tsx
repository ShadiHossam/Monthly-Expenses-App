import { View } from 'react-native';
import { LIGHT } from '../../constants/colors';

interface Props {
  pct: number;
  color?: string;
  height?: number;
  className?: string;
}

export function ProgressBar({ pct, color = LIGHT.primary, height = 6, className }: Props) {
  return (
    <View
      style={{ height, borderRadius: height / 2, overflow: 'hidden' }}
      className={`bg-ft-surface-low dark:bg-ve-surface-high ${className ?? ''}`}
    >
      <View
        style={{
          height,
          borderRadius: height / 2,
          width: `${Math.min(Math.max(pct, 0), 100)}%`,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
