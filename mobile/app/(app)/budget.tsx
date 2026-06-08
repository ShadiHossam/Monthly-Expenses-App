import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput,
  Switch, Alert, ActivityIndicator, Modal as RNModal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { formatAED } from '../../lib/utils';
import { MSIcon } from '../../components/ui/MSIcon';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ColorSwatch } from '../../components/ui/ColorSwatch';
import { BUDGET_PRESET_COLORS } from '../../constants/icons';
import { useTheme } from '../../context/ThemeContext';
import { LIGHT, DARK } from '../../constants/colors';
import type { BudgetStatus, Category } from '../../types';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

async function loadBudgets(year: number, month: number): Promise<BudgetStatus[]> {
  const res = await api.listBudgets({ year, month });
  return Array.isArray(res) ? res as unknown as BudgetStatus[] : ((res as any).data ?? []);
}

export default function BudgetScreen() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const now = new Date();

  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [budgets, setBudgets] = useState<BudgetStatus[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formLimit, setFormLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLimit, setEditLimit] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [alertsDismissed, setAlertsDismissed] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);

  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1;

  useEffect(() => {
    setLoading(true);
    Promise.all([loadBudgets(selectedYear, selectedMonth), api.listCategories()])
      .then(([bl, cats]) => { setBudgets(bl); setCategories(Array.isArray(cats) ? cats : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedYear, selectedMonth]);

  function goPrevMonth() {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  }

  function goNextMonth() {
    if (isCurrentMonth) return;
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  }

  async function handleToggle(budget: BudgetStatus) {
    setTogglingId(budget.id);
    try {
      await api.updateBudget(budget.id, { enabled: !budget.enabled });
      setBudgets(prev => prev.map(b => b.id === budget.id ? { ...b, enabled: !b.enabled } : b));
    } catch {} finally { setTogglingId(null); }
  }

  async function handleDelete(id: number, name: string) {
    Alert.alert('Remove budget?', `Remove budget alert for "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        setDeletingId(id);
        try {
          await api.deleteBudget(id);
          setBudgets(prev => prev.filter(b => b.id !== id));
        } catch {} finally { setDeletingId(null); }
      }},
    ]);
  }

  async function handleCreate() {
    if (!formCategoryId || !formLimit) return;
    const limitNum = parseFloat(formLimit);
    if (isNaN(limitNum) || limitNum <= 0) return;
    setSaving(true);
    try {
      await api.createBudget(Number(formCategoryId), limitNum);
      const fresh = await loadBudgets(selectedYear, selectedMonth);
      setBudgets(fresh);
      setShowForm(false); setFormCategoryId(''); setFormLimit('');
    } catch {} finally { setSaving(false); }
  }

  async function handleEditSave(budget: BudgetStatus) {
    const limitNum = parseFloat(editLimit);
    if (isNaN(limitNum) || limitNum <= 0) return;
    setEditSaving(true);
    try {
      const tasks: Promise<unknown>[] = [api.updateBudget(budget.id, { monthly_limit: limitNum })];
      if (editColor !== budget.category_color) {
        tasks.push(api.updateCategory(budget.category_id, { color: editColor }));
      }
      await Promise.all(tasks);
      const fresh = await loadBudgets(selectedYear, selectedMonth);
      setBudgets(fresh); setEditingId(null);
    } catch {} finally { setEditSaving(false); }
  }

  const usedCategoryIds = new Set(budgets.map(b => b.category_id));
  const availableCategories = categories.filter(c => !usedCategoryIds.has(c.id));
  const exceededBudgets = budgets.filter(b => b.enabled && b.status === 'exceeded');
  const warningBudgets = budgets.filter(b => b.enabled && b.status === 'warning');
  const inactiveColor = isDark ? DARK.onSurfaceVariant : LIGHT.onSurfaceVariant;

  return (
    <View className="flex-1 bg-ft-background dark:bg-ve-background">
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 100, paddingHorizontal: 16 }}>
        {/* Header */}
        <View className="flex-row items-start justify-between mb-4">
          <View>
            <Text className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Budgets</Text>
            <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">Track your spending limits</Text>
          </View>
          <Pressable
            onPress={() => setShowForm(v => !v)}
            className="flex-row items-center gap-2 px-4 py-2.5 bg-ft-primary dark:bg-ve-primary-dim rounded-xl"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MSIcon name="add" size={18} color={isDark ? DARK.background : 'white'} />
            <Text className="text-sm font-semibold text-white dark:text-ve-background">New Budget</Text>
          </Pressable>
        </View>

        {/* Month navigator */}
        <View className="flex-row items-center gap-2 mb-5">
          <Pressable onPress={goPrevMonth} className="w-8 h-8 items-center justify-center rounded-xl bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline">
            <MSIcon name="chevron_left" size={20} color={inactiveColor} />
          </Pressable>
          <Text className="flex-1 text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface text-center">
            {MONTH_NAMES[selectedMonth-1]} {selectedYear}
            {isCurrentMonth ? <Text className="text-ft-primary dark:text-ve-primary"> (current)</Text> : null}
          </Text>
          <Pressable
            onPress={goNextMonth}
            disabled={isCurrentMonth}
            className="w-8 h-8 items-center justify-center rounded-xl bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline"
            style={{ opacity: isCurrentMonth ? 0.3 : 1 }}
          >
            <MSIcon name="chevron_right" size={20} color={inactiveColor} />
          </Pressable>
          {loading && <ActivityIndicator size="small" color={isDark ? DARK.primary : LIGHT.primary} />}
        </View>

        {/* Alert banner */}
        {!alertsDismissed && (exceededBudgets.length > 0 || warningBudgets.length > 0) && (
          <View className={`rounded-2xl p-4 mb-5 flex-row items-start justify-between gap-3 ${exceededBudgets.length > 0 ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'}`}>
            <View className="flex-row items-start gap-3 flex-1">
              <MSIcon name="notifications_active" size={20} color={exceededBudgets.length > 0 ? '#ef4444' : '#f59e0b'} />
              <View className="flex-1">
                {exceededBudgets.length > 0 && (
                  <Text className="text-sm font-semibold text-red-700 dark:text-red-300">
                    {exceededBudgets.length} budget{exceededBudgets.length > 1 ? 's' : ''} exceeded: {exceededBudgets.map(b => b.category_name).join(', ')}
                  </Text>
                )}
                {warningBudgets.length > 0 && (
                  <Text className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                    {warningBudgets.length} nearing limit: {warningBudgets.map(b => b.category_name).join(', ')}
                  </Text>
                )}
              </View>
            </View>
            <Pressable onPress={() => setAlertsDismissed(true)}>
              <MSIcon name="close" size={18} color={inactiveColor} />
            </Pressable>
          </View>
        )}

        {/* Create form */}
        {showForm && (
          <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 mb-5 gap-3">
            <Text className="text-sm font-bold text-ft-on-surface dark:text-ve-on-surface">New Budget Alert</Text>

            <Pressable
              onPress={() => setShowCatModal(true)}
              className="border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2.5 bg-ft-surface-low dark:bg-ve-surface-high"
            >
              <Text className={`text-sm ${formCategoryId ? 'text-ft-on-surface dark:text-ve-on-surface' : 'text-ft-on-surface-variant dark:text-ve-on-surface-variant'}`}>
                {formCategoryId ? categories.find(c => String(c.id) === formCategoryId)?.name : 'Select a category…'}
              </Text>
            </Pressable>

            <TextInput
              className="border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2.5 text-sm text-ft-on-surface dark:text-ve-on-surface bg-ft-surface-low dark:bg-ve-surface-high"
              placeholder="Monthly limit (AED)"
              placeholderTextColor={inactiveColor}
              keyboardType="decimal-pad"
              value={formLimit}
              onChangeText={setFormLimit}
            />

            <View className="flex-row gap-2">
              <Pressable
                onPress={handleCreate}
                disabled={saving || !formCategoryId || !formLimit}
                className="flex-1 py-2.5 bg-ft-primary dark:bg-ve-primary-dim rounded-xl items-center"
                style={{ opacity: saving || !formCategoryId || !formLimit ? 0.5 : 1 }}
              >
                {saving ? <ActivityIndicator size="small" color="white" /> : <Text className="text-sm font-semibold text-white dark:text-ve-background">Save</Text>}
              </Pressable>
              <Pressable
                onPress={() => { setShowForm(false); setFormCategoryId(''); setFormLimit(''); }}
                className="flex-1 py-2.5 border border-ft-outline-variant dark:border-ve-outline rounded-xl items-center"
              >
                <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant">Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Budget list */}
        {loading && budgets.length === 0 ? <Spinner fullScreen /> : budgets.length === 0 ? (
          <EmptyState
            icon="account_balance_wallet"
            title="No budgets set up yet"
            subtitle="Add a budget to start tracking your spending limits."
            action={{ label: 'Create First Budget', onPress: () => setShowForm(true) }}
          />
        ) : (
          <View className="gap-3">
            {budgets.map(budget => {
              const pct = Math.min(budget.percentage ?? 0, 100);
              const barColor = budget.status === 'exceeded' ? '#ef4444' : budget.status === 'warning' ? '#f59e0b' : (isDark ? DARK.primaryDim : LIGHT.primary);
              const statusLabel = budget.status === 'exceeded' ? 'Over budget' : budget.status === 'warning' ? 'Nearing Limit' : 'Safe';
              const statusColor = budget.status === 'exceeded' ? '#ef4444' : budget.status === 'warning' ? '#f59e0b' : (isDark ? DARK.primary : LIGHT.primary);
              const remaining = budget.monthly_limit - budget.spent_this_month;
              const isEditing = editingId === budget.id;

              return (
                <View
                  key={budget.id}
                  className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5"
                  style={{ opacity: budget.enabled ? 1 : 0.6 }}
                >
                  <View className="flex-row items-start justify-between gap-3 mb-3">
                    <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: (budget.category_color || '#94a3b8') + '20', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: budget.category_color || '#94a3b8' }} />
                      </View>
                      <View className="min-w-0">
                        <Text className="font-semibold text-ft-on-surface dark:text-ve-on-surface" numberOfLines={1}>{budget.category_name}</Text>
                        <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">Monthly Budget</Text>
                      </View>
                    </View>
                    <View className="flex-row items-center gap-2 shrink-0">
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: statusColor + '15' }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: statusColor }}>{statusLabel}</Text>
                      </View>
                      <Switch
                        value={budget.enabled}
                        onValueChange={() => handleToggle(budget)}
                        disabled={togglingId === budget.id}
                        trackColor={{ false: isDark ? DARK.outline : LIGHT.outlineVariant, true: isDark ? DARK.primary : LIGHT.primary }}
                        thumbColor="white"
                      />
                      <Pressable onPress={() => { if (isEditing) { setEditingId(null); } else { setEditingId(budget.id); setEditLimit(String(budget.monthly_limit)); setEditColor(budget.category_color || '#94a3b8'); } }}>
                        <MSIcon name={isEditing ? 'edit_off' : 'edit'} size={18} color={isEditing ? (isDark ? DARK.primary : LIGHT.primary) : inactiveColor} />
                      </Pressable>
                      <Pressable onPress={() => handleDelete(budget.id, budget.category_name)} disabled={deletingId === budget.id}>
                        {deletingId === budget.id
                          ? <ActivityIndicator size="small" color="#ef4444" />
                          : <MSIcon name="delete" size={18} color={isDark ? DARK.error : '#ef4444'} />
                        }
                      </Pressable>
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between mb-1.5">
                    <Text className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface">
                      {formatAED(budget.spent_this_month ?? 0)}{' '}
                      <Text className="font-normal text-ft-on-surface-variant dark:text-ve-on-surface-variant">/ {formatAED(budget.monthly_limit)}</Text>
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: statusColor }}>{Math.round(budget.percentage ?? 0)}%</Text>
                  </View>

                  <ProgressBar pct={pct} color={barColor} height={8} className="mb-2" />

                  <View className="flex-row items-center justify-between">
                    <Text style={{ fontSize: 12, fontWeight: '500', color: statusColor }}>
                      {budget.status === 'exceeded' ? `Over by ${formatAED(Math.abs(remaining))}` : budget.status === 'warning' ? `${formatAED(remaining)} remaining — approaching limit` : `${formatAED(remaining)} remaining`}
                    </Text>
                    {budget.breach_count > 0 && (
                      <Text style={{ fontSize: 11, color: budget.breach_count >= 4 ? '#ef4444' : '#f59e0b' }}>
                        Exceeded {budget.breach_count}× recently
                      </Text>
                    )}
                  </View>

                  {/* Inline edit form */}
                  {isEditing && (
                    <View className="mt-4 pt-4 border-t border-ft-outline-variant dark:border-ve-outline gap-3">
                      <Text className="text-xs font-semibold text-ft-on-surface dark:text-ve-on-surface">Edit Budget</Text>
                      <TextInput
                        className="border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2.5 text-sm text-ft-on-surface dark:text-ve-on-surface bg-ft-surface-low dark:bg-ve-surface-high"
                        placeholder="Monthly limit (AED)"
                        placeholderTextColor={inactiveColor}
                        keyboardType="decimal-pad"
                        value={editLimit}
                        onChangeText={setEditLimit}
                      />
                      <ColorSwatch colors={BUDGET_PRESET_COLORS} selected={editColor} onSelect={setEditColor} />
                      <View className="flex-row gap-2">
                        <Pressable
                          onPress={() => handleEditSave(budget)}
                          disabled={editSaving}
                          className="flex-1 py-2 bg-ft-primary dark:bg-ve-primary-dim rounded-xl items-center"
                          style={{ opacity: editSaving ? 0.5 : 1 }}
                        >
                          {editSaving ? <ActivityIndicator size="small" color="white" /> : <Text className="text-sm font-semibold text-white dark:text-ve-background">Save Changes</Text>}
                        </Pressable>
                        <Pressable
                          onPress={() => setEditingId(null)}
                          className="flex-1 py-2 border border-ft-outline-variant dark:border-ve-outline rounded-xl items-center"
                        >
                          <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant">Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Category picker modal */}
      <RNModal visible={showCatModal} transparent animationType="slide" onRequestClose={() => setShowCatModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setShowCatModal(false)} />
        <View style={{ backgroundColor: isDark ? DARK.surface : LIGHT.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '60%' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: isDark ? DARK.onSurface : LIGHT.onSurface, padding: 20, paddingBottom: 12 }}>Select Category</Text>
          <ScrollView>
            {availableCategories.map(c => (
              <Pressable
                key={c.id}
                onPress={() => { setFormCategoryId(String(c.id)); setShowCatModal(false); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: isDark ? DARK.outline : LIGHT.outlineVariant }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: c.color }} />
                <Text style={{ fontSize: 14, color: isDark ? DARK.onSurface : LIGHT.onSurface }}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </RNModal>
    </View>
  );
}
