import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { verifyAPI } from '../utils/api';
import { COLORS, SPACING, RADIUS, FONTS } from '../theme/colors';

const TABS = { CAMERA: 'camera', MANUAL: 'manual' };

export default function TraceJourneyScreen() {
  const [tab, setTab] = useState(TABS.MANUAL);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [productId, setProductId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [trace, setTrace] = useState(null);

  const truncate = (str, head = 6, tail = 4) => {
    const s = String(str || '');
    if (!s) return '—';
    if (s.length <= head + tail + 3) return s;
    return `${s.slice(0, head)}…${s.slice(-tail)}`;
  };

  const formatWhen = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  };

  const prettyLocation = (loc) => {
    if (!loc) return '';
    const s = String(loc);
    // web uses "lat,lng|City, State, Country"
    if (s.includes('|')) {
      const parts = s.split('|');
      return parts[1] || parts[0] || s;
    }
    return s;
  };

  const parseId = (value) => {
    const raw = String(value || '').trim();
    if (raw.toUpperCase().startsWith('KS-')) return parseInt(raw.slice(3), 10);
    if (raw.startsWith('#')) return parseInt(raw.slice(1), 10);
    return parseInt(raw, 10);
  };

  const handleTrace = async () => {
    if (!productId.trim()) {
      setError('Please enter Product ID');
      return;
    }
    setError('');
    setLoading(true);
    setTrace(null);
    try {
      const numericId = parseId(productId);
      if (!numericId || Number.isNaN(numericId)) throw new Error('Invalid product ID');
      const response = await verifyAPI.traceProduct(numericId);
      if (!response?.success) throw new Error(response?.message || 'Failed to trace product');
      setTrace(response.product);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to trace product');
    } finally {
      setLoading(false);
    }
  };

  const onScan = ({ data }) => {
    if (loading) return;
    setScanning(false);
    let scanned = null;
    try {
      const parsed = JSON.parse(data);
      scanned = parsed.productId || parsed.id;
    } catch {
      // Support URL QR format: ".../product/<id>?batch=..."
      try {
        const url = new URL(String(data));
        if (url?.pathname?.includes('/product/')) {
          const parts = url.pathname.split('/').filter(Boolean);
          scanned = parts[parts.length - 1];
        } else {
          scanned = data;
        }
      } catch {
        scanned = data;
      }
    }
    if (!scanned) {
      Alert.alert('Invalid QR', 'Could not read product ID from this QR.');
      return;
    }
    setProductId(String(scanned));
    setTab(TABS.MANUAL);
    setError('');
  };

  const HistoryRow = ({ item, index, total }) => {
    const isLast = index === total - 1;
    return (
      <View style={styles.timelineRow}>
        <View style={styles.timelineLeft}>
          <View style={[styles.timelineDot, index === 0 && styles.timelineDotActive]} />
          {!isLast ? <View style={styles.timelineLine} /> : null}
        </View>
        <View style={styles.timelineCard}>
          <View style={styles.timelineCardTop}>
            <Text style={styles.timelineState}>{item?.state || '—'}</Text>
            {!!item?.actor ? (
              <View style={styles.actorPill}>
                <Ionicons name="person-circle-outline" size={14} color={COLORS.textMuted} />
                <Text style={styles.actorText}>{truncate(item.actor, 8, 6)}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.timelineMetaRow}>
            <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.timelineMeta}>{formatWhen(item?.timestamp)}</Text>
          </View>
          {!!item?.location ? (
            <View style={styles.timelineMetaRow}>
              <Ionicons name="location-outline" size={12} color={COLORS.textMuted} />
              <Text style={styles.timelineMeta}>{prettyLocation(item.location)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Trace Product Journey</Text>
        <Text style={styles.sub}>Scan QR or enter product ID to view complete custody chain</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === TABS.CAMERA && styles.tabActive]} onPress={() => setTab(TABS.CAMERA)}>
          <Ionicons name="qr-code-outline" size={16} color={tab === TABS.CAMERA ? COLORS.gold : COLORS.textMuted} />
          <Text style={[styles.tabText, tab === TABS.CAMERA && styles.tabTextActive]}>Scan QR</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === TABS.MANUAL && styles.tabActive]} onPress={() => setTab(TABS.MANUAL)}>
          <Ionicons name="create-outline" size={16} color={tab === TABS.MANUAL ? COLORS.gold : COLORS.textMuted} />
          <Text style={[styles.tabText, tab === TABS.MANUAL && styles.tabTextActive]}>Manual</Text>
        </TouchableOpacity>
      </View>

      {tab === TABS.CAMERA ? (
        <View style={styles.cameraWrap}>
          {!permission ? (
            <ActivityIndicator color={COLORS.gold} />
          ) : !permission.granted ? (
            <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
              <Text style={styles.permissionBtnText}>Allow camera to scan QR</Text>
            </TouchableOpacity>
          ) : scanning ? (
            <View style={{ height: 300 }}>
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={onScan}
              />
              <TouchableOpacity style={styles.stopBtn} onPress={() => setScanning(false)}>
                <Text style={styles.stopBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.scanBtn} onPress={() => setScanning(true)}>
              <Ionicons name="camera-outline" size={18} color="#0a0a0f" />
              <Text style={styles.scanBtnText}>Open Camera</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.manualBox}>
          <View style={styles.inputWrap}>
            <Ionicons name="barcode-outline" size={16} color={COLORS.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Enter product ID (e.g. #11, KS-000011)"
              placeholderTextColor={COLORS.textMuted}
              value={productId}
              onChangeText={setProductId}
            />
          </View>
          <TouchableOpacity style={styles.traceBtn} onPress={handleTrace} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color="#0a0a0f" /> : <Ionicons name="git-network-outline" size={18} color="#0a0a0f" />}
            <Text style={styles.traceBtnText}>{loading ? 'Tracing...' : 'Trace Journey'}</Text>
          </TouchableOpacity>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      )}

      {trace && (
        <View style={styles.result}>
          {/* Asset summary board (matches web "asset-summary-card" intent) */}
          <View style={styles.assetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.assetBadge}>SAREE THREAD #{trace.id ?? '—'}</Text>
              <Text style={styles.productName}>{trace.name}</Text>
              <Text style={styles.productId}>{trace.formattedId}</Text>
            </View>
            <View style={styles.assetSeal}>
              <Ionicons name="shield-checkmark-outline" size={26} color={COLORS.gold} />
            </View>
          </View>

          <View style={styles.assetGrid}>
            <View style={styles.assetTile}>
              <Text style={styles.tileLabel}>Status</Text>
              <Text style={styles.tileValueGold}>{trace.state || '—'}</Text>
            </View>
            <View style={styles.assetTile}>
              <Text style={styles.tileLabel}>Loom Location</Text>
              <Text style={styles.tileValue}>{trace.loomLocation || '—'}</Text>
            </View>
            <View style={styles.assetTile}>
              <Text style={styles.tileLabel}>Weave Date</Text>
              <Text style={styles.tileValue}>{trace.weaveDate || '—'}</Text>
            </View>
            <View style={styles.assetTile}>
              <Text style={styles.tileLabel}>Current Owner</Text>
              <Text style={styles.tileValue}>{trace.currentOwner ? truncate(trace.currentOwner, 8, 6) : '—'}</Text>
            </View>
          </View>

          {trace.customerClaim?.isClaimed && (
            <View style={styles.claimBox}>
              <Text style={styles.claimTitle}>Already Claimed</Text>
              <Text style={styles.meta}>Owner: {trace.customerClaim.customerName || '—'}</Text>
              <Text style={styles.meta}>Location: {prettyLocation(trace.customerClaim.location) || 'Not specified'}</Text>
              <Text style={styles.meta}>Date: {formatWhen(trace.customerClaim.timestamp) || '—'}</Text>
            </View>
          )}

          <View style={styles.timelineHeader}>
            <View style={styles.liveDot} />
            <Text style={styles.historyTitle}>Geographic Audit Path</Text>
          </View>
          {(trace.history || []).length ? (
            (trace.history || []).map((h, idx) => (
              <HistoryRow key={`${h.timestamp || 't'}-${idx}`} item={h} index={idx} total={(trace.history || []).length} />
            ))
          ) : (
            <Text style={styles.meta}>No history records available.</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 28 },
  header: { padding: SPACING.lg, paddingTop: SPACING['2xl'] },
  title: { color: COLORS.textPrimary, fontSize: FONTS.sizes['2xl'], fontWeight: '800' },
  sub: { color: COLORS.textSecondary, marginTop: 4 },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: 4,
  },
  tab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: RADIUS.md },
  tabActive: { backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: COLORS.borderGold },
  tabText: { color: COLORS.textMuted, fontWeight: '600' },
  tabTextActive: { color: COLORS.gold },
  cameraWrap: {
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    padding: SPACING.md,
  },
  permissionBtn: { backgroundColor: COLORS.gold, paddingVertical: 12, borderRadius: RADIUS.md, alignItems: 'center' },
  permissionBtnText: { color: '#0a0a0f', fontWeight: '800' },
  scanBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingVertical: 12 },
  scanBtnText: { color: '#0a0a0f', fontWeight: '800' },
  stopBtn: { marginTop: 8, alignItems: 'center' },
  stopBtnText: { color: COLORS.textSecondary },
  manualBox: {
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: 10,
    height: 50,
  },
  input: { flex: 1, color: COLORS.textPrimary },
  traceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: RADIUS.md, backgroundColor: COLORS.gold, paddingVertical: 12 },
  traceBtnText: { color: '#0a0a0f', fontWeight: '800' },
  error: { color: COLORS.error, marginTop: 2 },
  result: {
    marginTop: SPACING.md,
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: 6,
  },
  assetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 10,
  },
  assetBadge: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.xs,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  assetSeal: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212,175,55,0.10)',
    borderWidth: 1,
    borderColor: COLORS.borderGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productName: { color: COLORS.textPrimary, fontWeight: '800', fontSize: FONTS.sizes.lg },
  productId: { color: COLORS.gold, fontWeight: '700', marginBottom: 4 },
  meta: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm },
  assetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 6,
  },
  assetTile: {
    width: '48%',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 10,
    gap: 3,
  },
  tileLabel: { color: COLORS.textMuted, fontSize: FONTS.sizes.xs, fontWeight: '700' },
  tileValue: { color: COLORS.textPrimary, fontSize: FONTS.sizes.sm, fontWeight: '700' },
  tileValueGold: { color: COLORS.gold, fontSize: FONTS.sizes.sm, fontWeight: '800' },
  claimBox: {
    marginTop: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderGold,
    backgroundColor: 'rgba(212,175,55,0.08)',
    padding: SPACING.sm,
    gap: 2,
  },
  claimTitle: { color: COLORS.gold, fontWeight: '800' },
  timelineHeader: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.gold, opacity: 0.9 },
  historyTitle: { color: COLORS.textPrimary, fontWeight: '800' },
  timelineRow: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  timelineLeft: { width: 14, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: COLORS.border },
  timelineDotActive: { backgroundColor: COLORS.gold, borderColor: COLORS.borderGold },
  timelineLine: { width: 2, flex: 1, backgroundColor: 'rgba(255,255,255,0.10)', marginTop: 6, borderRadius: 2 },
  timelineCard: {
    flex: 1,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 10,
    gap: 6,
  },
  timelineCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  timelineState: { color: COLORS.textPrimary, fontWeight: '800', flex: 1 },
  actorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  actorText: { color: COLORS.textMuted, fontWeight: '700', fontSize: FONTS.sizes.xs },
  timelineMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timelineMeta: { color: COLORS.textMuted, fontSize: FONTS.sizes.xs, flex: 1 },
});
