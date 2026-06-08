import { View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useTheme } from '../../context/ThemeContext';
import { LIGHT, DARK } from '../../constants/colors';

interface DataItem {
  value: number;
  label?: string;
}

interface Props {
  data: DataItem[];
  width?: number;
  height?: number;
  color?: string;
}

export function LineChartWrapper({ data, width = 300, height = 180, color }: Props) {
  const { isDark } = useTheme();
  if (!data || data.length === 0) return null;

  const lineColor = color ?? (isDark ? DARK.primary : LIGHT.primary);
  const labelColor = isDark ? DARK.onSurfaceVariant : LIGHT.onSurfaceVariant;

  return (
    <View style={{ overflow: 'hidden' }}>
      <LineChart
        data={data}
        width={width}
        height={height}
        color={lineColor}
        thickness={2}
        areaChart
        startFillColor={lineColor + '50'}
        endFillColor={lineColor + '05'}
        hideRules
        xAxisColor="transparent"
        yAxisColor="transparent"
        xAxisLabelTextStyle={{ color: labelColor, fontSize: 10 }}
        yAxisTextStyle={{ color: labelColor, fontSize: 10 }}
        noOfSections={4}
        isAnimated
      />
    </View>
  );
}
