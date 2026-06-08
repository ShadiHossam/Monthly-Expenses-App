import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { formatAED, getMonthRange, getYearRange } from '../../lib/utils';
import { MSIcon } from '../../components/ui/MSIcon';
import { Spinner } from '../../components/ui/Spinner';
import { useTheme } from '../../context/ThemeContext';
import { LIGHT, DARK } from '../../constants/colors';

const PRESETS = [
  { label: 'This month', getRange: () => { const d = new Date(); return getMonthRange(d.getFullYear(), d.getMonth()+1); } },
  { label: 'Last month', getRange: () => { const d = new Date(); d.setMonth(d.getMonth()-1); return getMonthRange(d.getFullYear(), d.getMonth()+1); } },
  { label: 'This year', getRange: () => getYearRange(new Date().getFullYear()) },
];

export default function ReportsScreen() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState<any | null>(null);
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [savingReport, setSavingReport] = useState(false);
  const [saveReportName, setSaveReportName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const inactiveColor = isDark ? DARK.onSurfaceVariant : LIGHT.onSurfaceVariant;

  useEffect(() => { api.listSavedReports().then(setSavedReports).catch(() => {}); }, []);

  async function handleGenerate() {
    if (!from || !to) return;
    setGenerating(true);
    try {
      const res = await api.generateReport(from, to);
      setReportData((res as any).data ?? res);
    } catch (err: any) { Alert.alert('Error', err.message || 'Failed to generate report'); }
    finally { setGenerating(false); }
  }

  async function handleSave() {
    if (!saveReportName.trim() || !from || !to) return;
    setSavingReport(true);
    try {
      const saved = await api.saveReport(saveReportName.trim(), from, to);
      setSavedReports(prev => [saved, ...prev]);
      setShowSaveForm(false); setSaveReportName('');
    } catch {} finally { setSavingReport(false); }
  }

  async function handleDeleteSaved(id: number) {
    await api.deleteSavedReport(id);
    setSavedReports(prev => prev.filter((r: any) => r.id !== id));
  }

  async function handleLoadSaved(report: any) {
    setFrom(report.from_date); setTo(report.to_date);
  }

  const inputClass = 'border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2.5 text-sm bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface';

  return (
    <ScrollView className="flex-1 bg-ft-background dark:bg-ve-background" contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 100, paddingHorizontal: 16 }}>
      <Text className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface mb-1">Reports</Text>
      <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-5">Generate and save custom reports</Text>

      {/* Preset buttons */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
        <View className="flex-row gap-2">
          {PRESETS.map(preset => (
            <Pressable
              key={preset.label}
              onPress={() => { const r = preset.getRange(); setFrom(r.from); setTo(r.to); setReportData(null); }}
              className="px-3 py-1.5 border border-ft-outline-variant dark:border-ve-outline rounded-xl bg-ft-surface dark:bg-ve-surface"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text className="text-xs font-semibold text-ft-on-surface dark:text-ve-on-surface">{preset.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Custom range */}
      <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 mb-5 gap-3">
        <Text className="text-sm font-bold text-ft-on-surface dark:text-ve-on-surface">Custom Date Range</Text>
        <View className="flex-row gap-3">
          <View className="flex-1 gap-1.5">
            <Text className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant">From</Text>
            <TextInput className={inputClass} placeholder="YYYY-MM-DD" placeholderTextColor={inactiveColor} value={from} onChangeText={setFrom} />
          </View>
          <View className="flex-1 gap-1.5">
            <Text className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant">To</Text>
            <TextInput className={inputClass} placeholder="YYYY-MM-DD" placeholderTextColor={inactiveColor} value={to} onChangeText={setTo} />
          </View>
        </View>
        <Pressable
          onPress={handleGenerate}
          disabled={generating || !from || !to}
          className="py-2.5 bg-ft-primary dark:bg-ve-primary-dim rounded-xl items-center"
          style={{ opacity: generating || !from || !to ? 0.5 : 1 }}
        >
          {generating ? <ActivityIndicator size="small" color="white" /> : <Text className="text-sm font-semibold text-white dark:text-ve-background">Generate Report</Text>}
        </Pressable>
      </View>

      {/* Report result */}
      {reportData && (
        <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 mb-5">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="font-semibold text-ft-on-surface dark:text-ve-on-surface">Report: {from} → {to}</Text>
            <Pressable onPress={() => setShowSaveForm(v => !v)} className="flex-row items-center gap-1">
              <MSIcon name="add" size={16} color={isDark ? DARK.primary : LIGHT.primary} />
              <Text className="text-sm text-ft-primary dark:text-ve-primary">Save</Text>
            </Pressable>
          </View>
          {showSaveForm && (
            <View className="gap-2 mb-4">
              <TextInput className={inputClass} placeholder="Report name" placeholderTextColor={inactiveColor} value={saveReportName} onChangeText={setSaveReportName} />
              <Pressable onPress={handleSave} disabled={savingReport || !saveReportName.trim()} className="py-2 bg-ft-primary dark:bg-ve-primary-dim rounded-xl items-center" style={{ opacity: savingReport || !saveReportName.trim() ? 0.5 : 1 }}>
                {savingReport ? <ActivityIndicator size="small" color="white" /> : <Text className="text-sm font-semibold text-white dark:text-ve-background">Save Report</Text>}
              </Pressable>
            </View>
          )}
          <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant">Report generated successfully. Check Dashboard or Transactions for detailed data.</Text>
        </View>
      )}

      {/* Saved reports */}
      {savedReports.length > 0 && (
        <View>
          <Text className="font-semibold text-ft-on-surface dark:text-ve-on-surface mb-3">Saved Reports</Text>
          <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl overflow-hidden">
            {savedReports.map((r: any, i: number) => (
              <View key={r.id} className={`flex-row items-center justify-between px-5 py-4 ${i < savedReports.length-1 ? 'border-b border-ft-outline-variant dark:border-ve-outline' : ''}`}>
                <Pressable className="flex-1 min-w-0" onPress={() => handleLoadSaved(r)}>
                  <Text className="text-sm font-medium text-ft-on-surface dark:text-ve-on-surface" numberOfLines={1}>{r.name}</Text>
                  <Text className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">{r.from_date} → {r.to_date}</Text>
                </Pressable>
                <Pressable onPress={() => handleDeleteSaved(r.id)} hitSlop={8}>
                  <MSIcon name="delete" size={18} color={isDark ? DARK.error : '#ef4444'} />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
