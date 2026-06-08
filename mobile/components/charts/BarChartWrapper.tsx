import { View, Text } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useTheme } from '../../context/ThemeContext';
import { LIGHT, DARK } from '../../constants/colors';

interface DataItem {
  value: number;
  label?: string;
  frontColor?: string;
}

interface Props {
  data: DataItem[];
  width?: number;
  height?: number;
}

export function BarChartWrapper({ data, width = 300, height = 180 }: Props) {
  const { isDark } = useTheme();
  if (!data || data.length === 0) return null;

  const labelColor = isDark ? DARK.onSurfaceVariant : LIGHT.onSurfaceVariant;
  const defaultColor = isDark ? DARK.primary : LIGHT.primary;

  return (
    <View style={{ overflow: 'hidden' }}>
      <BarChart
        data={data.map(d => ({
          value: d.value,
          label: d.label ?? '',
          frontColor: d.frontColor ?? defaultColor,
        }))}
        width={width}
        height={height}
        barWidth={Math.max(8, Math.floor(width / (data.length * 2 + 2)))}
        spacing={4}
        roundedTop
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
