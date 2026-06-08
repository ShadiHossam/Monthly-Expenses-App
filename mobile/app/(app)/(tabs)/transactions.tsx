import { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, SectionList, TextInput,
  Alert, ScrollView, Modal as RNModal, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../../lib/api';
import { formatAED, formatShortDate, getMonthRange, getQuarterRange, getYearRange } from '../../../lib/utils';
import { MSIcon } from '../../../components/ui/MSIcon';
import { Spinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PRESET_COLORS } from '../../../constants/icons';
import { useTheme } from '../../../context/ThemeContext';
import { LIGHT, DARK } from '../../../constants/colors';
import type { Transaction, Category } from '../../../types';

type Period = '' | 'month' | 'quarter' | 'year' | 'custom';
type SortBy = 'date' | 'amount';
type SortDir = 'asc' | 'desc';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
let hasAutoSwitchedTxns = false;

export default function TransactionsScreen() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const today = new Date();

  const [period, setPeriod] = useState<Period>('month');
  const [monthOffset, setMonthOffset] = useState(0);
  const [quarterOffset, setQuarterOffset] = useState(0);
  const [yearOffset, setYearOffset] = useState(0);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'' | 'debit' | 'credit'>('');
  const [filterCat, setFilterCat] = useState<number | ''>('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCatTxnId, setEditingCatTxnId] = useState<number | null>(null);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [addingNewCat, setAddingNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#10b981');
  const [savingCat, setSavingCat] = useState(false);
  const [merchantRulePrompt, setMerchantRulePrompt] = useState<{ merchantName: string; categoryId: number; categoryName: string } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isAutoAllTime, setIsAutoAllTime] = useState(false);

  useEffect(() => { api.listCategories().then(c => setCategories(Array.isArray(c) ? c : [])); }, []);

  function getRange(): { from: string; to: string } {
    if (period === '') return { from: '', to: '' };
    if (period === 'custom') return { from: customFrom, to: customTo };
    const y = today.getFullYear(); const m = today.getMonth() + 1;
    if (period === 'month') { const d = new Date(y, m-1+monthOffset, 1); return getMonthRange(d.getFullYear(), d.getMonth()+1); }
    if (period === 'quarter') {
      const baseQ = Math.ceil(m/3);
      const totalQ = (y*4+baseQ-1)+quarterOffset;
      return getQuarterRange(Math.floor(totalQ/4), (totalQ%4)+1);
    }
    return getYearRange(y + yearOffset);
  }

  function getPeriodLabel() {
    if (period === '') return 'All time';
    if (period === 'custom') return customFrom && customTo ? `${customFrom} → ${customTo}` : 'Custom';
    if (period === 'month') { const d = new Date(today.getFullYear(), today.getMonth()+monthOffset, 1); return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }
    if (period === 'quarter') {
      const baseQ = Math.ceil((today.getMonth()+1)/3);
      const totalQ = (today.getFullYear()*4+baseQ-1)+quarterOffset;
      return `Q${(totalQ%4)+1} ${Math.floor(totalQ/4)}`;
    }
    return String(today.getFullYear() + yearOffset);
  }

  useEffect(() => {
    if (period === 'custom' && (!customFrom || !customTo)) return;
    setLoading(true);
    const { from, to } = getRange();
    const params: any = { limit: 500 };
    if (search) params.search = search;
    if (filterType) params.type = filterType;
    if (filterCat) params.category_id = filterCat;
    if (from) params.from = from;
    if (to) params.to = to;
    let autoSwitched = false;
    api.listTransactions(params).then(t => {
      const items = (t as any)?.content ?? [];
      if (period === 'month' && monthOffset === 0 && !search && !filterType && !filterCat && items.length === 0 && !hasAutoSwitchedTxns) {
        hasAutoSwitchedTxns = true;
        autoSwitched = true;
        setPeriod('');
        setIsAutoAllTime(true);
        return;
      }
      setTxns(items);
    }).finally(() => { if (!autoSwitched) setLoading(false); });
  }, [search, filterType, filterCat, period, monthOffset, quarterOffset, yearOffset, customFrom, customTo]);

  const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

  const sortedTxns = [...txns].sort((a, b) => {
    if (sortBy === 'amount') return sortDir === 'desc' ? Number(b.amount) - Number(a.amount) : Number(a.amount) - Number(b.amount);
    return sortDir === 'desc' ? b.txn_date.localeCompare(a.txn_date) : a.txn_date.localeCompare(b.txn_date);
  });

  const sections = sortBy === 'date'
    ? Object.entries(
        sortedTxns.reduce((acc: Record<string, Transaction[]>, t) => {
          if (!acc[t.txn_date]) acc[t.txn_date] = [];
          acc[t.txn_date].push(t);
          return acc;
        }, {})
      )
      .sort(([a], [b]) => sortDir === 'desc' ? b.localeCompare(a) : a.localeCompare(b))
      .map(([date, data]) => ({ title: date, data }))
    : [{ title: '', data: sortedTxns }];

  function formatDayHeader(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    const todayStr = today.toISOString().split('T')[0];
    const yest = new Date(today); yest.setDate(today.getDate()-1);
    if (dateStr === todayStr) return 'Today';
    if (dateStr === yest.toISOString().split('T')[0]) return 'Yesterday';
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  async function handleCategoryChange(txnId: number, categoryId: number) {
    const txn = txns.find(t => t.id === txnId);
    await api.setCategory(txnId, categoryId);
    setTxns(prev => prev.map(t => t.id === txnId ? { ...t, category_id: categoryId } : t));
    setEditingCatTxnId(null);
    setShowCatPicker(false);
    if (txn?.merchant_name) {
      const cat = categories.find(c => c.id === categoryId);
      setMerchantRulePrompt({ merchantName: txn.merchant_name, categoryId, categoryName: cat?.name ?? '' });
    }
  }

  async function handleMerchantRuleAnswer(always: boolean) {
    if (always && merchantRulePrompt) {
      await api.createRule({ pattern: merchantRulePrompt.merchantName, pattern_type: 'contains', category_id: merchantRulePrompt.categoryId, priority: 10 });
    }
    setMerchantRulePrompt(null);
  }

  async function handleCreateCategory() {
    if (!newCatName.trim() || editingCatTxnId === null) return;
    setSavingCat(true);
    try {
      const created = await api.createCategory(newCatName.trim(), newCatColor, 'label') as any;
      const refreshed = await api.listCategories();
      setCategories(Array.isArray(refreshed) ? refreshed : []);
      setAddingNewCat(false);
      setNewCatName('');
      setNewCatColor('#10b981');
      if (created?.id) await handleCategoryChange(editingCatTxnId, created.id);
    } finally { setSavingCat(false); }
  }

  async function handleDeleteTransaction(id: number) {
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setDeletingId(id);
        try {
          await api.deleteTransaction(id);
          setTxns(prev => prev.filter(t => t.id !== id));
        } catch (err: any) {
          Alert.alert('Error', err.message || 'Failed to delete');
        } finally { setDeletingId(null); }
      }},
    ]);
  }

  const inactiveColor = isDark ? DARK.onSurfaceVariant : LIGHT.onSurfaceVariant;
  const filteredTotal = sortedTxns.filter(t => t.txn_type === 'debit').reduce((s, t) => s + Number(t.amount), 0);

  return (
    <View className="flex-1 bg-ft-background dark:bg-ve-background">
      {/* Header */}
      <View style={{ paddingTop: insets.top + 16 }} className="px-4 pb-3">
        <Text className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface mb-3">Transactions</Text>

        {/* Search */}
        <View className="flex-row items-center bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2.5 mb-3 gap-2">
          <MSIcon name="search" size={18} color={inactiveColor} />
          <TextInput
            className="flex-1 text-sm text-ft-on-surface dark:text-ve-on-surface"
            placeholder="Search description..."
            placeholderTextColor={inactiveColor}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')}>
              <MSIcon name="close" size={16} color={inactiveColor} />
            </Pressable>
          ) : null}
        </View>

        {/* Period + type filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
          <View className="flex-row gap-1.5">
            {(['', 'debit', 'credit'] as const).map(t => (
              <Pressable
                key={t}
                onPress={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg border ${filterType === t ? 'bg-ft-primary dark:bg-ve-primary-dim border-ft-primary dark:border-ve-primary-dim' : 'border-ft-outline-variant dark:border-ve-outline bg-ft-surface dark:bg-ve-surface'}`}
              >
                <Text className={`text-xs font-semibold ${filterType === t ? 'text-white dark:text-ve-background' : 'text-ft-on-surface-variant dark:text-ve-on-surface-variant'}`}>
                  {t === '' ? 'All' : t === 'debit' ? 'Expenses' : 'Income'}
                </Text>
              </Pressable>
            ))}
            <View style={{ width: 1, backgroundColor: isDark ? DARK.outline : LIGHT.outlineVariant, marginHorizontal: 4 }} />
            {(['date-desc', 'date-asc', 'amount-desc', 'amount-asc'] as const).map(key => {
              const [by, dir] = key.split('-') as [SortBy, SortDir];
              const labels = { 'date-desc': 'Newest', 'date-asc': 'Oldest', 'amount-desc': 'Highest', 'amount-asc': 'Lowest' };
              const isActive = sortBy === by && sortDir === dir;
              return (
                <Pressable
                  key={key}
                  onPress={() => { setSortBy(by); setSortDir(dir); }}
                  className={`px-3 py-1.5 rounded-lg border ${isActive ? 'bg-ft-on-surface dark:bg-ve-on-surface border-ft-on-surface dark:border-ve-on-surface' : 'border-ft-outline-variant dark:border-ve-outline bg-ft-surface dark:bg-ve-surface'}`}
                >
                  <Text className={`text-xs font-semibold ${isActive ? 'text-ft-surface dark:text-ve-background' : 'text-ft-on-surface-variant dark:text-ve-on-surface-variant'}`}>
                    {labels[key]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {txns.length > 0 && (
          <Text className="text-xs text-red-500 dark:text-ve-error text-right mb-1">
            Total: -{formatAED(filteredTotal)}
          </Text>
        )}
      </View>

      {/* List */}
      {loading ? <Spinner fullScreen /> : txns.length === 0 ? (
        <EmptyState icon="receipt_long" title="No transactions found" subtitle="Try adjusting your filters." />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          renderSectionHeader={({ section }) => section.title ? (
            <View className="flex-row items-center justify-between px-1 py-2 bg-ft-background dark:bg-ve-background">
              <Text className="text-xs font-bold uppercase tracking-wider text-ft-on-surface-variant dark:text-ve-on-surface-variant">
                {formatDayHeader(section.title)}
              </Text>
              <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">
                {formatAED(section.data.filter(t => t.txn_type === 'debit').reduce((s, t) => s + Number(t.amount), 0))}
              </Text>
            </View>
          ) : null}
          renderSectionFooter={() => <View style={{ height: 8 }} />}
          renderItem={({ item: t, index, section }) => {
            const cat = t.category_id ? catMap[t.category_id] : null;
            const isLast = index === section.data.length - 1;
            return (
              <View
                className={`bg-ft-surface dark:bg-ve-surface flex-row items-center gap-4 px-5 py-4 ${!isLast ? 'border-b border-ft-outline-variant dark:border-ve-outline' : ''}`}
                style={{ borderTopLeftRadius: index === 0 ? 16 : 0, borderTopRightRadius: index === 0 ? 16 : 0, borderBottomLeftRadius: isLast ? 16 : 0, borderBottomRightRadius: isLast ? 16 : 0, borderWidth: index === 0 ? 1 : 0, borderColor: isDark ? DARK.outline : LIGHT.outlineVariant }}
              >
                {/* Category icon */}
                <View
                  style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: cat ? cat.color + '20' : (isDark ? DARK.surfaceHigh : LIGHT.surfaceLow) }}
                >
                  <MSIcon
                    name={cat ? (cat.icon || 'label') : 'label_off'}
                    size={18}
                    color={cat ? cat.color : inactiveColor}
                  />
                </View>

                {/* Info */}
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface" numberOfLines={1}>
                    {t.merchant_name || t.description}
                  </Text>
                  <View className="flex-row items-center gap-2 mt-0.5">
                    <Pressable
                      onPress={() => { setEditingCatTxnId(t.id); setAddingNewCat(false); setNewCatName(''); setNewCatColor('#10b981'); setShowCatPicker(true); }}
                    >
                      <View
                        style={cat
                          ? { backgroundColor: cat.color + '20', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }
                          : { borderWidth: 1, borderStyle: 'dashed', borderColor: isDark ? DARK.outline : LIGHT.outlineVariant, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }
                        }
                      >
                        <Text style={{ fontSize: 11, fontWeight: '500', color: cat ? cat.color : inactiveColor }}>
                          {cat ? cat.name : 'Uncategorized'} ▾
                        </Text>
                      </View>
                    </Pressable>
                    {t.ref_number && (
                      <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant font-mono" numberOfLines={1}>
                        {t.ref_number}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Amount + delete */}
                <View className="items-end gap-1 shrink-0">
                  <Text className={`font-bold text-sm ${t.txn_type === 'credit' ? 'text-emerald-600 dark:text-ve-primary' : 'text-ft-on-surface dark:text-ve-on-surface'}`}>
                    {t.txn_type === 'credit' ? '+' : '-'}{formatAED(t.amount)}
                  </Text>
                  <Pressable
                    onPress={() => handleDeleteTransaction(t.id)}
                    hitSlop={8}
                  >
                    {deletingId === t.id
                      ? <ActivityIndicator size="small" color="#ef4444" />
                      : <MSIcon name="delete" size={16} color={isDark ? DARK.error : '#ef4444'} />
                    }
                  </Pressable>
                </View>
              </View>
            );
          }}
          ListFooterComponent={() => (
            <Text className="text-center text-xs text-ft-outline dark:text-ve-on-surface-variant py-3">
              {txns.length} transactions
            </Text>
          )}
        />
      )}

      {/* Category picker modal */}
      <RNModal visible={showCatPicker} transparent animationType="slide" onRequestClose={() => { setShowCatPicker(false); setAddingNewCat(false); }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => { setShowCatPicker(false); setAddingNewCat(false); }} />
        <View style={{ backgroundColor: isDark ? DARK.surface : LIGHT.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%' }}>
          <View className="flex-row items-center justify-between px-5 pt-5 pb-3 border-b border-ft-outline-variant dark:border-ve-outline">
            <Text className="font-bold text-ft-on-surface dark:text-ve-on-surface">Select Category</Text>
            <Pressable onPress={() => { setShowCatPicker(false); setAddingNewCat(false); }}>
              <MSIcon name="close" size={20} color={inactiveColor} />
            </Pressable>
          </View>
          <ScrollView>
            {categories.map(c => (
              <Pressable
                key={c.id}
                onPress={() => editingCatTxnId !== null && handleCategoryChange(editingCatTxnId, c.id)}
                className="flex-row items-center gap-3 px-5 py-3 border-b border-ft-outline-variant dark:border-ve-outline"
              >
                <MSIcon name={c.icon || 'label'} size={18} color={c.color} />
                <Text className="flex-1 text-sm text-ft-on-surface dark:text-ve-on-surface">{c.name}</Text>
                {editingCatTxnId !== null && txns.find(t => t.id === editingCatTxnId)?.category_id === c.id && (
                  <MSIcon name="check" size={16} color={isDark ? DARK.primary : LIGHT.primary} />
                )}
              </Pressable>
            ))}
            {/* New category row */}
            <View className="border-t border-ft-outline-variant dark:border-ve-outline">
              {!addingNewCat ? (
                <Pressable onPress={() => setAddingNewCat(true)} className="flex-row items-center gap-2 px-5 py-3">
                  <MSIcon name="add" size={18} color={isDark ? DARK.primary : LIGHT.primary} />
                  <Text className="text-sm font-medium text-ft-primary dark:text-ve-primary">New category</Text>
                </Pressable>
              ) : (
                <View className="p-4 gap-3">
                  <TextInput
                    autoFocus
                    value={newCatName}
                    onChangeText={setNewCatName}
                    placeholder="Category name"
                    placeholderTextColor={inactiveColor}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-ft-outline-variant dark:border-ve-outline bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface"
                  />
                  <View className="flex-row flex-wrap gap-1.5">
                    {PRESET_COLORS.map(color => (
                      <Pressable
                        key={color}
                        onPress={() => setNewCatColor(color)}
                        style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: color, borderWidth: newCatColor === color ? 2 : 0, borderColor: '#171d17' }}
                      />
                    ))}
                  </View>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={handleCreateCategory}
                      disabled={!newCatName.trim() || savingCat}
                      style={{ flex: 1, backgroundColor: isDark ? DARK.primaryDim : LIGHT.primary, borderRadius: 10, paddingVertical: 8, alignItems: 'center', opacity: !newCatName.trim() || savingCat ? 0.5 : 1 }}
                    >
                      <Text style={{ color: isDark ? DARK.background : 'white', fontSize: 12, fontWeight: '600' }}>
                        {savingCat ? 'Adding…' : 'Add'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => { setAddingNewCat(false); setNewCatName(''); }}
                      style={{ flex: 1, borderWidth: 1, borderColor: isDark ? DARK.outline : LIGHT.outlineVariant, borderRadius: 10, paddingVertical: 8, alignItems: 'center' }}
                    >
                      <Text style={{ fontSize: 12, color: inactiveColor }}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </RNModal>

      {/* Merchant rule toast */}
      {merchantRulePrompt && (
        <View style={{
          position: 'absolute',
          bottom: insets.bottom + 80,
          left: 16, right: 16,
          backgroundColor: isDark ? DARK.surface : LIGHT.surface,
          borderRadius: 16,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderWidth: 1,
          borderColor: isDark ? DARK.outline : LIGHT.outlineVariant,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 8,
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? DARK.onSurface : LIGHT.onSurface }}>Always use this category?</Text>
            <Text style={{ fontSize: 11, color: inactiveColor, marginTop: 2 }} numberOfLines={1}>
              "{merchantRulePrompt.merchantName}" → {merchantRulePrompt.categoryName}
            </Text>
          </View>
          <Pressable onPress={() => handleMerchantRuleAnswer(false)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
            <Text style={{ fontSize: 12, color: inactiveColor }}>No</Text>
          </Pressable>
          <Pressable onPress={() => handleMerchantRuleAnswer(true)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: (isDark ? DARK.primary : LIGHT.primary) + '15' }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? DARK.primary : LIGHT.primary }}>Always</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
