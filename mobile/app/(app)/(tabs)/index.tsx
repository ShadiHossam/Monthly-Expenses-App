import { useEffect, useRef, useState } from 'react';
import {
  ScrollView, View, Text, Pressable, FlatList,
  Modal as RNModal, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../../lib/api';
import { formatAED, getMonthRange, getQuarterRange, getYearRange, todayISO } from '../../../lib/utils';
import { MSIcon } from '../../../components/ui/MSIcon';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { Spinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useTheme } from '../../../context/ThemeContext';
import { LIGHT, DARK } from '../../../constants/colors';
import type { Summary, CategoryBreakdown, FrequentPlace, Transaction } from '../../../types';

type Period = 'month' | 'quarter' | 'year' | 'all' | 'custom';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Module-level flag (replaces sessionStorage)
let hasAutoSwitchedDash = false;

export default function DashboardScreen() {
  const { isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const today = new Date();

  const [period, setPeriod] = useState<Period>('month');
  const [monthOffset, setMonthOffset] = useState(0);
  const [quarterOffset, setQuarterOffset] = useState(0);
  const [yearOffset, setYearOffset] = useState(0);
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
  });
  const [customTo, setCustomTo] = useState(todayISO);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(today.getFullYear());

  const [summary, setSummary] = useState<Summary | null>(null);
  const [breakdown, setBreakdown] = useState<CategoryBreakdown[]>([]);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [places, setPlaces] = useState<FrequentPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoSwitchedBanner, setAutoSwitchedBanner] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function getRange(): { from: string; to: string } {
    if (period === 'custom') return { from: customFrom, to: customTo };
    if (period === 'all') return { from: '2000-01-01', to: todayISO() };
    const y = today.getFullYear(); const m = today.getMonth() + 1;
    if (period === 'month') {
      const d = new Date(y, m - 1 + monthOffset, 1);
      return getMonthRange(d.getFullYear(), d.getMonth() + 1);
    }
    if (period === 'quarter') {
      const baseQ = Math.ceil(m / 3);
      const totalQ = (y * 4 + baseQ - 1) + quarterOffset;
      return getQuarterRange(Math.floor(totalQ / 4), (totalQ % 4) + 1);
    }
    return getYearRange(y + yearOffset);
  }

  function getPeriodLabel() {
    if (period === 'custom') return customFrom && customTo ? `${customFrom} → ${customTo}` : 'Custom';
    if (period === 'all') return 'All time';
    if (period === 'month') {
      const d = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
      return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    }
    if (period === 'quarter') {
      const baseQ = Math.ceil((today.getMonth()+1)/3);
      const totalQ = (today.getFullYear()*4+baseQ-1)+quarterOffset;
      return `Q${(totalQ%4)+1} ${Math.floor(totalQ/4)}`;
    }
    return String(today.getFullYear() + yearOffset);
  }

  function canGoForward() {
    if (period === 'all') return false;
    if (period === 'month') return monthOffset < 0;
    if (period === 'quarter') return quarterOffset < 0;
    if (period === 'year') return yearOffset < 0;
    return false;
  }

  function stepBack() {
    if (period === 'month') setMonthOffset(o => o - 1);
    else if (period === 'quarter') setQuarterOffset(o => o - 1);
    else setYearOffset(o => o - 1);
  }

  function stepForward() {
    if (period === 'month') setMonthOffset(o => Math.min(o+1,0));
    else if (period === 'quarter') setQuarterOffset(o => Math.min(o+1,0));
    else setYearOffset(o => Math.min(o+1,0));
  }

  useEffect(() => {
    if (period === 'custom' && (!customFrom || !customTo)) return;
    setLoading(true);
    const { from, to } = getRange();
    let autoSwitched = false;
    Promise.all([
      api.getSummary(from, to),
      api.getCategoryBreakdown(from, to),
      api.listTransactions({ from, to, limit: 5 }),
      api.getFrequentPlaces(from, to),
    ]).then(([s, b, t, p]) => {
      const sum = s as any;
      if (!hasAutoSwitchedDash && period === 'month' && monthOffset === 0 && (sum?.transaction_count ?? 0) === 0) {
        hasAutoSwitchedDash = true;
        autoSwitched = true;
        setAutoSwitchedBanner(true);
        setPeriod('all');
        return;
      }
      setSummary(sum);
      setBreakdown(Array.isArray(b) ? b : []);
      setRecent((t as any)?.content ?? []);
      setPlaces((Array.isArray(p) ? p : []).slice(0, 4));
    }).catch(console.error).finally(() => { if (!autoSwitched) setLoading(false); });
  }, [period, monthOffset, quarterOffset, yearOffset, customFrom, customTo, refreshKey]);

  const savingsRate = (summary?.total_credits ?? 0) > 0
    ? Math.round(((summary!.total_credits - summary!.total_debits) / summary!.total_credits) * 100)
    : null;

  const { from: rangeFrom, to: rangeTo } = getRange();
  const hasData = !!summary?.transaction_count;

  const activeColor = isDark ? DARK.primary : LIGHT.primary;
  const inactiveColor = isDark ? DARK.onSurfaceVariant : LIGHT.onSurfaceVariant;

  return (
    <View className="flex-1 bg-ft-background dark:bg-ve-background">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 120, paddingHorizontal: 16 }}
      >
        {/* Period tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
          <View className="flex-row gap-1 bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-xl p-1">
            {(['month','quarter','year','all','custom'] as Period[]).map(p => (
              <Pressable
                key={p}
                onPress={() => { setPeriod(p); setShowMonthPicker(false); }}
                className={`px-3 py-1.5 rounded-lg ${period === p ? 'bg-ft-primary dark:bg-ve-primary-dim' : ''}`}
              >
                <Text className={`text-xs font-semibold capitalize ${period === p ? 'text-white dark:text-ve-background' : 'text-ft-on-surface-variant dark:text-ve-on-surface-variant'}`}>
                  {p === 'all' ? 'All time' : p === 'custom' ? 'Custom' : p}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Period nav */}
        {period !== 'custom' && period !== 'all' && (
          <View className="flex-row items-center gap-2 mb-4 bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-xl px-2 py-1">
            <Pressable onPress={stepBack} className="p-1 rounded-lg">
              <MSIcon name="chevron_left" size={20} color={inactiveColor} />
            </Pressable>
            <Pressable
              onPress={() => period === 'month' && setShowMonthPicker(true)}
              className="flex-1 items-center py-1"
            >
              <Text className="text-xs font-semibold text-ft-on-surface dark:text-ve-on-surface">{getPeriodLabel()}</Text>
            </Pressable>
            <Pressable
              onPress={stepForward}
              disabled={!canGoForward()}
              className="p-1 rounded-lg"
              style={{ opacity: canGoForward() ? 1 : 0.3 }}
            >
              <MSIcon name="chevron_right" size={20} color={inactiveColor} />
            </Pressable>
          </View>
        )}

        {/* Auto-switched banner */}
        {autoSwitchedBanner && (
          <View className="flex-row items-center justify-between gap-3 mb-4 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40">
            <Text className="text-sm text-amber-800 dark:text-amber-300 flex-1">
              No transactions this month — showing <Text className="font-bold">all-time</Text> data.
            </Text>
            <Pressable onPress={() => setAutoSwitchedBanner(false)}>
              <MSIcon name="close" size={16} color="#b45309" />
            </Pressable>
          </View>
        )}

        {loading ? (
          <Spinner fullScreen />
        ) : !hasData ? (
          <EmptyState
            icon="account_balance"
            title="No data for this period"
            subtitle={period !== 'all' ? 'Try "All time" to see everything.' : 'Upload a bank statement to get started.'}
            action={period !== 'all' ? { label: 'View all time', onPress: () => setPeriod('all') } : { label: 'Upload Statement', onPress: () => router.push('/(app)/(tabs)/upload') }}
          />
        ) : (
          <View className="gap-4">
            {/* Metric cards */}
            <View className="gap-3">
              {/* Balance */}
              <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5">
                <View className="flex-row items-start justify-between mb-3">
                  <Text className="text-xs font-semibold uppercase tracking-wider text-ft-on-surface-variant dark:text-ve-on-surface-variant">Total Balance</Text>
                  <View className="w-8 h-8 rounded-xl bg-ft-surface-low dark:bg-ve-surface-high items-center justify-center">
                    <MSIcon name="account_balance" size={18} color={inactiveColor} />
                  </View>
                </View>
                <Text className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">
                  {formatAED(summary?.closing_balance ?? 0)}
                </Text>
                {summary?.opening_balance != null && (
                  <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-1">
                    Opening: {formatAED(summary.opening_balance)}
                  </Text>
                )}
              </View>

              {/* Income */}
              <Pressable
                onPress={() => router.push(`/(app)/(tabs)/transactions?from=${rangeFrom}&to=${rangeTo}&type=credit` as any)}
                className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5"
                style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
              >
                <View className="flex-row items-start justify-between mb-3">
                  <Text className="text-xs font-semibold uppercase tracking-wider text-ft-on-surface-variant dark:text-ve-on-surface-variant">
                    {period === 'all' ? 'Total Income' : period === 'quarter' ? 'Quarterly Income' : period === 'year' ? 'Yearly Income' : 'Monthly Income'}
                  </Text>
                  <View className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-ve-surface-high items-center justify-center">
                    <MSIcon name="arrow_downward" size={18} color={isDark ? DARK.primary : '#10b981'} />
                  </View>
                </View>
                <Text className="text-2xl font-bold text-emerald-600 dark:text-ve-primary">
                  +{formatAED(summary?.total_credits ?? 0)}
                </Text>
                {savingsRate !== null && (
                  <Text className="text-xs text-emerald-600 dark:text-ve-primary mt-1">
                    {savingsRate}% savings rate
                  </Text>
                )}
              </Pressable>

              {/* Expenses */}
              <Pressable
                onPress={() => router.push(`/(app)/(tabs)/transactions?from=${rangeFrom}&to=${rangeTo}&type=debit` as any)}
                className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5"
                style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
              >
                <View className="flex-row items-start justify-between mb-3">
                  <Text className="text-xs font-semibold uppercase tracking-wider text-ft-on-surface-variant dark:text-ve-on-surface-variant">
                    {period === 'all' ? 'Total Expenses' : period === 'quarter' ? 'Quarterly Expenses' : period === 'year' ? 'Yearly Expenses' : 'Monthly Expenses'}
                  </Text>
                  <View className="w-8 h-8 rounded-xl bg-red-50 dark:bg-ve-surface-high items-center justify-center">
                    <MSIcon name="arrow_upward" size={18} color={isDark ? DARK.error : '#ef4444'} />
                  </View>
                </View>
                <Text className="text-2xl font-bold text-red-500 dark:text-ve-error">
                  -{formatAED(summary?.total_debits ?? 0)}
                </Text>
              </Pressable>
            </View>

            {/* Quick stats */}
            <View className="flex-row gap-3">
              <View className="flex-1 bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-xl p-4 items-center">
                <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-1">Transactions</Text>
                <Text className="text-xl font-bold text-ft-on-surface dark:text-ve-on-surface">{summary?.transaction_count ?? 0}</Text>
              </View>
              <View className="flex-1 bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-xl p-4 items-center">
                <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-1">Savings Rate</Text>
                <Text className={`text-xl font-bold ${(savingsRate ?? 0) >= 0 ? 'text-emerald-600 dark:text-ve-primary' : 'text-red-500 dark:text-ve-error'}`}>
                  {savingsRate !== null ? `${savingsRate}%` : '—'}
                </Text>
              </View>
            </View>

            {/* Category breakdown */}
            {breakdown.length > 0 && (
              <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5">
                <Text className="text-sm font-bold text-ft-on-surface dark:text-ve-on-surface mb-4">Category Breakdown</Text>
                <View className="gap-3">
                  {breakdown.slice(0, 6).map((cat) => (
                    <Pressable
                      key={cat.category_name}
                      onPress={() => router.push(`/(app)/(tabs)/transactions?from=${rangeFrom}&to=${rangeTo}&category_id=${cat.category_id ?? -1}` as any)}
                    >
                      <View className="flex-row justify-between mb-1">
                        <View className="flex-row items-center gap-2">
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cat.category_color }} />
                          <Text className="text-xs text-ft-on-surface dark:text-ve-on-surface font-medium">{cat.category_name}</Text>
                        </View>
                        <Text className="text-xs font-semibold text-ft-on-surface dark:text-ve-on-surface">
                          {formatAED(cat.total)}{' '}
                          <Text className="font-normal text-ft-on-surface-variant dark:text-ve-on-surface-variant">
                            {cat.percentage?.toFixed(0)}%
                          </Text>
                        </Text>
                      </View>
                      <ProgressBar pct={cat.percentage} color={cat.category_color} height={5} />
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Top places */}
            {places.length > 0 && (
              <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5">
                <Text className="text-sm font-bold text-ft-on-surface dark:text-ve-on-surface mb-4">Top Places</Text>
                <View className="gap-3">
                  {places.map((p, i) => (
                    <Pressable
                      key={p.merchant_name || i}
                      className="flex-row items-center gap-3"
                      onPress={() => router.push(`/(app)/(tabs)/transactions?from=${rangeFrom}&to=${rangeTo}&search=${p.merchant_name}` as any)}
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <View className="w-7 h-7 rounded-full bg-ft-surface-low dark:bg-ve-surface-high items-center justify-center">
                        <Text className="text-xs font-bold text-ft-on-surface-variant dark:text-ve-on-surface-variant">{i+1}</Text>
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className="text-sm font-medium text-ft-on-surface dark:text-ve-on-surface" numberOfLines={1}>{p.merchant_name}</Text>
                        <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">{(p as any).visit_count} visits</Text>
                      </View>
                      <Text className="font-semibold text-sm text-ft-on-surface dark:text-ve-on-surface shrink-0">
                        {formatAED((p as any).total_spent ?? p.total_spend ?? 0)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Recent transactions */}
            {recent.length > 0 && (
              <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl overflow-hidden">
                <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
                  <Text className="text-sm font-bold text-ft-on-surface dark:text-ve-on-surface">Recent Transactions</Text>
                  <Pressable onPress={() => router.push(`/(app)/(tabs)/transactions?from=${rangeFrom}&to=${rangeTo}` as any)}>
                    <Text className="text-xs font-semibold text-ft-primary dark:text-ve-primary">View All</Text>
                  </Pressable>
                </View>
                {recent.map((t, idx) => (
                  <View
                    key={t.id}
                    className={`flex-row items-center gap-4 px-5 py-3.5 ${idx < recent.length - 1 ? 'border-b border-ft-outline-variant dark:border-ve-outline' : ''}`}
                  >
                    <View className="w-9 h-9 rounded-xl bg-ft-surface-low dark:bg-ve-surface-high items-center justify-center shrink-0">
                      <MSIcon name={t.txn_type === 'credit' ? 'payments' : 'shopping_bag'} size={18} color={inactiveColor} />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-sm font-medium text-ft-on-surface dark:text-ve-on-surface" numberOfLines={1}>
                        {t.merchant_name || t.description}
                      </Text>
                      <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">
                        {t.txn_date.slice(5).replace('-', ' ')}
                        {t.category_name ? ` · ${t.category_name}` : ''}
                      </Text>
                    </View>
                    <Text className={`font-semibold text-sm shrink-0 ${t.txn_type === 'credit' ? 'text-emerald-600 dark:text-ve-primary' : 'text-ft-on-surface dark:text-ve-on-surface'}`}>
                      {t.txn_type === 'credit' ? '+' : '-'}{formatAED(t.amount)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Ask AI FAB */}
      <Pressable
        onPress={() => Alert.alert('Ask AI', 'AI chat coming soon')}
        style={[
          {
            position: 'absolute',
            bottom: insets.bottom + 72,
            right: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 20,
            backgroundColor: isDark ? DARK.primary : LIGHT.primary,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }
        ]}
      >
        <MSIcon name="smart_toy" size={18} color={isDark ? DARK.background : 'white'} />
        <Text style={{ color: isDark ? DARK.background : 'white', fontSize: 13, fontWeight: '600' }}>Ask AI</Text>
      </Pressable>

      {/* Month picker modal */}
      <RNModal
        visible={showMonthPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowMonthPicker(false)}>
          <Pressable
            style={{ backgroundColor: isDark ? DARK.surface : LIGHT.surface, borderRadius: 16, padding: 16, width: 260, borderWidth: 1, borderColor: isDark ? DARK.outline : LIGHT.outlineVariant }}
            onPress={e => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-3">
              <Pressable onPress={() => setPickerYear(y => y - 1)} className="p-1 rounded-lg">
                <MSIcon name="chevron_left" size={20} color={inactiveColor} />
              </Pressable>
              <Text className="font-semibold text-ft-on-surface dark:text-ve-on-surface">{pickerYear}</Text>
              <Pressable
                onPress={() => setPickerYear(y => y + 1)}
                disabled={pickerYear >= today.getFullYear()}
                className="p-1 rounded-lg"
                style={{ opacity: pickerYear >= today.getFullYear() ? 0.3 : 1 }}
              >
                <MSIcon name="chevron_right" size={20} color={inactiveColor} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {MONTHS.map((mon, idx) => {
                const isFuture = pickerYear > today.getFullYear() || (pickerYear === today.getFullYear() && idx > today.getMonth());
                const targetOffset = (pickerYear - today.getFullYear()) * 12 + (idx - today.getMonth());
                const isSelected = targetOffset === monthOffset;
                return (
                  <Pressable
                    key={mon}
                    disabled={isFuture}
                    onPress={() => { setMonthOffset(targetOffset); setShowMonthPicker(false); }}
                    style={{
                      width: '30%',
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor: isSelected ? (isDark ? DARK.primaryDim : LIGHT.primary) : 'transparent',
                      alignItems: 'center',
                      opacity: isFuture ? 0.3 : 1,
                    }}
                  >
                    <Text style={{
                      fontSize: 12, fontWeight: '500',
                      color: isSelected ? (isDark ? DARK.background : 'white') : (isDark ? DARK.onSurface : LIGHT.onSurface),
                    }}>
                      {mon}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </RNModal>
    </View>
  );
}
