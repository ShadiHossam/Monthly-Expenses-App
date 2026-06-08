import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, Alert,
  Switch, TextInput, Modal as RNModal, ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../../lib/api';
import { formatAED } from '../../../lib/utils';
import { MSIcon } from '../../../components/ui/MSIcon';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { useUploadContext, STEPS } from '../../../context/UploadContext';
import { PRESET_COLORS } from '../../../constants/icons';
import { useTheme } from '../../../context/ThemeContext';
import { LIGHT, DARK } from '../../../constants/colors';
import type { FileEntry, QAItem } from '../../../context/UploadContext';
import type { BillingUsage } from '../../../types';

export default function UploadScreen() {
  const { isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    entries, addFiles, updateEntry, processFile, reset,
    qaItems, setQaItems, qaIndex, setQaIndex,
    allDone, setAllDone,
    overlapWarnings,
    overagePending, setOveragePending,
    categories, setCategories,
  } = useUploadContext();

  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [applyRule, setApplyRule] = useState(true);
  const [creatingNewCat, setCreatingNewCat] = useState(false);
  const [showNewCatForm, setShowNewCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6366f1');
  const [usage, setUsage] = useState<BillingUsage | null>(null);

  useEffect(() => { api.getBillingUsage().then(setUsage).catch(() => {}); }, []);
  useEffect(() => { api.listCategories().then(setCategories).catch(() => {}); }, [setCategories]);

  useEffect(() => {
    if (qaItems.length > 0 && qaIndex < qaItems.length) {
      setSelectedCat(qaItems[qaIndex].suggested_category_id ?? null);
    }
  }, [qaIndex, qaItems]);

  async function pickFiles() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      addFiles(result.assets.map(a => ({ uri: a.uri, name: a.name, type: a.mimeType ?? 'application/pdf' })));
    }
  }

  async function pickCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission denied', 'Camera access is needed to photograph statements.'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!result.canceled && result.assets.length > 0) {
      addFiles(result.assets.map(a => ({ uri: a.uri, name: `statement_${Date.now()}.jpg`, type: 'image/jpeg' })));
    }
  }

  async function handleQAAnswer() {
    if (!selectedCat) return;
    const item = qaItems[qaIndex];
    await api.answerQA(item.merchant_name, selectedCat, applyRule, item.transaction_ids);
    const next = qaIndex + 1;
    setShowNewCatForm(false); setNewCatName('');
    if (next >= qaItems.length) { setAllDone(true); } else { setQaIndex(next); }
  }

  async function handleAddAndUseNewCategory(suggestion: { name: string; color: string; icon: string }) {
    setCreatingNewCat(true);
    try {
      const newCat = await api.createCategory(suggestion.name, suggestion.color, suggestion.icon || 'label') as any;
      setCategories(await api.listCategories()); setSelectedCat(newCat.id);
    } finally { setCreatingNewCat(false); }
  }

  async function handleCreateNewCat() {
    if (!newCatName.trim()) return;
    setCreatingNewCat(true);
    try {
      const newCat = await api.createCategory(newCatName.trim(), newCatColor, 'label') as any;
      setCategories(await api.listCategories()); setSelectedCat(newCat.id); setShowNewCatForm(false); setNewCatName('');
    } finally { setCreatingNewCat(false); }
  }

  async function handleQASkip() {
    const item = qaItems[qaIndex];
    await api.skipQA(item.merchant_name, item.transaction_ids);
    const next = qaIndex + 1;
    setShowNewCatForm(false); setNewCatName('');
    if (next >= qaItems.length) { setAllDone(true); } else { setQaIndex(next); }
  }

  async function handleSkipAll() {
    const remaining = qaItems.slice(qaIndex);
    await Promise.all(remaining.map(item => api.skipQA(item.merchant_name, item.transaction_ids)));
    setAllDone(true);
  }

  async function handleAutoAssignAI() {
    const remaining = qaItems.slice(qaIndex);
    const withSuggestion = remaining.filter(item => item.suggested_category_id);
    const withoutSuggestion = remaining.filter(item => !item.suggested_category_id);
    const promises: Promise<unknown>[] = [];
    if (withSuggestion.length > 0) {
      promises.push(api.answerBatchQA(withSuggestion.map(item => ({
        merchant_name: item.merchant_name,
        category_id: item.suggested_category_id!,
        apply_rule: true,
        transaction_ids: item.transaction_ids,
      }))));
    }
    promises.push(...withoutSuggestion.map(item => api.skipQA(item.merchant_name, item.transaction_ids)));
    await Promise.all(promises);
    setAllDone(true);
  }

  const inactiveColor = isDark ? DARK.onSurfaceVariant : LIGHT.onSurfaceVariant;
  const quotaExhausted = usage && usage.pages_remaining === 0 && !usage.overage_enabled;
  const hasEntries = entries.length > 0;

  // ── All done ──
  if (allDone) {
    const doneCount = entries.filter(e => e.status === 'done').length;
    const txnCount = entries.filter(e => e.status === 'done').reduce((s, e) => s + (e.uncategorizedCount ?? 0), 0);
    return (
      <View className="flex-1 bg-ft-background dark:bg-ve-background items-center justify-center px-6" style={{ paddingTop: insets.top }}>
        <View className="w-20 h-20 rounded-2xl bg-emerald-50 dark:bg-ve-surface items-center justify-center mb-6">
          <MSIcon name="check_circle" size={48} color={isDark ? DARK.primary : '#10b981'} />
        </View>
        <Text className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface mb-2 text-center">
          {doneCount === 1 ? 'Statement processed!' : `${doneCount} statements processed!`}
        </Text>
        <Text className="text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-8 text-center">
          {txnCount === 0 ? 'All transactions already exist — no new data was imported.' : 'Your transactions are ready to explore.'}
        </Text>
        <View className="flex-row gap-3">
          <Pressable
            onPress={reset}
            className="px-6 py-2.5 border border-ft-outline-variant dark:border-ve-outline rounded-xl"
          >
            <Text className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface">Upload more</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace('/(app)/(tabs)/')}
            className="px-6 py-2.5 bg-ft-primary dark:bg-ve-primary-dim rounded-xl"
          >
            <Text className="text-sm font-semibold text-white dark:text-ve-background">View Dashboard</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── QA categorization flow ──
  if (qaItems.length > 0 && qaIndex < qaItems.length) {
    const item = qaItems[qaIndex] as QAItem;
    const suggestedNewCat = item.suggested_new_category_obj;
    return (
      <ScrollView
        className="flex-1 bg-ft-background dark:bg-ve-background"
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 40 }}
      >
        {/* QA header */}
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-row items-center gap-3">
            {qaIndex > 0 && (
              <Pressable
                onPress={async () => {
                  const prevItem = qaItems[qaIndex - 1];
                  if (prevItem?.transaction_ids?.length) {
                    await api.unanswerQA(prevItem.transaction_ids).catch(() => {});
                  }
                  setShowNewCatForm(false); setNewCatName(''); setQaIndex(qaIndex - 1);
                }}
                className="w-9 h-9 items-center justify-center rounded-xl border border-ft-outline-variant dark:border-ve-outline"
              >
                <MSIcon name="chevron_left" size={20} color={inactiveColor} />
              </Pressable>
            )}
            <View>
              <Text className="text-xl font-bold text-ft-on-surface dark:text-ve-on-surface">Categorize Merchants</Text>
              <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">{qaIndex + 1} of {qaItems.length}</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <View className="flex-row gap-1">
              {qaItems.map((_, i) => (
                <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === qaIndex ? (isDark ? DARK.primary : LIGHT.primary) : i < qaIndex ? (isDark ? DARK.outline : LIGHT.outlineVariant) : (isDark ? DARK.outline : LIGHT.outlineVariant) }} />
              ))}
            </View>
            <Pressable
              onPress={handleAutoAssignAI}
              className="px-2.5 py-1 rounded-lg bg-ft-primary dark:bg-ve-primary-dim"
            >
              <Text className="text-xs font-semibold text-white dark:text-ve-background">AI assign all</Text>
            </Pressable>
            <Pressable
              onPress={handleSkipAll}
              className="px-2.5 py-1 rounded-lg border border-ft-outline-variant dark:border-ve-outline"
            >
              <Text className="text-xs font-semibold text-ft-on-surface-variant dark:text-ve-on-surface-variant">Skip all</Text>
            </Pressable>
          </View>
        </View>

        {/* Merchant card */}
        <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-6 mb-4">
          <Text className="text-lg font-bold text-ft-on-surface dark:text-ve-on-surface mb-1">{item.merchant_name}</Text>
          <View className="flex-row gap-4 mb-5">
            <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant">
              {item.transaction_count} transaction{item.transaction_count > 1 ? 's' : ''}
            </Text>
            <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant">·</Text>
            <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant">{formatAED(item.total_amount)} total</Text>
          </View>

          {/* AI suggested new category */}
          {suggestedNewCat && (
            <View className="flex-row items-center gap-3 bg-violet-50 dark:bg-ve-surface-high border border-violet-100 dark:border-ve-outline rounded-xl px-4 py-3 mb-4">
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: suggestedNewCat.color, flexShrink: 0 }} />
              <View className="flex-1 min-w-0">
                <Text className="text-xs font-medium text-violet-700 dark:text-ve-primary">AI suggests a new category</Text>
                <Text className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface" numberOfLines={1}>{suggestedNewCat.name}</Text>
              </View>
              <Pressable
                onPress={() => handleAddAndUseNewCategory(suggestedNewCat)}
                disabled={creatingNewCat}
                style={{ backgroundColor: '#7c3aed', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, opacity: creatingNewCat ? 0.5 : 1, flexShrink: 0 }}
              >
                <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>{creatingNewCat ? 'Adding…' : 'Add & Use'}</Text>
              </Pressable>
            </View>
          )}

          {!suggestedNewCat && item.suggested_category_id && (
            <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-3">
              AI suggestion:{' '}
              <Text className="text-ft-primary dark:text-ve-primary font-medium">
                {categories.find(c => c.id === item.suggested_category_id)?.name ?? ''}
              </Text>
            </Text>
          )}

          {/* Category grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {categories.filter(c => c.name !== 'Uncategorized').map(cat => (
              <Pressable
                key={cat.id}
                onPress={() => setSelectedCat(cat.id)}
                style={{
                  width: '30%',
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: selectedCat === cat.id ? (isDark ? DARK.primary : LIGHT.primary) : (isDark ? DARK.outline : LIGHT.outlineVariant),
                  backgroundColor: selectedCat === cat.id ? (isDark ? DARK.surfaceHigh : LIGHT.surfaceLow) : 'transparent',
                  alignItems: 'center',
                }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: cat.color, marginBottom: 6 }} />
                <Text style={{ fontSize: 11, fontWeight: '500', color: isDark ? DARK.onSurface : LIGHT.onSurface, textAlign: 'center' }} numberOfLines={2}>{cat.name}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => { setShowNewCatForm(true); setSelectedCat(null); }}
              style={{
                width: '30%', padding: 12, borderRadius: 12, borderWidth: 2,
                borderStyle: 'dashed', borderColor: isDark ? DARK.outline : LIGHT.outlineVariant, alignItems: 'center',
              }}
            >
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: isDark ? DARK.surfaceHigh : LIGHT.surfaceLow, marginBottom: 6, alignItems: 'center', justifyContent: 'center' }}>
                <MSIcon name="add" size={14} color={inactiveColor} />
              </View>
              <Text style={{ fontSize: 11, color: inactiveColor }}>New</Text>
            </Pressable>
          </View>

          {/* New category form */}
          {showNewCatForm && (
            <View className="bg-ft-surface-low dark:bg-ve-surface-high rounded-xl p-4 mb-3 border border-ft-outline-variant dark:border-ve-outline gap-3">
              <Text className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant">New category</Text>
              <TextInput
                autoFocus
                value={newCatName}
                onChangeText={setNewCatName}
                placeholder="Category name"
                placeholderTextColor={inactiveColor}
                className="text-sm border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2 bg-ft-surface dark:bg-ve-surface text-ft-on-surface dark:text-ve-on-surface"
              />
              <View className="flex-row flex-wrap gap-1.5">
                {PRESET_COLORS.map(color => (
                  <Pressable
                    key={color}
                    onPress={() => setNewCatColor(color)}
                    style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: color, borderWidth: newCatColor === color ? 2.5 : 0, borderColor: '#171d17' }}
                  />
                ))}
              </View>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => setShowNewCatForm(false)}
                  style={{ flex: 1, borderWidth: 1, borderColor: isDark ? DARK.outline : LIGHT.outlineVariant, borderRadius: 10, paddingVertical: 8, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 12, color: inactiveColor }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleCreateNewCat}
                  disabled={!newCatName.trim() || creatingNewCat}
                  style={{ flex: 1, backgroundColor: isDark ? DARK.primaryDim : LIGHT.primary, borderRadius: 10, paddingVertical: 8, alignItems: 'center', opacity: !newCatName.trim() || creatingNewCat ? 0.5 : 1 }}
                >
                  <Text style={{ color: isDark ? DARK.background : 'white', fontSize: 12, fontWeight: '600' }}>
                    {creatingNewCat ? 'Creating…' : 'Create & select'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Apply rule toggle */}
          <View className="flex-row items-center gap-2.5 mb-5">
            <Switch
              value={applyRule}
              onValueChange={setApplyRule}
              trackColor={{ false: isDark ? DARK.outline : LIGHT.outlineVariant, true: isDark ? DARK.primary : LIGHT.primary }}
              thumbColor="white"
            />
            <Text className="text-sm text-ft-on-surface dark:text-ve-on-surface flex-1">
              Always categorize "{item.merchant_name}" as this
            </Text>
          </View>

          {/* Skip / Confirm */}
          <View className="flex-row gap-3">
            <Pressable
              onPress={handleQASkip}
              className="flex-1 py-3 border border-ft-outline-variant dark:border-ve-outline rounded-xl items-center"
            >
              <Text className="text-sm font-semibold text-ft-on-surface-variant dark:text-ve-on-surface-variant">Skip</Text>
            </Pressable>
            <Pressable
              onPress={handleQAAnswer}
              disabled={!selectedCat}
              className="flex-1 py-3 bg-ft-primary dark:bg-ve-primary-dim rounded-xl items-center"
              style={{ opacity: !selectedCat ? 0.5 : 1 }}
            >
              <Text className="text-sm font-semibold text-white dark:text-ve-background">Confirm ✓</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    );
  }

  // ── Overage modal ──
  const confirmOverage = async () => {
    if (!overagePending) return;
    const { asset, entryId } = overagePending;
    setOveragePending(null);
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;
    await processFile({ ...entry, asset }, true);
  };

  return (
    <ScrollView
      className="flex-1 bg-ft-background dark:bg-ve-background"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 40, paddingHorizontal: 16 }}
    >
      <Text className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface mb-1">Upload Statement</Text>
      <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-5">
        Upload PDF or image files of your bank statements.
      </Text>

      {/* Quota bar */}
      {usage && (
        <View className="mb-5 bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-4">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface">{usage.plan_label} plan</Text>
            <Text className={`text-sm font-bold ${usage.pages_remaining === 0 ? 'text-red-500 dark:text-ve-error' : 'text-ft-on-surface-variant dark:text-ve-on-surface-variant'}`}>
              {usage.pages_remaining} pages remaining
            </Text>
          </View>
          <ProgressBar
            pct={Math.min(100, (usage.pages_used / usage.pages_limit) * 100)}
            color={usage.pages_remaining === 0 ? '#ef4444' : usage.pages_used / usage.pages_limit > 0.8 ? '#f59e0b' : LIGHT.primary}
            height={6}
          />
          <View className="flex-row items-center justify-between mt-1.5">
            <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">
              {usage.pages_used} of {usage.pages_limit} used
            </Text>
            {usage.pages_remaining === 0 && (
              <Pressable onPress={() => router.push('/(app)/billing')}>
                <Text className="text-xs font-semibold text-ft-primary dark:text-ve-primary">Upgrade plan →</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Pick file area */}
      <View className="gap-3 mb-5">
        <Pressable
          onPress={pickFiles}
          disabled={!!quotaExhausted}
          style={({ pressed }) => ({ opacity: pressed || quotaExhausted ? 0.6 : 1 })}
          className="border-2 border-dashed border-ft-outline-variant dark:border-ve-outline rounded-2xl py-10 items-center gap-3"
        >
          {hasEntries ? (
            <>
              <MSIcon name="add_circle" size={28} color={isDark ? DARK.primary : LIGHT.primary} />
              <Text className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface">Add more files</Text>
            </>
          ) : (
            <>
              <View className="w-16 h-16 rounded-2xl bg-ft-surface-low dark:bg-ve-surface items-center justify-center">
                <MSIcon name="cloud_upload" size={36} color={inactiveColor} />
              </View>
              <Text className="text-base font-bold text-ft-on-surface dark:text-ve-on-surface">Drop or Browse Files</Text>
              <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant text-center px-8">
                PDF, JPG, PNG, HEIC — max 50MB
              </Text>
              <View className="px-5 py-2.5 bg-ft-primary dark:bg-ve-primary-dim rounded-xl">
                <Text className="text-white dark:text-ve-background text-sm font-semibold">Browse Files</Text>
              </View>
            </>
          )}
        </Pressable>
        <Pressable
          onPress={pickCamera}
          disabled={!!quotaExhausted}
          className="border border-ft-outline-variant dark:border-ve-outline rounded-xl py-3 flex-row items-center justify-center gap-2"
          style={({ pressed }) => ({ opacity: pressed || quotaExhausted ? 0.6 : 1 })}
        >
          <MSIcon name="camera_alt" size={18} color={inactiveColor} />
          <Text className="text-sm font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant">Take a photo instead</Text>
        </Pressable>
      </View>

      {/* Overage modal */}
      {overagePending && (
        <RNModal transparent animationType="slide" visible statusBarTranslucent onRequestClose={() => setOveragePending(null)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setOveragePending(null)} />
          <View style={{ backgroundColor: isDark ? DARK.surface : LIGHT.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, borderTopColor: isDark ? DARK.outline : LIGHT.outlineVariant }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: isDark ? DARK.onSurface : LIGHT.onSurface, marginBottom: 8 }}>Overage charge</Text>
            <Text style={{ fontSize: 14, color: inactiveColor, marginBottom: 20 }}>
              Processing this file uses{' '}
              <Text style={{ fontWeight: '600', color: isDark ? DARK.onSurface : LIGHT.onSurface }}>
                {overagePending.overage_pages} extra page{overagePending.overage_pages !== 1 ? 's' : ''}
              </Text>
              {' '}billed at{' '}
              <Text style={{ fontWeight: '600', color: isDark ? DARK.onSurface : LIGHT.onSurface }}>
                ${overagePending.overage_cost_usd.toFixed(2)}
              </Text>{' '}
              on your next invoice.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => { setOveragePending(null); updateEntry(overagePending.entryId, { status: 'error', error: 'Cancelled — page quota exceeded.' }); }}
                style={{ flex: 1, borderWidth: 1, borderColor: isDark ? DARK.outline : LIGHT.outlineVariant, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? DARK.onSurface : LIGHT.onSurface }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmOverage}
                style={{ flex: 1, backgroundColor: isDark ? DARK.primaryDim : LIGHT.primary, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? DARK.background : 'white' }}>Confirm & process</Text>
              </Pressable>
            </View>
          </View>
        </RNModal>
      )}

      {/* File list */}
      {entries.length > 0 && (
        <View className="gap-3 mb-4">
          {entries.map(entry => (
            <UploadFileCard
              key={entry.id}
              entry={entry}
              onRetry={entry.status === 'error' ? () => {
                updateEntry(entry.id, { status: 'queued', error: undefined, progress: undefined });
                processFile({ ...entry, status: 'queued', error: undefined, progress: undefined });
              } : undefined}
            />
          ))}
        </View>
      )}

      {/* Overlap warnings */}
      {overlapWarnings.length > 0 && (
        <View className="bg-amber-50 dark:bg-ve-surface border border-amber-200 dark:border-ve-outline rounded-2xl p-4 mb-4">
          <Text className="text-sm font-semibold text-amber-800 dark:text-ve-on-surface mb-1">Possible duplicate data</Text>
          {overlapWarnings.map((w, i) => (
            <Text key={i} className="text-xs text-amber-700 dark:text-ve-on-surface-variant">"{w.file}" overlaps existing statement for {w.period}</Text>
          ))}
          <Text className="text-xs text-amber-600 dark:text-ve-on-surface-variant mt-1">Duplicate transactions are skipped automatically.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function UploadFileCard({ entry, onRetry }: { entry: FileEntry; onRetry?: () => void }) {
  const { isDark } = useTheme();
  const inactiveColor = isDark ? DARK.onSurfaceVariant : LIGHT.onSurfaceVariant;
  const currentStepIndex = STEPS.indexOf(entry.progress?.step ?? '');

  return (
    <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-4">
      <View className="flex-row items-center gap-3 mb-3">
        {/* Status icon */}
        {entry.status === 'queued' && (
          <View className="w-9 h-9 rounded-xl bg-ft-surface-low dark:bg-ve-surface-high items-center justify-center">
            <MSIcon name="schedule" size={18} color={inactiveColor} />
          </View>
        )}
        {(entry.status === 'uploading' || entry.status === 'processing') && (
          <View className="w-9 h-9 rounded-xl bg-ft-surface-low dark:bg-ve-surface-high items-center justify-center">
            <ActivityIndicator size="small" color={isDark ? DARK.primary : LIGHT.primary} />
          </View>
        )}
        {entry.status === 'done' && (
          <View className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-ve-surface-high items-center justify-center">
            <MSIcon name="check" size={18} color={isDark ? DARK.primary : '#10b981'} />
          </View>
        )}
        {entry.status === 'error' && (
          <View className="w-9 h-9 rounded-xl bg-red-50 dark:bg-ve-surface-high items-center justify-center">
            <MSIcon name="warning" size={18} color={isDark ? DARK.error : '#ef4444'} />
          </View>
        )}
        <View className="flex-1 min-w-0">
          <Text className="font-semibold text-ft-on-surface dark:text-ve-on-surface text-sm" numberOfLines={1}>{entry.asset.name}</Text>
          <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">
            {entry.status === 'queued' && 'Waiting…'}
            {(entry.status === 'uploading' || entry.status === 'processing') && (entry.progress?.message ?? 'Processing…')}
            {entry.status === 'done' && 'Done'}
            {entry.status === 'error' && 'Upload failed'}
          </Text>
        </View>
        {entry.status === 'done' && <MSIcon name="check_circle" size={20} color={isDark ? DARK.primary : '#10b981'} />}
        {entry.status === 'error' && <MSIcon name="error" size={20} color={isDark ? DARK.error : '#ef4444'} />}
      </View>

      {(entry.status === 'uploading' || entry.status === 'processing') && (
        <>
          <ProgressBar pct={entry.progress?.pct ?? 5} height={6} className="mb-3" />
          <View className="flex-row gap-3">
            {STEPS.map((step, i) => {
              const isDone = i < currentStepIndex;
              const isActive = step === entry.progress?.step;
              return (
                <View key={step} className="flex-row items-center gap-1">
                  <Text style={{ fontSize: 10, color: isDone ? (isDark ? DARK.primary : LIGHT.primary) : isActive ? (isDark ? DARK.onSurface : LIGHT.onSurface) : inactiveColor, fontWeight: isActive ? '600' : '400' }}>
                    {isDone ? '✓' : isActive ? '○' : '○'}
                  </Text>
                  <Text style={{ fontSize: 10, color: isDone ? (isDark ? DARK.primary : LIGHT.primary) : isActive ? (isDark ? DARK.onSurface : LIGHT.onSurface) : inactiveColor, fontWeight: isActive ? '600' : '400' }}>
                    {step === 'ocr' ? 'OCR' : step.charAt(0).toUpperCase() + step.slice(1)}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {entry.status === 'error' && (
        <View className="mt-2 bg-red-50 dark:bg-ve-surface-high border border-red-100 dark:border-ve-error/30 px-3 py-2.5 rounded-lg flex-row items-start justify-between gap-3">
          <Text className="text-xs text-red-600 dark:text-ve-error flex-1">{entry.error ?? 'Something went wrong. Please try again.'}</Text>
          {onRetry && (
            <Pressable onPress={onRetry} className="flex-row items-center gap-1 shrink-0">
              <MSIcon name="refresh" size={14} color={isDark ? DARK.error : '#ef4444'} />
              <Text className="text-xs font-semibold text-red-600 dark:text-ve-error">Try again</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
