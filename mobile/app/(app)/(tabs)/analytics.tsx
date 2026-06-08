import { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { BarChartWrapper } from '../../../components/charts/BarChartWrapper';
import { PieChartWrapper } from '../../../components/charts/PieChartWrapper';
import { LineChartWrapper } from '../../../components/charts/LineChartWrapper';
import { MSIcon } from '../../../components/ui/MSIcon';
import { api } from '../../../lib/api';
import { formatAED, getMonthRange, getQuarterRange, getYearRange } from '../../../lib/utils';
import { useTheme } from '../../../context/ThemeContext';
import { LIGHT, DARK } from '../../../constants/colors';

type Tab = 'month' | 'quarter' | 'year';

export default function AnalyticsScreen() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const today = new Date();
  const [tab, setTab] = useState<Tab>('month');
  const [monthOffset, setMonthOffset] = useState(0);
  const [quarterOffset, setQuarterOffset] = useState(0);
  const [yearOffset, setYearOffset] = useState(0);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [frequent, setFrequent] = useState<any[]>([]);
  const [balanceTrend, setBalanceTrend] = useState<any[]>([]);
  const [monthComparison, setMonthComparison] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  function getQuarterInfo() {
    const m = today.getMonth() + 1;
    const baseQ = Math.ceil(m / 3);
    const totalQ = (today.getFullYear() * 4 + baseQ - 1) + quarterOffset;
    return { qYear: Math.floor(totalQ / 4), q: (totalQ % 4) + 1 };
  }

  function getRange() {
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    if (tab === 'month') {
      const d = new Date(y, m - 1 + monthOffset, 1);
      return getMonthRange(d.getFullYear(), d.getMonth() + 1);
    }
    if (tab === 'quarter') {
      const { qYear, q } = getQuarterInfo();
      return getQuarterRange(qYear, q);
    }
    return getYearRange(y + yearOffset);
  }

  function getLabel() {
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    if (tab === 'month') {
      const d = new Date(y, m - 1 + monthOffset, 1);
      return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getFullYear()}`;
    }
    if (tab === 'quarter') {
      const { qYear, q } = getQuarterInfo();
      return `Q${q} ${qYear}`;
    }
    return String(y + yearOffset);
  }

  function getChartYear() {
    if (tab === 'year') return today.getFullYear() + yearOffset;
    if (tab === 'quarter') return getQuarterInfo().qYear;
    return today.getFullYear();
  }

  function canGoForward() {
    if (tab === 'month') return monthOffset < 0;
    if (tab === 'quarter') return quarterOffset < 0;
    return yearOffset < 0;
  }

  function stepBack() {
    if (tab === 'month') setMonthOffset(o => o - 1);
    else if (tab === 'quarter') setQuarterOffset(o => o - 1);
    else setYearOffset(o => o - 1);
  }

  function stepForward() {
    if (tab === 'month') setMonthOffset(o => Math.min(o + 1, 0));
    else if (tab === 'quarter') setQuarterOffset(o => Math.min(o + 1, 0));
    else setYearOffset(o => Math.min(o + 1, 0));
  }

  useEffect(() => {
    setLoading(true);
    const { from, to } = getRange();
    let autoSwitched = false;
    Promise.all([
      api.getMonthly(getChartYear()),
      api.getCategoryBreakdown(from, to),
      api.getFrequentPlaces(from, to),
      api.getBalanceTrend(),
      api.getMonthComparison(6),
    ]).then(([m, b, f, bt, mc]) => {
      const bkd = Array.isArray(b) ? b : [];
      if (tab === 'month' && monthOffset === 0 && bkd.length === 0) {
        autoSwitched = true;
        setMonthOffset(-1);
        return;
      }
      setMonthlyData(Array.isArray(m) ? m : []);
      setBreakdown(bkd);
      setFrequent(Array.isArray(f) ? f : []);
      setBalanceTrend(Array.isArray(bt) ? bt : []);
      setMonthComparison(Array.isArray(mc) ? mc : []);
    }).catch(console.error).finally(() => { if (!autoSwitched) setLoading(false); });
  }, [tab, monthOffset, quarterOffset, yearOffset]);

  const activeColor = isDark ? DARK.primary : LIGHT.primary;
  const inactiveColor = isDark ? DARK.onSurfaceVariant : LIGHT.onSurfaceVariant;

  return (
    <ScrollView
      className="flex-1 bg-ft-background dark:bg-ve-background"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 100, paddingHorizontal: 16 }}
    >
      {/* Header + Tab selector */}
      <View className="flex-row items-center justify-between mb-4 flex-wrap gap-2">
        <View>
          <Text className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Analytics</Text>
          <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">
            Spending trends and category insights
          </Text>
        </View>
        {/* Period tab pills */}
        <View className="flex-row bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-xl p-1 gap-1">
          {(['month', 'quarter', 'year'] as Tab[]).map(t => (
            <Pressable
              key={t}
              onPress={() => { setTab(t); setMonthOffset(0); setQuarterOffset(0); setYearOffset(0); }}
              className={`px-3 py-1.5 rounded-lg ${tab === t ? 'bg-ft-primary dark:bg-ve-primary-dim' : ''}`}
            >
              <Text className={`text-xs font-medium capitalize ${tab === t ? 'text-white dark:text-ve-background' : 'text-ft-on-surface-variant dark:text-ve-on-surface-variant'}`}>
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Period nav */}
      <View className="flex-row items-center gap-2 mb-5">
        <Pressable onPress={stepBack} className="p-2 rounded-xl bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline">
          <MSIcon name="chevron_left" size={20} color={inactiveColor} />
        </Pressable>
        <Text className="flex-1 text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface text-center">{getLabel()}</Text>
        <Pressable
          onPress={stepForward}
          disabled={!canGoForward()}
          className="p-2 rounded-xl bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline"
          style={({ pressed }) => ({ opacity: !canGoForward() ? 0.3 : pressed ? 0.7 : 1 })}
        >
          <MSIcon name="chevron_right" size={20} color={inactiveColor} />
        </Pressable>
      </View>

      {loading ? (
        <Spinner fullScreen />
      ) : (
        <View className="gap-4">
          {/* Income vs Expenses */}
          {monthlyData.length > 0 && (
            <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5">
              <Text className="font-semibold text-ft-on-surface dark:text-ve-on-surface mb-4">Income vs Expenses</Text>
              <BarChartWrapper
                data={monthlyData.flatMap(m => [
                  { value: m.total_credits ?? 0, label: (m.month_name ?? m.month_label ?? '').slice(0, 3), frontColor: isDark ? DARK.primary : LIGHT.primary },
                  { value: m.total_debits ?? 0, label: '', frontColor: isDark ? DARK.outline : LIGHT.outlineVariant },
                ])}
                width={width - 64}
              />
            </View>
          )}

          {/* Spending by Category */}
          {breakdown.length > 0 && (
            <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5">
              <Text className="font-semibold text-ft-on-surface dark:text-ve-on-surface mb-4">Spending by Category</Text>
              <PieChartWrapper
                data={breakdown.map(c => ({
                  value: c.total,
                  color: c.category_color || c.color || '#6b7280',
                  label: c.category_name,
                }))}
              />
              <View className="mt-4 gap-2">
                {breakdown.slice(0, 6).map((cat: any, i: number) => (
                  <View key={i} className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2 flex-1 min-w-0">
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: cat.category_color || cat.color || '#6b7280', flexShrink: 0 }} />
                      <Text className="text-sm text-ft-on-surface dark:text-ve-on-surface truncate flex-1" numberOfLines={1}>
                        {cat.category_name}
                      </Text>
                    </View>
                    <View className="flex-row items-baseline gap-1.5 shrink-0 ml-2">
                      <Text className="font-semibold text-sm text-ft-on-surface dark:text-ve-on-surface">{formatAED(cat.total)}</Text>
                      <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">{cat.percentage?.toFixed(0)}%</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Frequent Places */}
          {frequent.length > 0 && (
            <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5">
              <Text className="font-semibold text-ft-on-surface dark:text-ve-on-surface mb-4">Frequent Places</Text>
              <View className="gap-3">
                {frequent.map((p: any, i: number) => (
                  <View key={i} className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: (isDark ? DARK.primary : LIGHT.primary) + '20' }}>
                      <Text className="text-xs font-bold" style={{ color: isDark ? DARK.primary : LIGHT.primary }}>{p.visit_count}x</Text>
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface" numberOfLines={1}>{p.merchant_name}</Text>
                      <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">
                        {p.frequency_reason ? `${p.frequency_reason} · ` : ''}avg {formatAED(p.avg_spend ?? 0)}
                      </Text>
                    </View>
                    <Text className="text-sm font-bold text-ft-on-surface dark:text-ve-on-surface shrink-0">{formatAED(p.total_spent ?? 0)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Balance Trend */}
          {balanceTrend.length > 1 && (
            <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5">
              <Text className="font-semibold text-ft-on-surface dark:text-ve-on-surface mb-4">Balance Trend</Text>
              <LineChartWrapper
                data={balanceTrend.map((p: any) => ({ value: p.balance ?? p.closing_balance ?? 0, label: (p.date ?? p.period_label ?? '').slice(5) }))}
                width={width - 64}
                color={isDark ? DARK.primary : LIGHT.primary}
              />
            </View>
          )}

          {/* Month-over-Month */}
          {monthComparison.length > 1 && (
            <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5">
              <Text className="font-semibold text-ft-on-surface dark:text-ve-on-surface mb-4">Month-over-Month Spending</Text>
              <BarChartWrapper
                data={monthComparison.map((m: any) => ({
                  value: m.debits ?? m.total_debits ?? 0,
                  label: (m.month_name ?? m.month_label ?? '').slice(0, 3),
                  frontColor: isDark ? DARK.primary : LIGHT.primary,
                }))}
                width={width - 64}
              />
            </View>
          )}

          {monthlyData.length === 0 && breakdown.length === 0 && (
            <EmptyState icon="bar_chart" title="No data for this period" subtitle="Upload a bank statement to see analytics." />
          )}
        </View>
      )}
    </ScrollView>
  );
}
