import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Alert, ActivityIndicator, Modal as RNModal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { formatAED, formatDate } from '../../lib/utils';
import { MSIcon } from '../../components/ui/MSIcon';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useTheme } from '../../context/ThemeContext';
import { LIGHT, DARK } from '../../constants/colors';
import type { MerchantAlias } from '../../types';

export default function MerchantsScreen() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [merchants, setMerchants] = useState<any[]>([]);
  const [frequent, setFrequent] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [txns, setTxns] = useState<Record<string, any[]>>({});
  const [txnLoading, setTxnLoading] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [aliasMap, setAliasMap] = useState<Map<string, MerchantAlias>>(new Map());
  const [aliasEditName, setAliasEditName] = useState<string | null>(null);
  const [aliasInput, setAliasInput] = useState('');
  const [aliasSaving, setAliasSaving] = useState(false);
  const inactiveColor = isDark ? DARK.onSurfaceVariant : LIGHT.onSurfaceVariant;

  function loadAliases() {
    api.listAliases().then(list => {
      const map = new Map<string, MerchantAlias>();
      (list as MerchantAlias[]).forEach(a => map.set(a.raw_name, a));
      setAliasMap(map);
    });
  }

  useEffect(() => {
    api.listCategories().then(c => setCategories(Array.isArray(c) ? c : []));
    Promise.all([api.listMerchants(), api.getFrequent(), api.getMerchantRanking(), api.listAliases()])
      .then(([m, f, r, al]) => {
        setMerchants((m as any).data || Array.isArray(m) ? m as any[] : []);
        setFrequent((f as any).data || Array.isArray(f) ? f as any[] : []);
        setRanking((r as any).data || Array.isArray(r) ? r as any[] : []);
        const map = new Map<string, MerchantAlias>();
        (al as MerchantAlias[]).forEach(a => map.set(a.raw_name, a));
        setAliasMap(map);
      })
      .finally(() => setLoading(false));
  }, []);

  async function toggleMerchant(name: string) {
    if (expanded === name) { setExpanded(null); return; }
    setExpanded(name);
    if (!txns[name]) {
      setTxnLoading(name);
      try {
        const res = await api.getMerchantTransactions(name);
        setTxns(prev => ({ ...prev, [name]: (res as any).data || (Array.isArray(res) ? res : []) }));
      } finally { setTxnLoading(null); }
    }
  }

  async function handleAliasSave(merchantName: string) {
    const trimmed = aliasInput.trim();
    if (!trimmed || trimmed === merchantName) { setAliasEditName(null); return; }
    setAliasSaving(true);
    try {
      const existing = aliasMap.get(merchantName);
      if (existing) await api.updateAlias(existing.id, trimmed);
      else await api.createAlias(merchantName, trimmed);
      loadAliases(); setAliasEditName(null);
    } finally { setAliasSaving(false); }
  }

  async function handleAliasRemove(merchantName: string) {
    const existing = aliasMap.get(merchantName);
    if (!existing) return;
    setAliasSaving(true);
    try { await api.deleteAlias(existing.id); loadAliases(); setAliasEditName(null); }
    finally { setAliasSaving(false); }
  }

  const q = search.toLowerCase();
  const filteredFrequent = frequent.filter(p => (p.merchant_name || '').toLowerCase().includes(q));
  const filteredMerchants = merchants.filter(m => (m.merchant_name || '').toLowerCase().includes(q));
  const hasAny = merchants.length > 0 || frequent.length > 0;

  function MerchantRow({ item, showRank = false, rank = 0 }: { item: any; showRank?: boolean; rank?: number }) {
    const isOpen = expanded === item.merchant_name;
    const existing = aliasMap.get(item.merchant_name);
    return (
      <View>
        <Pressable
          onPress={() => toggleMerchant(item.merchant_name)}
          className="flex-row items-center gap-3 px-5 py-4"
        >
          {showRank ? (
            <View style={{
              width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              backgroundColor: rank === 1 ? '#fef3c7' : rank === 2 ? '#f1f5f9' : rank === 3 ? '#fff7ed' : (isDark ? DARK.surfaceHigh : LIGHT.surfaceLow),
            }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: rank === 1 ? '#b45309' : rank === 2 ? '#475569' : rank === 3 ? '#c2410c' : inactiveColor }}>
                {item.rank ?? rank}
              </Text>
            </View>
          ) : (
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? DARK.surfaceHigh : LIGHT.surfaceLow, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: inactiveColor }}>
                {(item.merchant_name || '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View className="flex-1 min-w-0">
            <Text className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface" numberOfLines={1}>
              {existing?.display_name || item.merchant_name || 'Unknown'}
            </Text>
            <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">
              {item.visit_count ?? item.visit_count} visit{(item.visit_count ?? 1) !== 1 ? 's' : ''}
              {item.avg_spend ? ` · avg ${formatAED(item.avg_spend)}` : ''}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5 shrink-0">
            {/* Alias button */}
            <Pressable
              onPress={() => { setAliasEditName(item.merchant_name); setAliasInput(existing?.display_name || item.merchant_name); }}
              style={{ padding: 6, borderRadius: 8, backgroundColor: existing ? (isDark ? DARK.primary : LIGHT.primary) + '20' : 'transparent' }}
            >
              <MSIcon name="drive_file_rename_outline" size={16} color={existing ? (isDark ? DARK.primary : LIGHT.primary) : inactiveColor} />
            </Pressable>
            <Text className="text-sm font-bold text-ft-on-surface dark:text-ve-on-surface">
              {formatAED(item.total_spend ?? item.total_spent ?? 0)}
            </Text>
            <MSIcon name={isOpen ? 'expand_less' : 'expand_more'} size={20} color={inactiveColor} />
          </View>
        </Pressable>
        {isOpen && (
          <View style={{ backgroundColor: isDark ? DARK.surfaceHigh : LIGHT.surfaceLow, borderTopWidth: 1, borderTopColor: isDark ? DARK.outline : LIGHT.outlineVariant }}>
            {txnLoading === item.merchant_name ? (
              <View className="items-center py-4">
                <ActivityIndicator size="small" color={isDark ? DARK.primary : LIGHT.primary} />
              </View>
            ) : (txns[item.merchant_name] ?? []).length === 0 ? (
              <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant px-5 py-3">No transactions found.</Text>
            ) : (
              <>
                <Text className="text-xs font-semibold uppercase tracking-wider text-ft-on-surface-variant dark:text-ve-on-surface-variant px-5 pt-3 mb-1">Transaction history</Text>
                {(txns[item.merchant_name] ?? []).map((t: any, i: number) => (
                  <View key={i} className="flex-row items-center justify-between px-5 py-2.5 border-b border-ft-outline-variant/50 dark:border-ve-outline/50">
                    <View className="flex-1 min-w-0">
                      <Text className="text-xs text-ft-on-surface dark:text-ve-on-surface" numberOfLines={1}>{t.description || item.merchant_name}</Text>
                      <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">{formatDate(t.txn_date)}</Text>
                    </View>
                    <Text className="text-xs font-semibold text-ft-on-surface dark:text-ve-on-surface">{formatAED(t.amount)}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-ft-background dark:bg-ve-background">
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 100, paddingHorizontal: 16 }}>
        <Text className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface mb-1">Merchants</Text>
        <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-4">All detected merchants and spending patterns</Text>

        {/* Search */}
        <View className="flex-row items-center bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2.5 mb-5 gap-2">
          <MSIcon name="search" size={18} color={inactiveColor} />
          <TextInput
            className="flex-1 text-sm text-ft-on-surface dark:text-ve-on-surface"
            placeholder="Search merchants…"
            placeholderTextColor={inactiveColor}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {loading ? <Spinner fullScreen /> : !hasAny ? (
          <EmptyState icon="storefront" title="No merchants detected yet" subtitle="Upload a bank statement to automatically discover merchants." />
        ) : (
          <View className="gap-6">
            {filteredFrequent.length > 0 && (
              <View>
                <Text className="text-xs font-semibold uppercase tracking-wider text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-3 flex-row">⭐ Frequent Places</Text>
                <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl overflow-hidden">
                  {filteredFrequent.map((p: any, i: number) => (
                    <View key={p.merchant_name} style={i < filteredFrequent.length - 1 ? { borderBottomWidth: 1, borderBottomColor: isDark ? DARK.outline : LIGHT.outlineVariant } : {}}>
                      <MerchantRow item={p} />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {ranking.length > 0 && (
              <View>
                <Text className="text-xs font-semibold uppercase tracking-wider text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-3">🏆 Top by Spend</Text>
                <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl overflow-hidden">
                  {ranking.slice(0, 10).map((m: any, i: number) => (
                    <View key={i} style={i < Math.min(ranking.length, 10) - 1 ? { borderBottomWidth: 1, borderBottomColor: isDark ? DARK.outline : LIGHT.outlineVariant } : {}}>
                      <MerchantRow item={m} showRank rank={i + 1} />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {filteredMerchants.length > 0 && (
              <View>
                <Text className="text-xs font-semibold uppercase tracking-wider text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-3">All Merchants</Text>
                <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl overflow-hidden">
                  {filteredMerchants.map((m: any, i: number) => (
                    <View key={i} style={i < filteredMerchants.length - 1 ? { borderBottomWidth: 1, borderBottomColor: isDark ? DARK.outline : LIGHT.outlineVariant } : {}}>
                      <MerchantRow item={m} />
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Alias edit modal */}
      <RNModal visible={aliasEditName !== null} transparent animationType="slide" onRequestClose={() => setAliasEditName(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setAliasEditName(null)} />
        <View style={{ backgroundColor: isDark ? DARK.surface : LIGHT.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: inactiveColor, marginBottom: 12 }}>Display name</Text>
          <TextInput
            autoFocus
            value={aliasInput}
            onChangeText={setAliasInput}
            style={{ borderWidth: 1, borderColor: isDark ? DARK.outline : LIGHT.outlineVariant, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: isDark ? DARK.onSurface : LIGHT.onSurface, backgroundColor: isDark ? DARK.surfaceHigh : LIGHT.surfaceLow, marginBottom: 12 }}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => aliasEditName && handleAliasSave(aliasEditName)}
              disabled={aliasSaving || !aliasInput.trim()}
              style={{ flex: 1, backgroundColor: isDark ? DARK.primaryDim : LIGHT.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center', opacity: aliasSaving || !aliasInput.trim() ? 0.5 : 1 }}
            >
              {aliasSaving ? <ActivityIndicator size="small" color="white" /> : <Text style={{ color: isDark ? DARK.background : 'white', fontWeight: '600' }}>Save</Text>}
            </Pressable>
            {aliasEditName && aliasMap.has(aliasEditName) && (
              <Pressable
                onPress={() => aliasEditName && handleAliasRemove(aliasEditName)}
                disabled={aliasSaving}
                style={{ paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: isDark ? DARK.error : '#ef4444', alignItems: 'center', justifyContent: 'center', opacity: aliasSaving ? 0.5 : 1 }}
              >
                <MSIcon name="delete" size={18} color={isDark ? DARK.error : '#ef4444'} />
              </Pressable>
            )}
          </View>
        </View>
      </RNModal>
    </View>
  );
}
