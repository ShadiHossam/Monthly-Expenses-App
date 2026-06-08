import { View, Pressable, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { MSIcon } from '../../../components/ui/MSIcon';
import { LIGHT, DARK } from '../../../constants/colors';

export default function TabLayout() {
  const { isDark } = useTheme();
  const colors = isDark ? DARK : LIGHT;

  const activeColor = isDark ? DARK.primary : LIGHT.primary;
  const inactiveColor = isDark ? DARK.onSurfaceVariant : LIGHT.onSurfaceVariant;
  const barBg = isDark ? DARK.surface : LIGHT.surface;
  const barBorder = isDark ? DARK.outline : LIGHT.outlineVariant;

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: barBg as string,
          borderTopColor: barBorder as string,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: activeColor as string,
        tabBarInactiveTintColor: inactiveColor as string,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <MSIcon name="home" size={24} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Txns',
          tabBarIcon: ({ color }) => <MSIcon name="receipt_long" size={24} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: '',
          tabBarIcon: () => null,
          tabBarButton: ({ onPress, accessibilityState }) => (
            <Pressable
              onPress={onPress as any}
              accessibilityState={accessibilityState}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: -14,
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: isDark ? DARK.primaryDim : LIGHT.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
                }}
              >
                <MSIcon
                  name="add"
                  size={28}
                  color={isDark ? DARK.background : 'white'}
                />
              </View>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color }) => <MSIcon name="bar_chart" size={24} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <MSIcon name="settings" size={24} color={color as string} />,
        }}
      />
    </Tabs>
  );
}
