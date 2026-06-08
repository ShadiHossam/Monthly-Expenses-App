import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { MSIcon } from '../../components/ui/MSIcon';
import { Spinner } from '../../components/ui/Spinner';
import { ColorSwatch } from '../../components/ui/ColorSwatch';
import { PRESET_ICONS, PRESET_COLORS } from '../../constants/icons';
import { useTheme } from '../../context/ThemeContext';
import { LIGHT, DARK } from '../../constants/colors';

export default function CategoriesScreen() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#10b981');
  const [newIcon, setNewIcon] = useState('label');
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [rulePattern, setRulePattern] = useState('');
  const [ruleCatId, setRuleCatId] = useState<number | ''>('');
  const [aiMerchantInput, setAiMerchantInput] = useState('');
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggestionReason, setAiSuggestionReason] = useState('');
  const inactiveColor = isDark ? DARK.onSurfaceVariant : LIGHT.onSurfaceVariant;

  async function load() {
    const [cats, rls] = await Promise.all([api.listCategories(), api.listRules()]);
    setCategories(Array.isArray(cats) ? cats : []);
    setRules(Array.isArray(rls) ? rls : []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function addCategory() {
    if (!newName.trim()) return;
    await api.createCategory(newName.trim(), newColor, newIcon);
    setNewName(''); setShowAdd(false); setAiMerchantInput(''); setAiSuggestionReason('');
    load();
  }

  async function deleteCategory(id: number) {
    Alert.alert('Delete category?', 'Transactions will move to Uncategorized.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api.deleteCategory(id); load(); } },
    ]);
  }

  async function getAISuggestion() {
    if (!aiMerchantInput.trim()) return;
    setAiSuggesting(true); setAiSuggestionReason('');
    try {
      const res = await api.aiSuggestCategory(aiMerchantInput.trim());
      const s = (res as any).data ?? res;
      setNewName(s.name); setNewColor(s.color || '#10b981'); setAiSuggestionReason(s.reason || '');
    } finally { setAiSuggesting(false); }
  }

  async function addRule() {
    if (!rulePattern.trim() || !ruleCatId) return;
    await api.createRule({ pattern: rulePattern.trim(), pattern_type: 'contains', category_id: ruleCatId as number, priority: 0 });
    setRulePattern(''); setRuleCatId(''); setShowRuleForm(false); load();
  }

  async function deleteRule(id: number) { await api.deleteRule(id); load(); }

  const inputClass = 'border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2.5 text-sm bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface';

  return (
    <ScrollView
      className="flex-1 bg-ft-background dark:bg-ve-background"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 100, paddingHorizontal: 16 }}
    >
      <View className="flex-row items-start justify-between mb-6">
        <View>
          <Text className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Categories</Text>
          <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">Organize transactions</Text>
        </View>
        <Pressable
          onPress={() => setShowAdd(v => !v)}
          className="flex-row items-center gap-1.5 px-4 py-2 bg-ft-primary dark:bg-ve-primary-dim rounded-xl"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <MSIcon name="add" size={18} color={isDark ? DARK.background : 'white'} />
          <Text className="text-sm font-semibold text-white dark:text-ve-background">Add</Text>
        </Pressable>
      </View>

      {/* Add form */}
      {showAdd && (
        <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 mb-5 gap-4">
          <Text className="text-sm font-bold text-ft-on-surface dark:text-ve-on-surface">New Category</Text>

          {/* AI suggest */}
          <View className="flex-row gap-2">
            <TextInput
              className={`${inputClass} flex-1`}
              placeholder="Merchant name for AI suggestion…"
              placeholderTextColor={inactiveColor}
              value={aiMerchantInput}
              onChangeText={setAiMerchantInput}
            />
            <Pressable
              onPress={getAISuggestion}
              disabled={aiSuggesting || !aiMerchantInput.trim()}
              className="flex-row items-center gap-1.5 px-3 bg-ft-secondary dark:bg-ve-primary/20 rounded-xl"
              style={{ opacity: aiSuggesting || !aiMerchantInput.trim() ? 0.5 : 1 }}
            >
              {aiSuggesting
                ? <ActivityIndicator size="small" color={isDark ? DARK.primary : 'white'} />
                : <MSIcon name="smart_toy" size={16} color={isDark ? DARK.primary : 'white'} />
              }
              <Text style={{ color: isDark ? DARK.primary : 'white', fontSize: 13, fontWeight: '600' }}>AI</Text>
            </Pressable>
          </View>

          {aiSuggestionReason ? (
            <View className="flex-row items-start gap-2 bg-ft-secondary/5 dark:bg-ve-primary/10 rounded-xl px-3 py-2">
              <MSIcon name="info" size={16} color={isDark ? DARK.primary : LIGHT.secondary} />
              <Text className="text-xs text-ft-secondary dark:text-ve-primary flex-1">{aiSuggestionReason}</Text>
            </View>
          ) : null}

          <TextInput
            className={inputClass}
            placeholder="Category name"
            placeholderTextColor={inactiveColor}
            value={newName}
            onChangeText={setNewName}
          />

          {/* Icon picker */}
          <View>
            <Text className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-2">Icon</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, maxWidth: 320 }}>
                {PRESET_ICONS.map(iconName => (
                  <Pressable
                    key={iconName}
                    onPress={() => setNewIcon(iconName)}
                    style={{
                      width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: newIcon === iconName ? (isDark ? DARK.primary : LIGHT.primary) : (isDark ? DARK.surfaceHigh : LIGHT.surfaceLow),
                    }}
                  >
                    <MSIcon name={iconName} size={18} color={newIcon === iconName ? 'white' : inactiveColor} />
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Color picker */}
          <ColorSwatch colors={PRESET_COLORS} selected={newColor} onSelect={setNewColor} />

          <View className="flex-row gap-2">
            <Pressable
              onPress={() => { setShowAdd(false); setAiMerchantInput(''); setAiSuggestionReason(''); }}
              className="flex-1 py-2.5 border border-ft-outline-variant dark:border-ve-outline rounded-xl items-center"
            >
              <Text className="text-sm font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={addCategory}
              className="flex-1 py-2.5 bg-ft-primary dark:bg-ve-primary-dim rounded-xl items-center"
            >
              <Text className="text-sm font-semibold text-white dark:text-ve-background">Create</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Categories list */}
      {loading ? <Spinner fullScreen /> : (
        <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl overflow-hidden mb-6">
          {categories.map((cat, i) => (
            <View
              key={cat.id}
              className={`flex-row items-center gap-3 px-5 py-4 ${i < categories.length - 1 ? 'border-b border-ft-outline-variant dark:border-ve-outline' : ''}`}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: (cat.color || '#94a3b8') + '20', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MSIcon name={cat.icon || 'label'} size={18} color={cat.color || '#94a3b8'} />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface">{cat.name}</Text>
                <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">
                  {cat.transaction_count ?? 0} transactions{cat.is_system ? ' · system' : ''}
                </Text>
              </View>
              {!cat.is_system && (
                <Pressable onPress={() => deleteCategory(cat.id)} hitSlop={8}>
                  <MSIcon name="delete" size={18} color={isDark ? DARK.error : '#ef4444'} />
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Auto-rules */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="font-semibold text-ft-on-surface dark:text-ve-on-surface">Auto-Rules</Text>
        <Pressable onPress={() => setShowRuleForm(v => !v)} className="flex-row items-center gap-1">
          <MSIcon name="add" size={16} color={isDark ? DARK.primary : LIGHT.primary} />
          <Text className="text-sm font-semibold text-ft-primary dark:text-ve-primary">Add Rule</Text>
        </Pressable>
      </View>
      <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-4">
        Automatically categorize future transactions by pattern matching.
      </Text>

      {showRuleForm && (
        <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 mb-4 gap-3">
          <TextInput className={inputClass} placeholder="Pattern (e.g. Brands for Less)" placeholderTextColor={inactiveColor} value={rulePattern} onChangeText={setRulePattern} />
          <Pressable
            onPress={() => {}}
            className="border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2.5 bg-ft-surface-low dark:bg-ve-surface-high"
          >
            <Text className={ruleCatId ? 'text-sm text-ft-on-surface dark:text-ve-on-surface' : 'text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant'}>
              {ruleCatId ? categories.find(c => c.id === ruleCatId)?.name : 'Select category…'}
            </Text>
          </Pressable>
          <View className="flex-row gap-2">
            <Pressable onPress={() => setShowRuleForm(false)} className="flex-1 py-2.5 border border-ft-outline-variant dark:border-ve-outline rounded-xl items-center">
              <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant">Cancel</Text>
            </Pressable>
            <Pressable onPress={addRule} className="flex-1 py-2.5 bg-ft-primary dark:bg-ve-primary-dim rounded-xl items-center">
              <Text className="text-sm font-semibold text-white dark:text-ve-background">Save Rule</Text>
            </Pressable>
          </View>
        </View>
      )}

      {rules.length > 0 ? (
        <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl overflow-hidden">
          {rules.map((rule, i) => {
            const cat = categories.find(c => c.id === rule.category_id);
            return (
              <View key={rule.id} className={`flex-row items-center gap-3 px-5 py-4 ${i < rules.length - 1 ? 'border-b border-ft-outline-variant dark:border-ve-outline' : ''}`}>
                <MSIcon name="rule" size={18} color={inactiveColor} />
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-medium text-ft-on-surface dark:text-ve-on-surface">"{rule.pattern}"</Text>
                  <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">→ {cat?.name ?? 'Unknown'}</Text>
                </View>
                <Pressable onPress={() => deleteRule(rule.id)} hitSlop={8}>
                  <MSIcon name="close" size={18} color={inactiveColor} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : (
        <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-10 items-center">
          <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant text-center">No auto-rules yet. Add one to auto-categorize future uploads.</Text>
        </View>
      )}
    </ScrollView>
  );
}
