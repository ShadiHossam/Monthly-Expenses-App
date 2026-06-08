import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Spinner } from '../../components/ui/Spinner';
import { MSIcon } from '../../components/ui/MSIcon';
import { useTheme } from '../../context/ThemeContext';
import { LIGHT, DARK } from '../../constants/colors';
import type { BillingUsage, Plan } from '../../types';

export default function BillingScreen() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);
  const inactiveColor = isDark ? DARK.onSurfaceVariant : LIGHT.onSurfaceVariant;

  useEffect(() => {
    Promise.all([api.getBillingUsage(), api.getPlans()])
      .then(([u, p]) => { setUsage(u); setPlans(Array.isArray(p) ? p : []); })
      .finally(() => setLoading(false));
  }, []);

  async function handleUpgrade(plan: string) {
    setUpgradingPlan(plan);
    try {
      const { checkout_url } = await api.createCheckout(plan);
      const result = await WebBrowser.openAuthSessionAsync(checkout_url, 'fintrack://billing');
      if (result.type === 'success') {
        const fresh = await api.getBillingUsage();
        setUsage(fresh);
      }
    } catch (err: any) { Alert.alert('Error', err.message || 'Failed to open checkout'); }
    finally { setUpgradingPlan(null); }
  }

  async function handlePortal() {
    try {
      const { portal_url } = await api.createPortal();
      await WebBrowser.openAuthSessionAsync(portal_url, 'fintrack://billing');
      const fresh = await api.getBillingUsage();
      setUsage(fresh);
    } catch (err: any) { Alert.alert('Error', err.message || 'Failed to open billing portal'); }
  }

  if (loading) return <Spinner fullScreen />;

  const usagePct = usage ? Math.min(100, (usage.pages_used / usage.pages_limit) * 100) : 0;
  const barColor = usagePct >= 90 ? '#ef4444' : usagePct >= 70 ? '#f59e0b' : (isDark ? DARK.primaryDim : LIGHT.primary);

  return (
    <ScrollView className="flex-1 bg-ft-background dark:bg-ve-background" contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 100, paddingHorizontal: 16 }}>
      <Text className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface mb-1">Billing</Text>
      <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-5">Manage your plan and usage</Text>

      {/* Current plan */}
      {usage && (
        <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 mb-5">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="font-bold text-lg text-ft-on-surface dark:text-ve-on-surface">{usage.plan_label}</Text>
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: usage.status === 'active' ? '#10b981' + '20' : '#ef4444' + '20', alignSelf: 'flex-start', marginTop: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: usage.status === 'active' ? '#10b981' : '#ef4444' }}>
                  {usage.status.toUpperCase()}
                </Text>
              </View>
            </View>
            <Pressable onPress={handlePortal} className="px-4 py-2 border border-ft-outline-variant dark:border-ve-outline rounded-xl">
              <Text className="text-sm text-ft-on-surface dark:text-ve-on-surface">Billing Portal</Text>
            </Pressable>
          </View>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant">Pages used</Text>
            <Text className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface">
              {usage.pages_used} / {usage.pages_limit}
            </Text>
          </View>
          <ProgressBar pct={usagePct} color={barColor} height={8} className="mb-2" />
          <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">
            {usage.pages_remaining} pages remaining{usage.overage_enabled ? ' · Overage enabled' : ''}
          </Text>
        </View>
      )}

      {/* Plans */}
      {plans.length > 0 && (
        <View className="gap-4">
          <Text className="font-semibold text-ft-on-surface dark:text-ve-on-surface">Available Plans</Text>
          {plans.map(plan => {
            const isCurrent = usage?.plan === plan.key;
            return (
              <View
                key={plan.key}
                className="bg-ft-surface dark:bg-ve-surface border rounded-2xl p-5"
                style={{ borderColor: isCurrent ? (isDark ? DARK.primary : LIGHT.primary) : (isDark ? DARK.outline : LIGHT.outlineVariant) }}
              >
                <View className="flex-row items-center justify-between mb-3">
                  <View>
                    <Text className="font-bold text-ft-on-surface dark:text-ve-on-surface">{plan.label}</Text>
                    <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant">
                      ${plan.price_usd}/mo · {plan.pages} pages
                    </Text>
                  </View>
                  {isCurrent ? (
                    <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: (isDark ? DARK.primary : LIGHT.primary) + '20' }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? DARK.primary : LIGHT.primary }}>Current</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => handleUpgrade(plan.key)}
                      disabled={upgradingPlan === plan.key}
                      className="px-4 py-2 bg-ft-primary dark:bg-ve-primary-dim rounded-xl"
                      style={{ opacity: upgradingPlan === plan.key ? 0.6 : 1 }}
                    >
                      <Text className="text-sm font-semibold text-white dark:text-ve-background">Upgrade</Text>
                    </Pressable>
                  )}
                </View>
                <View className="gap-1">
                  {(plan.features ?? []).slice(0, 3).map((feat: string, i: number) => (
                    <View key={i} className="flex-row items-center gap-2">
                      <MSIcon name="check_circle" size={14} color={isDark ? DARK.primary : LIGHT.primary} />
                      <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">{feat}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
