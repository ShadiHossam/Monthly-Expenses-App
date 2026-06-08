import { View, Pressable } from 'react-native';
import { MSIcon } from './MSIcon';

interface Props {
  colors: string[];
  selected: string;
  onSelect: (color: string) => void;
}

export function ColorSwatch({ colors, selected, onSelect }: Props) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {colors.map(c => (
        <Pressable
          key={c}
          onPress={() => onSelect(c)}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: c,
            borderWidth: selected === c ? 3 : 0,
            borderColor: '#171d17',
            transform: [{ scale: selected === c ? 1.15 : 1 }],
          }}
        />
      ))}
    </View>
  );
}
