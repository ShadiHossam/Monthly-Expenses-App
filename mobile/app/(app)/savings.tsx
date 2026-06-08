import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { formatAED } from '../../lib/utils';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { ColorSwatch } from '../../components/ui/ColorSwatch';
import { MSIcon } from '../../components/ui/MSIcon';
import { useTheme } from '../../context/ThemeContext';
import { LIGHT, DARK } from '../../constants/colors';

const COLORS = ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];

export default function SavingsScreen() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', targetAmount: '', targetDate: '', color: '#10b981' });
  const [saving, setSaving] = useState(false);
  const inactiveColor = isDark ? DARK.onSurfaceVariant : LIGHT.onSurfaceVariant;

  useEffect(() => {
    api.listSavingsGoals().then(setGoals).catch(() => setGoals([])).finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!form.name || !form.targetAmount || !form.targetDate) return;
    setSaving(true);
    try {
      await api.createSavingsGoal({ name: form.name, targetAmount: parseFloat(form.targetAmount), targetDate: form.targetDate, color: form.color });
      const fresh = await api.listSavingsGoals();
      setGoals(fresh);
      setShowForm(false); setForm({ name: '', targetAmount: '', targetDate: '', color: '#10b981' });
    } catch (err: any) { Alert.alert('Error', err.message || 'Failed to create goal'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    Alert.alert('Delete savings goal?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await api.deleteSavingsGoal(id);
        setGoals(prev => prev.filter((g: any) => g.id !== id));
      }},
    ]);
  }

  const inputClass = 'border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2.5 text-sm bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface';

  return (
    <ScrollView
      className="flex-1 bg-ft-background dark:bg-ve-background"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 100, paddingHorizontal: 16 }}
    >
      <View className="flex-row items-center justify-between mb-6">
        <View>
          <Text className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Savings Goals</Text>
          <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">Track progress toward financial targets</Text>
        </View>
        <Pressable
          onPress={() => setShowForm(v => !v)}
          className="flex-row items-center gap-1.5 px-4 py-2 rounded-xl bg-ft-primary dark:bg-ve-primary"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <MSIcon name="add" size={18} color={isDark ? DARK.background : 'white'} />
          <Text className="text-sm font-medium text-white dark:text-ve-background">New goal</Text>
        </Pressable>
      </View>

      {showForm && (
        <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 mb-6 gap-3">
          <TextInput
            className={inputClass}
            placeholder="Goal name (e.g. Emergency fund)"
            placeholderTextColor={inactiveColor}
            value={form.name}
            onChangeText={v => setForm(p => ({ ...p, name: v }))}
          />
          <View className="flex-row gap-3">
            <TextInput
              className={`${inputClass} flex-1`}
              placeholder="Target (AED)"
              placeholderTextColor={inactiveColor}
              keyboardType="decimal-pad"
              value={form.targetAmount}
              onChangeText={v => setForm(p => ({ ...p, targetAmount: v }))}
            />
            <TextInput
              className={`${inputClass} flex-1`}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={inactiveColor}
              value={form.targetDate}
              onChangeText={v => setForm(p => ({ ...p, targetDate: v }))}
            />
          </View>
          <ColorSwatch colors={COLORS} selected={form.color} onSelect={c => setForm(p => ({ ...p, color: c }))} />
          <View className="flex-row gap-2">
            <Pressable
              onPress={handleCreate}
              disabled={saving || !form.name || !form.targetAmount || !form.targetDate}
              className="flex-1 bg-ft-primary dark:bg-ve-primary rounded-xl py-2.5 items-center"
              style={{ opacity: saving || !form.name || !form.targetAmount || !form.targetDate ? 0.5 : 1 }}
            >
              {saving ? <ActivityIndicator size="small" color="white" /> : <Text className="text-sm font-medium text-white dark:text-ve-background">Create</Text>}
            </Pressable>
            <Pressable
              onPress={() => setShowForm(false)}
              className="flex-1 border border-ft-outline-variant dark:border-ve-outline rounded-xl py-2.5 items-center"
            >
              <Text className="text-sm text-ft-on-surface dark:text-ve-on-surface">Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      {loading ? <Spinner fullScreen /> : goals.length === 0 ? (
        <EmptyState icon="savings" title="No savings goals yet" subtitle="Create one to track progress." />
      ) : (
        <View className="gap-4">
          {goals.map((goal: any) => {
            const pct = goal.progress_pct ?? 0;
            const overdue = new Date(goal.target_date) < new Date() && pct < 100;
            return (
              <View key={goal.id} className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5">
                <View className="flex-row items-start justify-between mb-3">
                  <View>
                    <View className="flex-row items-center gap-2 mb-0.5">
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: goal.color, flexShrink: 0 }} />
                      <Text className="font-semibold text-ft-on-surface dark:text-ve-on-surface">{goal.name}</Text>
                    </View>
                    <Text className={`text-xs ${overdue ? 'text-red-500 dark:text-red-400' : 'text-ft-on-surface-variant dark:text-ve-on-surface-variant'}`}>
                      Target: {new Date(goal.target_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      {overdue ? ' · Overdue' : ''}
                    </Text>
                  </View>
                  <Pressable onPress={() => handleDelete(goal.id)}>
                    <MSIcon name="delete" size={18} color={isDark ? DARK.error : '#ef4444'} />
                  </Pressable>
                </View>
                <View className="flex-row items-center justify-between text-sm mb-2">
                  <Text className="font-medium text-ft-on-surface dark:text-ve-on-surface">{formatAED(goal.net_saved ?? 0)}</Text>
                  <Text className="text-ft-on-surface-variant dark:text-ve-on-surface-variant">of {formatAED(goal.target_amount)}</Text>
                </View>
                <ProgressBar pct={pct} color={goal.color} height={8} className="mb-1.5" />
                <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant text-right">{pct.toFixed(1)}% saved</Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
