import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, Modal as RNModal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { formatAED } from '../../lib/utils';
import { MSIcon } from '../../components/ui/MSIcon';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useTheme } from '../../context/ThemeContext';
import { LIGHT, DARK } from '../../constants/colors';
import type { Statement } from '../../types';

function formatMonth(d: string) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); }
function formatDate(d: string) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }); }
function parseVerifyErrors(raw: any): string[] {
  if (!raw) return ['Unknown error'];
  if (typeof raw === 'string') { try { const p = JSON.parse(raw); return Array.isArray(p) ? p.map(String) : [String(p)]; } catch { return [raw]; } }
  if (Array.isArray(raw)) return raw.map(String);
  return [JSON.stringify(raw)];
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  passed:  { label: 'Passed',  color: '#10b981' },
  failed:  { label: 'Failed',  color: '#ef4444' },
  flagged: { label: 'Flagged', color: '#f59e0b' },
  pending: { label: 'Pending', color: '#6b7280' },
};

export default function StatementsScreen() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);
  const [retryAllMsg, setRetryAllMsg] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [errorStatement, setErrorStatement] = useState<Statement | null>(null);
  const inactiveColor = isDark ? DARK.onSurfaceVariant : LIGHT.onSurfaceVariant;

  useEffect(() => {
    api.listStatements()
      .then(data => setStatements(Array.isArray(data) ? data : []))
      .catch(() => setStatements([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: number, filename: string) {
    Alert.alert('Delete statement?', `Delete "${filename}"? This will also remove all associated transactions.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setDeletingId(id);
        try {
          await api.deleteStatement(id);
          setStatements(prev => prev.filter(s => s.id !== id));
          setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        } catch {} finally { setDeletingId(null); }
      }},
    ]);
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    Alert.alert('Delete statements?', `Delete ${ids.length} statement${ids.length !== 1 ? 's' : ''}? This will also remove all associated transactions.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setBulkDeleting(true);
        try {
          await Promise.all(ids.map(id => api.deleteStatement(id)));
          setStatements(prev => prev.filter(s => !selectedIds.has(s.id)));
          setSelectedIds(new Set());
        } catch {} finally { setBulkDeleting(false); }
      }},
    ]);
  }

  async function handleRetry(id: number) {
    setRetryingId(id);
    try {
      const updated = await api.reverifyStatement(id);
      setStatements(prev => prev.map(s => s.id === id ? { ...s, verify_status: updated.verify_status } : s));
    } catch {} finally { setRetryingId(null); }
  }

  async function handleRetryAll() {
    setRetryingAll(true); setRetryAllMsg(null);
    try {
      const result = await api.reverifyAllPending();
      setStatements(prev => prev.map(s => (s.verify_status === 'pending' || s.verify_status === 'failed') ? { ...s, verify_status: 'pending' } : s));
      setRetryAllMsg(`Queued ${result.queued} statement${result.queued !== 1 ? 's' : ''} for reprocessing`);
    } catch { setRetryAllMsg('Failed to queue statements'); }
    finally { setRetryingAll(false); }
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function toggleSelectAll() {
    if (selectedIds.size === statements.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(statements.map(s => s.id)));
  }

  const stuckCount = statements.filter(s => s.verify_status === 'pending' || s.verify_status === 'failed').length;
  const allSelected = statements.length > 0 && selectedIds.size === statements.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <View className="flex-1 bg-ft-background dark:bg-ve-background">
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 100, paddingHorizontal: 16 }}>
        <View className="flex-row items-start justify-between mb-4 gap-3 flex-wrap">
          <View>
            <Text className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Statements</Text>
            <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">All uploaded bank statements</Text>
          </View>
          {stuckCount > 0 && (
            <Pressable
              onPress={handleRetryAll}
              disabled={retryingAll}
              className="flex-row items-center gap-2 px-4 py-2 bg-amber-500 rounded-xl"
              style={{ opacity: retryingAll ? 0.6 : 1 }}
            >
              {retryingAll ? <ActivityIndicator size="small" color="white" /> : <MSIcon name="replay" size={16} color="white" />}
              <Text className="text-sm font-semibold text-white">Retry All ({stuckCount})</Text>
            </Pressable>
          )}
        </View>

        {retryAllMsg && <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-3">{retryAllMsg}</Text>}

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <View className="mb-4 flex-row items-center justify-between gap-3 px-4 py-3 bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl">
            <Text className="text-sm font-medium text-ft-on-surface dark:text-ve-on-surface">
              {selectedIds.size} selected
            </Text>
            <View className="flex-row items-center gap-2">
              <Pressable onPress={() => setSelectedIds(new Set())} className="px-3 py-1.5 rounded-lg">
                <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleBulkDelete}
                disabled={bulkDeleting}
                className="flex-row items-center gap-1.5 px-4 py-1.5 bg-red-500 rounded-xl"
                style={{ opacity: bulkDeleting ? 0.6 : 1 }}
              >
                {bulkDeleting ? <ActivityIndicator size="small" color="white" /> : <MSIcon name="delete" size={16} color="white" />}
                <Text className="text-sm font-semibold text-white">Delete {selectedIds.size}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Select all row */}
        {statements.length > 0 && (
          <View className="flex-row items-center gap-2 px-1 pb-2">
            <Pressable
              onPress={toggleSelectAll}
              style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: allSelected || someSelected ? (isDark ? DARK.primary : LIGHT.primary) : inactiveColor, backgroundColor: allSelected ? (isDark ? DARK.primary : LIGHT.primary) : 'transparent', alignItems: 'center', justifyContent: 'center' }}
            >
              {allSelected && <MSIcon name="check" size={12} color="white" />}
              {someSelected && <View style={{ width: 10, height: 2, backgroundColor: isDark ? DARK.primary : LIGHT.primary }} />}
            </Pressable>
            <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">Select all</Text>
          </View>
        )}

        {loading ? <Spinner fullScreen /> : statements.length === 0 ? (
          <EmptyState icon="description" title="No statements yet" subtitle="Upload your first financial statement to begin tracking your cash flow." />
        ) : (
          <View className="gap-3">
            {statements.map(stmt => {
              const statusCfg = STATUS_CONFIG[stmt.verify_status] ?? STATUS_CONFIG.pending;
              const isStuck = stmt.verify_status === 'pending' || stmt.verify_status === 'failed';
              const isSelected = selectedIds.has(stmt.id);
              return (
                <View
                  key={stmt.id}
                  className="bg-ft-surface dark:bg-ve-surface rounded-2xl p-5"
                  style={{ borderWidth: 1, borderColor: isSelected ? (isDark ? DARK.primary : LIGHT.primary) : (isDark ? DARK.outline : LIGHT.outlineVariant) }}
                >
                  <View className="flex-row items-start justify-between gap-4">
                    <View className="flex-row items-center gap-3 flex-1 min-w-0">
                      <Pressable
                        onPress={() => toggleSelect(stmt.id)}
                        style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: isSelected ? (isDark ? DARK.primary : LIGHT.primary) : inactiveColor, backgroundColor: isSelected ? (isDark ? DARK.primary : LIGHT.primary) : 'transparent', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}
                      >
                        {isSelected && <MSIcon name="check" size={12} color="white" />}
                      </Pressable>
                      <View className="w-10 h-10 rounded-xl bg-ft-surface-low dark:bg-ve-surface-high items-center justify-center shrink-0">
                        <MSIcon name="description" size={20} color={inactiveColor} />
                      </View>
                      <View className="min-w-0 flex-1">
                        <View className="flex-row items-center gap-2 flex-wrap">
                          <Text className="font-semibold text-ft-on-surface dark:text-ve-on-surface text-sm" numberOfLines={1}>
                            {formatMonth(stmt.period_start!)} → {formatMonth(stmt.period_end!)}
                          </Text>
                          <Pressable
                            onPress={stmt.verify_status === 'failed' ? () => setErrorStatement(stmt) : undefined}
                          >
                            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: statusCfg.color + '20' }}>
                              <Text style={{ fontSize: 11, fontWeight: '600', color: statusCfg.color }}>
                                {statusCfg.label}{stmt.verify_status === 'failed' ? ' ↗' : ''}
                              </Text>
                            </View>
                          </Pressable>
                        </View>
                        <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5" numberOfLines={1}>{stmt.filename}</Text>
                      </View>
                    </View>
                    <View className="flex-row items-center gap-2 shrink-0">
                      {isStuck && (
                        <Pressable onPress={() => handleRetry(stmt.id)} disabled={retryingId === stmt.id}>
                          {retryingId === stmt.id
                            ? <ActivityIndicator size="small" color="#f59e0b" />
                            : <MSIcon name="replay" size={20} color="#f59e0b" />
                          }
                        </Pressable>
                      )}
                      <Pressable onPress={() => handleDelete(stmt.id, stmt.filename ?? '')} disabled={deletingId === stmt.id}>
                        {deletingId === stmt.id
                          ? <ActivityIndicator size="small" color="#ef4444" />
                          : <MSIcon name="delete" size={20} color={inactiveColor} />
                        }
                      </Pressable>
                    </View>
                  </View>

                  <View className="mt-4 flex-row flex-wrap gap-3">
                    <View style={{ flex: 1, minWidth: 100 }}>
                      <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">Opening Balance</Text>
                      <Text className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface mt-0.5">{formatAED(stmt.opening_balance ?? 0)}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 100 }}>
                      <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">Closing Balance</Text>
                      <Text className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface mt-0.5">{formatAED(stmt.closing_balance ?? 0)}</Text>
                    </View>
                    {stmt.transaction_count != null && (
                      <View style={{ flex: 1, minWidth: 80 }}>
                        <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">Transactions</Text>
                        <Text className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface mt-0.5">{stmt.transaction_count}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1, minWidth: 100 }}>
                      <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">Uploaded</Text>
                      <Text className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface mt-0.5">{formatDate(stmt.created_at)}</Text>
                    </View>
                  </View>

                  {stmt.confidence != null && (
                    <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-2">
                      Confidence:{' '}
                      <Text style={{ fontWeight: '600', color: stmt.confidence >= 0.9 ? '#10b981' : stmt.confidence >= 0.7 ? '#f59e0b' : '#ef4444' }}>
                        {Math.round(stmt.confidence * 100)}%
                      </Text>
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Error detail modal */}
      {errorStatement && (
        <RNModal transparent animationType="fade" visible onRequestClose={() => setErrorStatement(null)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 }} onPress={() => setErrorStatement(null)}>
            <Pressable style={{ backgroundColor: isDark ? DARK.surface : LIGHT.surface, borderRadius: 16, padding: 24, width: '100%', borderWidth: 1, borderColor: isDark ? DARK.outline : LIGHT.outlineVariant }} onPress={e => e.stopPropagation()}>
              <View className="flex-row items-center justify-between mb-4">
                <Text style={{ fontSize: 16, fontWeight: '700', color: isDark ? DARK.onSurface : LIGHT.onSurface }}>Verification Errors</Text>
                <Pressable onPress={() => setErrorStatement(null)}>
                  <MSIcon name="close" size={20} color={inactiveColor} />
                </Pressable>
              </View>
              <Text style={{ fontSize: 12, color: inactiveColor, marginBottom: 12 }}>{errorStatement.filename}</Text>
              <ScrollView style={{ maxHeight: 240 }}>
                {parseVerifyErrors(errorStatement.verify_errors).map((e: string, i: number) => (
                  <View key={i} style={{ backgroundColor: (isDark ? DARK.error : '#ef4444') + '15', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, color: isDark ? DARK.error : '#dc2626' }}>{e}</Text>
                  </View>
                ))}
              </ScrollView>
              <Pressable
                onPress={() => setErrorStatement(null)}
                style={{ marginTop: 16, borderWidth: 1, borderColor: isDark ? DARK.outline : LIGHT.outlineVariant, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14, color: isDark ? DARK.onSurface : LIGHT.onSurface }}>Close</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </RNModal>
      )}
    </View>
  );
}
