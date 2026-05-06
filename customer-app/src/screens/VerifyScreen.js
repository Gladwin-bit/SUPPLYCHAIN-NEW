// src/screens/VerifyScreen.js - Core customer verification screen
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, SPACING, RADIUS, FONTS } from '../theme/colors';
import { verifyProduct } from '../utils/blockchain';

const TABS = { CAMERA: 'camera', MANUAL: 'manual' };

const STATE_COLORS = {
  'Created': COLORS.textMuted,
  'Verified': COLORS.success,
  'In Transit': COLORS.info,
  'At Shop': COLORS.warning,
  'Sold': COLORS.gold,
};

export default function VerifyScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [activeTab, setActiveTab] = useState(TABS.MANUAL);
  const [scanning, setScanning] = useState(false);
  const [productId, setProductId] = useState('');
  const [secretCode, setSecretCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { verified, alreadyClaimed, product }
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const showResult = (data) => {
    setResult(data);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  };

  const reset = () => {
    setResult(null);
    setError('');
    setProductId('');
    setSecretCode('');
    setShowHistory(false);
    fadeAnim.setValue(0);
  };

  // Handle QR code scan from camera
  const handleBarCodeScanned = async ({ data }) => {
    if (loading) return;
    setScanning(false);

    let scannedId = null;
    try {
      const parsed = JSON.parse(data);
      scannedId = parsed.productId || parsed.id;
    } catch {
      try {
        const url = new URL(data);
        if (url.pathname.includes('/product/')) {
          const parts = url.pathname.split('/');
          scannedId = parts[parts.length - 1];
        }
      } catch {}
    }

    if (scannedId) {
      setProductId(String(scannedId));
      setActiveTab(TABS.MANUAL);
      setError('');
      Alert.alert('QR Scanned ✓', `Product ID: ${scannedId}\nNow enter your scratch-off code to verify.`);
    } else {
      Alert.alert('Invalid QR', 'This QR code is not a valid product code.');
    }
  };

  // Verify product on blockchain
  const handleVerify = async () => {
    if (!productId.trim()) { setError('Please enter a Product ID'); return; }
    if (!secretCode.trim()) { setError('Please enter your scratch-off code'); return; }
    setError('');
    setLoading(true);
    setResult(null);
    fadeAnim.setValue(0);
    try {
      const data = await verifyProduct(productId.trim(), secretCode.trim());
      showResult(data);
    } catch (err) {
      setError(err.message || 'Verification failed. Check the product ID and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Camera tab
  const renderCameraTab = () => {
    if (!permission) return <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />;
    if (!permission.granted) {
      return (
        <View style={styles.permissionBox}>
          <Ionicons name="camera-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionDesc}>Allow camera access to scan product QR codes</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Allow Camera</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.cameraContainer}>
        {scanning ? (
          <View style={{ flex: 1 }}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarCodeScanned}
            />
            <View style={styles.scanOverlay}>
              <View style={styles.scanFrame} />
              <Text style={styles.scanHint}>Point at product QR code</Text>
            </View>
            <TouchableOpacity style={styles.stopScanBtn} onPress={() => setScanning(false)}>
              <Text style={styles.stopScanText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.scanPrompt}>
            <View style={styles.scanIconBox}>
              <Ionicons name="qr-code-outline" size={64} color={COLORS.gold} />
            </View>
            <Text style={styles.scanPromptTitle}>Scan Product QR Code</Text>
            <Text style={styles.scanPromptDesc}>
              Point your camera at the QR code on the product packaging. The product ID will be auto-filled.
            </Text>
            <TouchableOpacity
              style={styles.startScanBtn}
              onPress={() => setScanning(true)}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[COLORS.gold, COLORS.goldLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.startScanGradient}
              >
                <Ionicons name="camera" size={20} color="#0a0a0f" />
                <Text style={styles.startScanText}>Open Camera</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveTab(TABS.MANUAL)}>
              <Text style={styles.switchTabHint}>Or enter product ID manually →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Manual entry tab
  const renderManualTab = () => (
    <View style={styles.manualForm}>
      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Product ID</Text>
        <Text style={styles.labelHint}>Found on label: #1, A1, B3…</Text>
        <View style={styles.inputRow}>
          <View style={[styles.inputWrapper, { flex: 1 }]}>
            <Ionicons name="barcode-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. #1, A1, B3"
              placeholderTextColor={COLORS.textMuted}
              value={productId}
              onChangeText={setProductId}
              autoCapitalize="characters"
              returnKeyType="next"
            />
          </View>
          <TouchableOpacity
            style={styles.scanIconBtn}
            onPress={() => setActiveTab(TABS.CAMERA)}
          >
            <Ionicons name="qr-code-outline" size={22} color={COLORS.gold} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Scratch-Off Verification Code</Text>
        <Text style={styles.labelHint}>Scratch the security panel on the label</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="key-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="e.g. 43D2-X90A-BCDE-1234"
            placeholderTextColor={COLORS.textMuted}
            value={secretCode}
            onChangeText={setSecretCode}
            autoCapitalize="characters"
            returnKeyType="done"
            onSubmitEditing={handleVerify}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.verifyBtn, (loading || !productId || !secretCode) && styles.verifyBtnDisabled]}
        onPress={handleVerify}
        disabled={loading || !productId || !secretCode}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={(loading || !productId || !secretCode) ? ['#333', '#222'] : [COLORS.gold, COLORS.goldLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.verifyBtnGradient}
        >
          {loading ? (
            <><ActivityIndicator size="small" color="#0a0a0f" /><Text style={styles.verifyBtnText}>Verifying...</Text></>
          ) : (
            <><Ionicons name="shield-checkmark" size={20} color="#0a0a0f" /><Text style={styles.verifyBtnText}>Verify Authenticity</Text></>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  // Result panel
  const renderResult = () => {
    if (!result) return null;
    const { verified, alreadyClaimed, product } = result;
    return (
      <Animated.View style={[styles.resultPanel, { opacity: fadeAnim }]}>
        {/* Status header */}
        <LinearGradient
          colors={verified ? ['rgba(34,197,94,0.15)', 'rgba(34,197,94,0.05)'] : ['rgba(239,68,68,0.15)', 'rgba(239,68,68,0.05)']}
          style={styles.resultHeader}
        >
          <Ionicons
            name={verified ? 'shield-checkmark' : 'close-circle'}
            size={48}
            color={verified ? COLORS.success : COLORS.error}
          />
          <Text style={[styles.resultTitle, { color: verified ? COLORS.success : COLORS.error }]}>
            {verified ? (alreadyClaimed ? 'AUTHENTIC — ALREADY CLAIMED' : 'AUTHENTICITY VERIFIED ✓') : 'VERIFICATION FAILED ✗'}
          </Text>
          <Text style={styles.resultSubtitle}>
            {verified
              ? alreadyClaimed
                ? `This genuine product was previously claimed by ${product.customerClaim?.customerName || 'another customer'}`
                : 'This is a genuine Kasaragod Saree. Scratch code matches blockchain record.'
              : 'The scratch code does not match this product\'s blockchain record. This may be counterfeit.'}
          </Text>
        </LinearGradient>

        {/* Product details */}
        <View style={styles.productDetails}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productId}>{product.formattedId}</Text>

          <View style={styles.detailGrid}>
            <DetailCard icon="location" label="Loom Location" value={product.loomLocation || '—'} />
            <DetailCard icon="calendar" label="Weave Date" value={product.weaveDate || '—'} />
            <DetailCard icon="pulse" label="Current Status" value={product.state} accent={STATE_COLORS[product.state]} />
            <DetailCard icon="people" label="Custodian" value={product.currentOwner ? `${product.currentOwner.slice(0, 6)}…${product.currentOwner.slice(-4)}` : '—'} />
          </View>

          {/* Certificate link */}
          {product.productCertificate && (
            <View style={styles.certRow}>
              <Ionicons name="document-text" size={16} color={COLORS.gold} />
              <Text style={styles.certText}>Quality Certificate: </Text>
              <Text style={styles.certHash} numberOfLines={1}>{product.productCertificate.slice(0, 20)}…</Text>
            </View>
          )}

          {/* History toggle */}
          {product.history?.length > 0 && (
            <TouchableOpacity
              style={styles.historyToggle}
              onPress={() => setShowHistory(!showHistory)}
            >
              <Text style={styles.historyToggleText}>
                {showHistory ? 'Hide' : 'Show'} Supply Chain History ({product.history.length} entries)
              </Text>
              <Ionicons name={showHistory ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.gold} />
            </TouchableOpacity>
          )}

          {showHistory && product.history?.map((entry, i) => (
            <View key={i} style={styles.historyEntry}>
              <View style={[styles.historyDot, i === 0 && styles.historyDotFirst]} />
              <View style={styles.historyEntryContent}>
                <Text style={styles.historyState}>{entry.state}</Text>
                <Text style={styles.historyTime}>{entry.timestamp}</Text>
                {entry.location ? <Text style={styles.historyLoc}>{entry.location}</Text> : null}
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.resetBtn} onPress={reset}>
          <Text style={styles.resetBtnText}>Verify Another Product</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <LinearGradient colors={['#1a1508', '#0a0a0f']} style={styles.pageHeader}>
        <View style={styles.headerBadge}>
          <Ionicons name="shield-checkmark" size={14} color={COLORS.gold} />
          <Text style={styles.headerBadgeText}>Trust Verification Protocol</Text>
        </View>
        <Text style={styles.pageTitle}>Verify Your Saree</Text>
        <Text style={styles.pageSubtitle}>Authenticate via blockchain-backed provenance</Text>
      </LinearGradient>

      {!result && (
        <>
          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === TABS.CAMERA && styles.tabActive]}
              onPress={() => { reset(); setActiveTab(TABS.CAMERA); }}
            >
              <Ionicons name="qr-code-outline" size={18} color={activeTab === TABS.CAMERA ? COLORS.gold : COLORS.textMuted} />
              <Text style={[styles.tabText, activeTab === TABS.CAMERA && styles.tabTextActive]}>Camera Scan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === TABS.MANUAL && styles.tabActive]}
              onPress={() => { reset(); setActiveTab(TABS.MANUAL); }}
            >
              <Ionicons name="create-outline" size={18} color={activeTab === TABS.MANUAL ? COLORS.gold : COLORS.textMuted} />
              <Text style={[styles.tabText, activeTab === TABS.MANUAL && styles.tabTextActive]}>Manual Entry</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabContent}>
            {activeTab === TABS.CAMERA ? renderCameraTab() : renderManualTab()}
          </View>
        </>
      )}

      {renderResult()}
    </ScrollView>
  );
}

const DetailCard = ({ icon, label, value, accent }) => (
  <View style={styles.detailCard}>
    <Ionicons name={`${icon}-outline`} size={14} color={accent || COLORS.textMuted} />
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={[styles.detailValue, accent && { color: accent }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 40 },
  pageHeader: { padding: SPACING.lg, paddingTop: SPACING['2xl'], alignItems: 'center' },
  headerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(212,175,55,0.1)', borderRadius: RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 4, marginBottom: SPACING.sm,
  },
  headerBadgeText: { color: COLORS.gold, fontSize: FONTS.sizes.xs, fontWeight: '700', letterSpacing: 1 },
  pageTitle: { fontSize: FONTS.sizes['2xl'], fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  pageSubtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  tabs: {
    flexDirection: 'row', margin: SPACING.lg,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: 4, borderWidth: 1, borderColor: COLORS.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 10, gap: 6,
    borderRadius: RADIUS.md,
  },
  tabActive: { backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: COLORS.borderGold },
  tabText: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm, fontWeight: '600' },
  tabTextActive: { color: COLORS.gold },
  tabContent: { marginHorizontal: SPACING.lg },
  // Camera
  cameraContainer: { height: 400, borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: COLORS.surface },
  camera: { flex: 1 },
  scanOverlay: { position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center' },
  scanFrame: {
    width: 220, height: 220, borderWidth: 2, borderColor: COLORS.gold,
    borderRadius: RADIUS.lg, backgroundColor: 'transparent',
  },
  scanHint: { color: COLORS.textPrimary, marginTop: SPACING.lg, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 8 },
  stopScanBtn: {
    position: 'absolute', bottom: SPACING.lg, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xl, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  stopScanText: { color: COLORS.textPrimary, fontWeight: '700' },
  scanPrompt: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg, gap: SPACING.md },
  scanIconBox: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(212,175,55,0.08)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.borderGold,
  },
  scanPromptTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.textPrimary },
  scanPromptDesc: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  startScanBtn: { width: '100%', borderRadius: RADIUS.md, overflow: 'hidden' },
  startScanGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, gap: SPACING.sm },
  startScanText: { color: '#0a0a0f', fontWeight: '800', fontSize: FONTS.sizes.lg },
  switchTabHint: { color: COLORS.gold, fontSize: FONTS.sizes.sm, marginTop: SPACING.sm },
  permissionBox: { padding: SPACING.xl, alignItems: 'center', gap: SPACING.md },
  permissionTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.textPrimary },
  permissionDesc: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center' },
  permissionBtn: {
    backgroundColor: COLORS.gold, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl, paddingVertical: 12,
  },
  permissionBtnText: { color: '#0a0a0f', fontWeight: '800', fontSize: FONTS.sizes.base },
  // Manual form
  manualForm: { gap: SPACING.md },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.errorBg, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: RADIUS.md, padding: SPACING.md,
  },
  errorText: { color: COLORS.error, fontSize: FONTS.sizes.sm, flex: 1 },
  inputGroup: { gap: 4 },
  label: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, fontWeight: '600' },
  labelHint: { color: COLORS.textMuted, fontSize: FONTS.sizes.xs, marginBottom: 4 },
  inputRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 52,
  },
  inputIcon: { marginRight: SPACING.sm },
  input: { flex: 1, color: COLORS.textPrimary, fontSize: FONTS.sizes.base },
  scanIconBtn: {
    width: 52, height: 52, backgroundColor: 'rgba(212,175,55,0.1)',
    borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.borderGold,
  },
  verifyBtn: { borderRadius: RADIUS.md, overflow: 'hidden', marginTop: SPACING.sm, shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6 },
  verifyBtnDisabled: { shadowOpacity: 0 },
  verifyBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 56, gap: SPACING.sm },
  verifyBtnText: { color: '#0a0a0f', fontSize: FONTS.sizes.lg, fontWeight: '800' },
  // Result
  resultPanel: { margin: SPACING.lg, borderRadius: RADIUS.xl, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  resultHeader: { padding: SPACING.lg, alignItems: 'center', gap: SPACING.sm },
  resultTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', textAlign: 'center' },
  resultSubtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  productDetails: { padding: SPACING.lg, gap: SPACING.md },
  productName: { fontSize: FONTS.sizes['2xl'], fontWeight: '800', color: COLORS.textPrimary },
  productId: { fontSize: FONTS.sizes.sm, color: COLORS.gold, fontWeight: '700', letterSpacing: 1 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  detailCard: {
    flex: 1, minWidth: '47%', backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md, padding: SPACING.md, gap: 4, borderWidth: 1, borderColor: COLORS.border,
  },
  detailLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontWeight: '600' },
  detailValue: { fontSize: FONTS.sizes.sm, color: COLORS.textPrimary, fontWeight: '700' },
  certRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(212,175,55,0.08)', padding: 10, borderRadius: RADIUS.sm },
  certText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  certHash: { fontSize: FONTS.sizes.sm, color: COLORS.gold, flex: 1 },
  historyToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  historyToggleText: { color: COLORS.gold, fontSize: FONTS.sizes.sm, fontWeight: '600' },
  historyEntry: { flexDirection: 'row', gap: SPACING.md, paddingVertical: SPACING.sm },
  historyDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.textMuted, marginTop: 4, flexShrink: 0 },
  historyDotFirst: { backgroundColor: COLORS.gold },
  historyEntryContent: { flex: 1 },
  historyState: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.textPrimary },
  historyTime: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  historyLoc: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2 },
  resetBtn: {
    margin: SPACING.lg, padding: SPACING.md, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.borderGold, alignItems: 'center',
  },
  resetBtnText: { color: COLORS.gold, fontSize: FONTS.sizes.base, fontWeight: '700' },
});
