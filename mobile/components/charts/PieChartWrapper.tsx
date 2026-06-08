import { View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

interface DataItem {
  value: number;
  color: string;
  label?: string;
}

interface Props {
  data: DataItem[];
  radius?: number;
  centerLabel?: string;
}

export function PieChartWrapper({ data, radius = 80, centerLabel }: Props) {
  if (!data || data.length === 0) return null;

  return (
    <View className="items-center">
      <PieChart
        data={data}
        donut
        radius={radius}
        innerRadius={radius * 0.6}
        centerLabelComponent={centerLabel ? () => null : undefined}
        isAnimated
      />
    </View>
  );
}
