import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { formatAED, formatDate } from '../../lib/utils';
import { MSIcon } from '../../components/ui/MSIcon';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useTheme } from '../../context/ThemeContext';
import { LIGHT, DARK } from '../../constants/colors';

export default function RecurringScreen() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [manualRules, setManualRules] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRule, setNewRule] = useState({ label: '', merchantPattern: '', expectedAmount: '', frequencyDays: '30', nextExpectedDate: '' });
  const inactiveColor = isDark ? DARK.onSurfaceVariant : LIGHT.onSurfaceVariant;

  useEffect(() => {
    api.getRecurring()
      .then(res => { const data = Array.isArray(res) ? res : (res as any).data ?? []; setItems([...data].sort((a: any, b: any) => (b.months_seen ?? 0) - (a.months_seen ?? 0))); })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
    api.listRecurringRules().then(setManualRules).catch(() => {});
  }, []);

  async function handleAddRule() {
    if (!newRule.label) return;
    const rule = await api.createRecurringRule({ label: newRule.label, merchantPattern: newRule.merchantPattern || undefined, expectedAmount: newRule.expectedAmount ? parseFloat(newRule.expectedAmount) : undefined, frequencyDays: parseInt(newRule.frequencyDays) || 30, nextExpectedDate: newRule.nextExpectedDate || undefined });
    setManualRules(prev => [rule, ...prev]);
    setShowAddForm(false); setNewRule({ label: '', merchantPattern: '', expectedAmount: '', frequencyDays: '30', nextExpectedDate: '' });
  }

  async function handleDeleteRule(id: number) { await api.deleteRecurringRule(id); setManualRules(prev => prev.filter((r: any) => r.id !== id)); }

  function toggleExpand(key: string) { setExpanded(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; }); }

  const inputClass = 'border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2 text-sm bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface';

  return (
    <ScrollView className="flex-1 bg-ft-background dark:bg-ve-background" contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 100, paddingHorizontal: 16 }}>
      <Text className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface mb-1">Recurring</Text>
      <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-6">Subscriptions & repeat charges</Text>

      {/* Manual rules */}
      <View className="mb-8">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-base font-semibold text-ft-on-surface dark:text-ve-on-surface">Manual Rules</Text>
          <Pressable onPress={() => setShowAddForm(v => !v)} className="flex-row items-center gap-1">
            <MSIcon name="add" size={16} color={isDark ? DARK.primary : LIGHT.primary} />
            <Text className="text-sm font-medium text-ft-primary dark:text-ve-primary">Define recurring</Text>
          </Pressable>
        </View>

        {showAddForm && (
          <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-4 mb-4 gap-3">
            <TextInput className={inputClass} placeholder="Label (e.g. Netflix)" placeholderTextColor={inactiveColor} value={newRule.label} onChangeText={v => setNewRule(p => ({ ...p, label: v }))} />
            <TextInput className={inputClass} placeholder="Merchant pattern (optional)" placeholderTextColor={inactiveColor} value={newRule.merchantPattern} onChangeText={v => setNewRule(p => ({ ...p, merchantPattern: v }))} />
            <View className="flex-row gap-3">
              <TextInput className={`${inputClass} flex-1`} placeholder="Amount (AED)" placeholderTextColor={inactiveColor} keyboardType="decimal-pad" value={newRule.expectedAmount} onChangeText={v => setNewRule(p => ({ ...p, expectedAmount: v }))} />
              <TextInput className={`${inputClass} flex-1`} placeholder="Every N days" placeholderTextColor={inactiveColor} keyboardType="number-pad" value={newRule.frequencyDays} onChangeText={v => setNewRule(p => ({ ...p, frequencyDays: v }))} />
            </View>
            <TextInput className={inputClass} placeholder="Next expected date (YYYY-MM-DD)" placeholderTextColor={inactiveColor} value={newRule.nextExpectedDate} onChangeText={v => setNewRule(p => ({ ...p, nextExpectedDate: v }))} />
            <View className="flex-row gap-2">
              <Pressable onPress={handleAddRule} className="flex-1 py-2 bg-ft-primary dark:bg-ve-primary rounded-xl items-center">
                <Text className="text-sm font-medium text-white dark:text-ve-background">Add</Text>
              </Pressable>
              <Pressable onPress={() => setShowAddForm(false)} className="flex-1 py-2 border border-ft-outline-variant dark:border-ve-outline rounded-xl items-center">
                <Text className="text-sm text-ft-on-surface dark:text-ve-on-surface">Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}

        {manualRules.length === 0 ? (
          <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant">No manual rules yet.</Text>
        ) : (
          <View className="gap-2">
            {manualRules.map((rule: any) => (
              <View key={rule.id} className="flex-row items-center justify-between bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl px-4 py-3">
                <View>
                  <Text className="text-sm font-medium text-ft-on-surface dark:text-ve-on-surface">{rule.label}</Text>
                  <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">
                    Every {rule.frequency_days ?? rule.frequencyDays} days
                    {rule.expected_amount ? ` · AED ${rule.expected_amount}` : ''}
                  </Text>
                </View>
                <Pressable onPress={() => handleDeleteRule(rule.id)}>
                  <MSIcon name="delete" size={18} color={isDark ? DARK.error : '#ef4444'} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>

      <Text className="text-base font-semibold text-ft-on-surface dark:text-ve-on-surface mb-3">Auto-Detected</Text>
      {loading ? <Spinner fullScreen /> : items.length === 0 ? (
        <EmptyState icon="repeat" title="No recurring transactions detected yet" subtitle="We analyze your statements to identify subscriptions and regular payments." />
      ) : (
        <View className="gap-3">
          {items.map(item => {
            const isOpen = expanded.has(item.merchant_name);
            return (
              <View key={item.merchant_name} className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl overflow-hidden">
                <Pressable className="p-5" onPress={() => toggleExpand(item.merchant_name)}>
                  <View className="flex-row items-center justify-between gap-3">
                    <View className="flex-row items-center gap-3 flex-1 min-w-0">
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: (item.category_color || '#94a3b8') + '20', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: item.category_color || '#94a3b8' }} />
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text className="font-semibold text-ft-on-surface dark:text-ve-on-surface" numberOfLines={1}>{item.merchant_name}</Text>
                        <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">Last: {formatDate(item.last_date)}</Text>
                      </View>
                    </View>
                    <View className="flex-row items-center gap-3 shrink-0">
                      <View className="items-end">
                        <Text className="font-bold text-ft-on-surface dark:text-ve-on-surface">{formatAED(item.amount)}</Text>
                        <View style={{ backgroundColor: isDark ? DARK.surfaceHigh : LIGHT.surfaceLow, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 }}>
                          <Text style={{ fontSize: 11, color: inactiveColor }}>{item.months_seen} month{item.months_seen !== 1 ? 's' : ''}</Text>
                        </View>
                      </View>
                      <MSIcon name={isOpen ? 'expand_less' : 'expand_more'} size={20} color={inactiveColor} />
                    </View>
                  </View>
                  <View className="mt-2">
                    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: (item.category_color || '#94a3b8') + '20', alignSelf: 'flex-start' }}>
                      <Text style={{ fontSize: 11, fontWeight: '500', color: item.category_color || inactiveColor }}>{item.category_name || 'Uncategorized'}</Text>
                    </View>
                  </View>
                </Pressable>
                {isOpen && (item.transactions?.length ?? 0) > 0 && (
                  <View style={{ borderTopWidth: 1, borderTopColor: isDark ? DARK.outline : LIGHT.outlineVariant }}>
                    <Text className="text-xs font-semibold uppercase tracking-wider text-ft-on-surface-variant dark:text-ve-on-surface-variant px-5 pt-3 mb-1">Transaction history</Text>
                    {item.transactions.map((txn: any) => (
                      <View key={txn.id} className="flex-row items-center justify-between px-5 py-1.5">
                        <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant">{formatDate(txn.txn_date)}</Text>
                        <Text className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface">{formatAED(txn.amount)}</Text>
                      </View>
                    ))}
                    <View style={{ height: 12 }} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
