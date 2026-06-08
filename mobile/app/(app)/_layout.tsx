import { View, Text, Pressable, ScrollView } from 'react-native';
import { Drawer } from 'expo-router/drawer';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { MSIcon } from '../../components/ui/MSIcon';

const DRAWER_ITEMS = [
  { href: '/(app)/budget',      label: 'Budget',      icon: 'account_balance_wallet' },
  { href: '/(app)/savings',     label: 'Savings',     icon: 'savings' },
  { href: '/(app)/categories',  label: 'Categories',  icon: 'category' },
  { href: '/(app)/merchants',   label: 'Merchants',   icon: 'storefront' },
  { href: '/(app)/statements',  label: 'Statements',  icon: 'description' },
  { href: '/(app)/recurring',   label: 'Recurring',   icon: 'repeat' },
  { href: '/(app)/reports',     label: 'Reports',     icon: 'summarize' },
  { href: '/(app)/billing',     label: 'Billing',     icon: 'credit_card' },
] as const;

function CustomDrawerContent(props: any) {
  const { user, logout } = useAuth();
  const { isDark, toggleDark } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const iconColor = isDark ? '#9aaa9e' : '#3f4a3e';
  const activeBg = isDark ? '#252926' : '#f0f5eb';
  const activeIconColor = isDark ? '#95d4b3' : '#005e26';

  return (
    <DrawerContentScrollView
      {...props}
      style={{ backgroundColor: isDark ? '#1d201e' : '#ffffff' }}
    >
      {/* User header */}
      <View className="px-5 pt-4 pb-5 border-b border-ft-outline-variant dark:border-ve-outline">
        <View className="w-12 h-12 rounded-full bg-ft-primary dark:bg-ve-primary items-center justify-center mb-3">
          <Text className="text-white dark:text-ve-background font-bold text-lg">
            {user?.username?.[0]?.toUpperCase() ?? 'F'}
          </Text>
        </View>
        <Text className="font-bold text-ft-on-surface dark:text-ve-on-surface text-sm">
          {user?.username ?? '—'}
        </Text>
        {user?.email ? (
          <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5 opacity-80">
            {user.email}
          </Text>
        ) : null}
      </View>

      {/* Drawer items */}
      <View className="py-2">
        {DRAWER_ITEMS.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Pressable
              key={item.href}
              onPress={() => { props.navigation.closeDrawer(); router.push(item.href as any); }}
              style={{ backgroundColor: isActive ? activeBg : 'transparent' }}
              className="flex-row items-center gap-3 px-5 py-3.5 mx-2 rounded-xl"
            >
              <MSIcon
                name={item.icon}
                size={22}
                color={isActive ? activeIconColor : iconColor}
              />
              <Text
                className={`text-sm font-medium ${isActive ? 'text-ft-primary dark:text-ve-primary' : 'text-ft-on-surface dark:text-ve-on-surface'}`}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Bottom: dark mode + logout */}
      <View className="border-t border-ft-outline-variant dark:border-ve-outline py-2 mt-2">
        <Pressable
          onPress={toggleDark}
          className="flex-row items-center gap-3 px-5 py-3.5 mx-2 rounded-xl"
        >
          <MSIcon name={isDark ? 'light_mode' : 'dark_mode'} size={22} color={iconColor} />
          <Text className="text-sm font-medium text-ft-on-surface dark:text-ve-on-surface">
            {isDark ? 'Light mode' : 'Dark mode'}
          </Text>
        </Pressable>
        <Pressable
          onPress={logout}
          className="flex-row items-center gap-3 px-5 py-3.5 mx-2 rounded-xl"
        >
          <MSIcon name="logout" size={22} color={isDark ? '#ffb3b3' : '#ba1a1a'} />
          <Text className="text-sm font-medium text-red-600 dark:text-ve-error">Log out</Text>
        </Pressable>
      </View>
    </DrawerContentScrollView>
  );
}

export default function AppLayout() {
  const { isDark } = useTheme();
  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          width: 280,
          backgroundColor: isDark ? '#1d201e' : '#ffffff',
        },
        swipeEdgeWidth: 40,
      }}
    >
      <Drawer.Screen name="(tabs)" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="budget"     options={{ drawerLabel: 'Budget' }} />
      <Drawer.Screen name="savings"    options={{ drawerLabel: 'Savings' }} />
      <Drawer.Screen name="categories" options={{ drawerLabel: 'Categories' }} />
      <Drawer.Screen name="merchants"  options={{ drawerLabel: 'Merchants' }} />
      <Drawer.Screen name="statements" options={{ drawerLabel: 'Statements' }} />
      <Drawer.Screen name="recurring"  options={{ drawerLabel: 'Recurring' }} />
      <Drawer.Screen name="reports"    options={{ drawerLabel: 'Reports' }} />
      <Drawer.Screen name="billing"    options={{ drawerLabel: 'Billing' }} />
    </Drawer>
  );
}
