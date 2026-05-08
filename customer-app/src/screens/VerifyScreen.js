// src/screens/VerifyScreen.js - Core customer verification screen
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Animated, Linking, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS, FONTS } from '../theme/colors';
import { verifyProduct } from '../utils/blockchain';
import { verifyAPI, reportsAPI, certificateAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { getCurrentLocationLabel } from '../utils/location';
import {
  connectMetaMask,
  sendClaimTransaction,
  disconnectWC,
  WC_SUPPORTED,
} from '../utils/walletConnect';

const TABS = { CAMERA: 'camera', MANUAL: 'manual' };

// Claim method states
const CLAIM_STATE = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
};

const STATE_COLORS = {
  'Created':   COLORS.textMuted,
  'InTransit': COLORS.info,
  'Verified':  COLORS.success,
  'Sold':      COLORS.gold,
  'Recalled':  COLORS.error,
  // legacy fallbacks
  'In Transit': COLORS.info,
  'At Shop':    COLORS.warning,
};

export default function VerifyScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
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

  // Claim state for BOTH methods
  const [metamaskClaim, setMetamaskClaim] = useState({ state: CLAIM_STATE.IDLE, txHash: null, error: null });
  const [backendClaim, setBackendClaim] = useState({ state: CLAIM_STATE.IDLE, txHash: null, error: null });
  const wcSessionRef = useRef(null); // Store active WC session
  const [claimLocation, setClaimLocation] = useState('Not specified');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportIssueType, setReportIssueType] = useState('other');
  const [reportDescription, setReportDescription] = useState('');
  const [certificatePickerOpen, setCertificatePickerOpen] = useState(false);
  const [certificateUrls, setCertificateUrls] = useState({ product: '', manufacturer: '' });
  const [feedbackModal, setFeedbackModal] = useState({ visible: false, title: '', message: '' });

  const openFeedback = (title, message) => setFeedbackModal({ visible: true, title, message });
  const closeFeedback = () => setFeedbackModal({ visible: false, title: '', message: '' });

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
    setMetamaskClaim({ state: CLAIM_STATE.IDLE, txHash: null, error: null });
    setBackendClaim({ state: CLAIM_STATE.IDLE, txHash: null, error: null });
    setClaimLocation('Not specified');
    setReportOpen(false);
    setReportBusy(false);
    setReportIssueType('other');
    setReportDescription('');
    fadeAnim.setValue(0);
    // Disconnect any active WC session
    if (wcSessionRef.current) {
      disconnectWC(wcSessionRef.current).catch(() => {});
      wcSessionRef.current = null;
    }
  };

  // ── METHOD A: WalletConnect → MetaMask deep link ───────────────────────────
  const handleClaimMetaMask = async () => {
    setMetamaskClaim({ state: CLAIM_STATE.LOADING, txHash: null, error: null });
    try {
      const detectedLocation = await getCurrentLocationLabel();
      setClaimLocation(detectedLocation);

      // Step 1: Connect to MetaMask (opens MetaMask app)
      Alert.alert(
        '🦊 Opening MetaMask',
        'MetaMask will open. Connect your wallet, then come back to confirm the transaction.',
        [{ text: 'OK' }]
      );

      const { session, address } = await connectMetaMask();
      wcSessionRef.current = session;

      // Step 2: Send the claim transaction (MetaMask will prompt for confirmation)
      Alert.alert(
        '📝 Sign Transaction',
        `MetaMask will show a transaction to claim Product ${productId}. Review and tap "Confirm".`,
        [{ text: 'OK' }]
      );

      const { txHash, explorerUrl } = await sendClaimTransaction(
        productId,
        secretCode,
        user?.name || 'Customer',
        detectedLocation,
        session,
        address
      );

      // Persist MetaMask claim details into backend DB for My Products listing.
      try {
        const numericId = result?.product?.id || parseInt(productId, 10);
        await verifyAPI.syncClaim(numericId);
      } catch {
        // Non-fatal for UX; claim is already on-chain.
      }

      setMetamaskClaim({ state: CLAIM_STATE.SUCCESS, txHash, explorerUrl, address });
    } catch (err) {
      const msg = err.message || 'MetaMask claim failed';
      setMetamaskClaim({ state: CLAIM_STATE.ERROR, txHash: null, error: msg });
      Alert.alert('MetaMask Error', msg);
    }
  };

  // ── METHOD B: Backend Relay (no wallet needed on phone) ───────────────────
  const handleClaimBackend = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to claim this product.');
      return;
    }
    setBackendClaim({ state: CLAIM_STATE.LOADING, txHash: null, error: null });
    try {
      const detectedLocation = await getCurrentLocationLabel();
      setClaimLocation(detectedLocation);

      // Use the numeric ID from the verified product (already parsed by backend)
      const numericId = result?.product?.id || parseInt(productId);
      const response = await verifyAPI.claim(numericId, secretCode.trim(), detectedLocation);

      try {
        await verifyAPI.syncClaim(numericId);
      } catch {
        // Non-fatal; backend claim endpoint already persists metadata.
      }

      setBackendClaim({
        state: CLAIM_STATE.SUCCESS,
        txHash: response.txHash,
        explorerUrl: response.explorerUrl,
        error: null,
      });
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || 'Backend claim failed';
      setBackendClaim({ state: CLAIM_STATE.ERROR, txHash: null, error: msg });
      Alert.alert('Backend Relay Error', msg);
    }
  };

  const openCertificates = async () => {
    try {
      const numericId = result?.product?.id || parseInt(productId, 10);
      const certData = await certificateAPI.getByProduct(numericId);

      const manufacturerUrl = certData?.manufacturer?.certificate?.url;
      const productUrl = certData?.productCertificate?.url;
      if (!productUrl && !manufacturerUrl) {
        openFeedback('No Certificate', 'No certificate URL found for this product.');
        return;
      }

      const openUrl = async (url) => {
        if (!url) return;
        const can = await Linking.canOpenURL(url);
        if (!can) throw new Error('Could not open certificate URL on this device.');
        await Linking.openURL(url);
      };

      if (productUrl && manufacturerUrl) {
        setCertificateUrls({ product: productUrl, manufacturer: manufacturerUrl });
        setCertificatePickerOpen(true);
        return;
      }

      await openUrl(productUrl || manufacturerUrl);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Failed to load certificate';
      openFeedback('Certificate Error', msg);
    }
  };

  const submitIssueReport = async () => {
    if (!result?.product?.id) {
      openFeedback('Missing Product', 'Verify a product before reporting an issue.');
      return;
    }
    if (!reportDescription.trim()) {
      openFeedback('Description Required', 'Please describe the issue.');
      return;
    }

    try {
      setReportBusy(true);
      const payload = {
        productId: result.product.id,
        reporterName: user?.name || 'Customer',
        reporterContact: user?.email || 'N/A',
        issueType: reportIssueType,
        description: reportDescription.trim(),
        productName: result?.product?.name || '',
        productState: result?.product?.state || '',
        claimedBy: result?.product?.customerClaim?.customerName || '',
        claimedAt: result?.product?.customerClaim?.timestamp || '',
      };
      const response = await reportsAPI.create(payload);
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to submit report');
      }
      setReportDescription('');
      setReportOpen(false);
      openFeedback('Report Submitted', 'Thanks for reporting. Our team will review this issue.');
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Failed to submit report';
      openFeedback('Report Failed', msg);
    } finally {
      setReportBusy(false);
    }
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
    // Show "already claimed" only when scratch code verification succeeded.
    const isClaimed = verified && (alreadyClaimed || product?.customerClaim?.isClaimed);
    const canShowProductDetails = verified || isClaimed;

    // Determine if either claim succeeded
    const anyClaimed =
      metamaskClaim.state === CLAIM_STATE.SUCCESS ||
      backendClaim.state === CLAIM_STATE.SUCCESS;

    return (
      <Animated.View style={[styles.resultPanel, { opacity: fadeAnim }]}>
        {/* Status header */}
        <LinearGradient
          colors={(verified || isClaimed) ? ['rgba(34,197,94,0.15)', 'rgba(34,197,94,0.05)'] : ['rgba(239,68,68,0.15)', 'rgba(239,68,68,0.05)']}
          style={styles.resultHeader}
        >
          <Ionicons
            name={(verified || isClaimed) ? 'shield-checkmark' : 'close-circle'}
            size={48}
            color={(verified || isClaimed) ? COLORS.success : COLORS.error}
          />
          <Text style={[styles.resultTitle, { color: (verified || isClaimed) ? COLORS.success : COLORS.error }]}>
            {(verified || isClaimed) ? (isClaimed || anyClaimed ? 'AUTHENTIC — CLAIMED ✓' : 'AUTHENTICITY VERIFIED ✓') : 'VERIFICATION FAILED ✗'}
          </Text>
          <Text style={styles.resultSubtitle}>
            {(verified || isClaimed)
              ? isClaimed
                ? `This genuine product was already claimed by ${product.customerClaim?.customerName || 'another customer'} at ${product.customerClaim?.location || 'an unknown location'}`
                : anyClaimed
                  ? 'You have successfully claimed this product on the blockchain!'
                  : 'This is a genuine Kasaragod Saree. Scratch code matches blockchain record.'
              : 'The scratch code does not match this product\'s blockchain record. This may be counterfeit.'}
          </Text>
        </LinearGradient>

        {canShowProductDetails ? (
          <View style={styles.productDetails}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productId}>{product.formattedId}</Text>

          <View style={styles.detailGrid}>
            <DetailCard icon="location" label="Loom Location" value={product.loomLocation || '—'} />
            <DetailCard icon="calendar" label="Weave Date" value={product.weaveDate || '—'} />
            <DetailCard icon="pulse" label="Current Status" value={product.state} accent={STATE_COLORS[product.state]} />
            <DetailCard icon="people" label="Custodian" value={product.currentOwner ? `${product.currentOwner.slice(0, 6)}…${product.currentOwner.slice(-4)}` : '—'} />
          </View>

          {(isClaimed || anyClaimed) && (
            <View style={styles.claimInfoBox}>
              <Text style={styles.claimInfoTitle}>Claim Information</Text>
              <Text style={styles.claimInfoLine}>
                Claimed by: {product.customerClaim?.customerName || 'another customer'}
              </Text>
              <Text style={styles.claimInfoLine}>
                Claim location: {product.customerClaim?.location || claimLocation || 'Not specified'}
              </Text>
              <Text style={styles.claimInfoLine}>
                Claimed at: {product.customerClaim?.timestamp || '—'}
              </Text>
            </View>
          )}

          {/* Certificate link */}
          {product.productCertificate && (
            <View style={styles.certRow}>
              <Ionicons name="document-text" size={16} color={COLORS.gold} />
              <Text style={styles.certText}>Quality Certificate: </Text>
              <Text style={styles.certHash} numberOfLines={1}>{product.productCertificate.slice(0, 20)}…</Text>
            </View>
          )}

          <View style={styles.resultActionsRow}>
            <TouchableOpacity style={styles.resultActionBtn} onPress={openCertificates}>
              <Ionicons name="document-attach-outline" size={16} color={COLORS.gold} />
              <Text style={styles.resultActionText}>View Certificates</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resultActionBtn} onPress={() => setReportOpen(v => !v)}>
              <Ionicons name="warning-outline" size={16} color={COLORS.gold} />
              <Text style={styles.resultActionText}>{reportOpen ? 'Hide Report Form' : 'Report Issue'}</Text>
            </TouchableOpacity>
          </View>

          {reportOpen && (
            <View style={styles.reportBox}>
              <Text style={styles.reportTitle}>Report a Product Issue</Text>
              <View style={styles.issueTypeRow}>
                {[
                  { id: 'possible_counterfeit', label: 'Counterfeit' },
                  { id: 'code_already_used', label: 'Code Used' },
                  { id: 'product_damaged', label: 'Damaged' },
                  { id: 'wrong_product', label: 'Wrong Item' },
                  { id: 'other', label: 'Other' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.issueChip, reportIssueType === opt.id && styles.issueChipActive]}
                    onPress={() => setReportIssueType(opt.id)}
                  >
                    <Text style={[styles.issueChipText, reportIssueType === opt.id && styles.issueChipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.inputWrapper}>
                <Ionicons name="create-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { minHeight: 64 }]}
                  placeholder="Describe the issue you faced..."
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  value={reportDescription}
                  onChangeText={setReportDescription}
                />
              </View>
              <TouchableOpacity
                style={[styles.claimBtn, styles.claimBtnBackend]}
                onPress={submitIssueReport}
                disabled={reportBusy}
              >
                {reportBusy
                  ? <ActivityIndicator size="small" color="#0a0a0f" />
                  : <Ionicons name="send" size={16} color="#0a0a0f" />}
                <Text style={[styles.claimBtnText, { color: '#0a0a0f' }]}>
                  {reportBusy ? 'Submitting...' : 'Submit Report'}
                </Text>
              </TouchableOpacity>
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
        ) : (
          <View style={styles.productDetails}>
            <Text style={styles.resultFailHint}>
              Product details are hidden because the scratch-off code is incorrect.
            </Text>
          </View>
        )}

        {/* ── CLAIM SECTION (only show if verified & not yet claimed) ── */}
        {verified && !alreadyClaimed && !anyClaimed && (
          <View style={styles.claimSection}>
            <View style={styles.claimHeader}>
              <Ionicons name="trophy" size={18} color={COLORS.gold} />
              <Text style={styles.claimTitle}>Claim This Product</Text>
            </View>
            <Text style={styles.claimSubtitle}>
              Record your ownership permanently on the Sepolia blockchain
            </Text>
            <Text style={styles.claimGeoText}>Auto location tag: {claimLocation}</Text>

            {/* ── Method A: MetaMask (WalletConnect) ── */}
            <View style={[styles.claimMethodBox, !WC_SUPPORTED && styles.claimMethodBoxDisabled]}>
              <View style={styles.claimMethodHeader}>
                <View style={styles.claimMethodLabelRow}>
                  <Text style={styles.claimMethodLabel}>🦊  Method A — Via MetaMask</Text>
                  {!WC_SUPPORTED && (
                    <View style={styles.expoGoBadge}>
                      <Text style={styles.expoGoBadgeText}>Expo Go ⚠️</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.claimMethodDesc}>
                  Opens MetaMask app · Your wallet address recorded on-chain
                </Text>
              </View>

              {!WC_SUPPORTED ? (
                /* ── Expo Go incompatibility notice ── */
                <View style={styles.wcUnsupportedBox}>
                  <Ionicons name="information-circle" size={20} color={COLORS.warning} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.wcUnsupportedTitle}>Not available in Expo Go</Text>
                    <Text style={styles.wcUnsupportedDesc}>
                      WalletConnect requires native crypto modules that Expo Go doesn't include.
                      Use Method B below to test now, or build the app with EAS to enable MetaMask.
                    </Text>
                    <TouchableOpacity
                      onPress={() => Alert.alert(
                        'How to enable MetaMask',
                        'Run this command to create a testable APK:\n\nnpx eas build --profile preview --platform android\n\nThen install the APK on your phone and MetaMask will work.',
                        [{ text: 'Got it' }]
                      )}
                    >
                      <Text style={styles.wcLearnMore}>How to enable this →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : metamaskClaim.state === CLAIM_STATE.SUCCESS ? (
                <View style={styles.claimSuccessBox}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                  <Text style={styles.claimSuccessText}>Claimed via MetaMask!</Text>
                  <TouchableOpacity onPress={() => Linking.openURL(metamaskClaim.explorerUrl)}>
                    <Text style={styles.txHashLink}>View on Etherscan →</Text>
                  </TouchableOpacity>
                </View>
              ) : metamaskClaim.state === CLAIM_STATE.ERROR ? (
                <View style={styles.claimErrorBox}>
                  <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                  <Text style={styles.claimErrorText}>{metamaskClaim.error}</Text>
                  <TouchableOpacity onPress={handleClaimMetaMask}>
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.claimBtn, styles.claimBtnMetamask]}
                  onPress={handleClaimMetaMask}
                  disabled={metamaskClaim.state === CLAIM_STATE.LOADING}
                  activeOpacity={0.85}
                >
                  {metamaskClaim.state === CLAIM_STATE.LOADING ? (
                    <>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.claimBtnText}>Connecting to MetaMask...</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.claimBtnIcon}>🦊</Text>
                      <Text style={styles.claimBtnText}>Claim via MetaMask</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* ── Method B: Backend Relay ── */}
            <View style={styles.claimMethodBox}>
              <View style={styles.claimMethodHeader}>
                <Text style={styles.claimMethodLabel}>⚡  Method B — Via Backend Relay</Text>
                <Text style={styles.claimMethodDesc}>
                  No wallet needed · Backend signs · Your name recorded on-chain
                </Text>
              </View>

              {backendClaim.state === CLAIM_STATE.SUCCESS ? (
                <View style={styles.claimSuccessBox}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                  <Text style={styles.claimSuccessText}>Claimed via Backend!</Text>
                  <TouchableOpacity onPress={() => Linking.openURL(backendClaim.explorerUrl)}>
                    <Text style={styles.txHashLink}>View on Etherscan →</Text>
                  </TouchableOpacity>
                </View>
              ) : backendClaim.state === CLAIM_STATE.ERROR ? (
                <View style={styles.claimErrorBox}>
                  <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                  <Text style={styles.claimErrorText}>{backendClaim.error}</Text>
                  <TouchableOpacity onPress={handleClaimBackend}>
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.claimBtn, styles.claimBtnBackend]}
                  onPress={handleClaimBackend}
                  disabled={backendClaim.state === CLAIM_STATE.LOADING}
                  activeOpacity={0.85}
                >
                  {backendClaim.state === CLAIM_STATE.LOADING ? (
                    <>
                      <ActivityIndicator size="small" color="#0a0a0f" />
                      <Text style={[styles.claimBtnText, { color: '#0a0a0f' }]}>Submitting to blockchain...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="flash" size={18} color="#0a0a0f" />
                      <Text style={[styles.claimBtnText, { color: '#0a0a0f' }]}>Claim via Backend</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

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
        <TouchableOpacity
          style={styles.traceShortcutBtn}
          onPress={() => navigation.navigate('TraceJourney')}
          activeOpacity={0.85}
        >
          <Ionicons name="git-network-outline" size={16} color={COLORS.gold} />
          <Text style={styles.traceShortcutText}>Trace Journey</Text>
        </TouchableOpacity>
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

      <Modal
        visible={certificatePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCertificatePickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>View Certificates</Text>
            <Text style={styles.modalText}>Choose which certificate to open.</Text>

            <TouchableOpacity
              style={styles.modalAction}
              onPress={async () => {
                setCertificatePickerOpen(false);
                try {
                  const can = await Linking.canOpenURL(certificateUrls.product);
                  if (!can) throw new Error('Could not open certificate URL on this device.');
                  await Linking.openURL(certificateUrls.product);
                } catch (e) {
                  openFeedback('Certificate Error', e.message);
                }
              }}
            >
              <Ionicons name="document-text-outline" size={16} color={COLORS.gold} />
              <Text style={styles.modalActionText}>Product Certificate</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalAction}
              onPress={async () => {
                setCertificatePickerOpen(false);
                try {
                  const can = await Linking.canOpenURL(certificateUrls.manufacturer);
                  if (!can) throw new Error('Could not open certificate URL on this device.');
                  await Linking.openURL(certificateUrls.manufacturer);
                } catch (e) {
                  openFeedback('Certificate Error', e.message);
                }
              }}
            >
              <Ionicons name="business-outline" size={16} color={COLORS.gold} />
              <Text style={styles.modalActionText}>Manufacturer Certificate</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCancel} onPress={() => setCertificatePickerOpen(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={feedbackModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closeFeedback}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{feedbackModal.title}</Text>
            <Text style={styles.modalText}>{feedbackModal.message}</Text>
            <TouchableOpacity style={styles.modalPrimary} onPress={closeFeedback}>
              <Text style={styles.modalPrimaryText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  traceShortcutBtn: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.borderGold,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  traceShortcutText: {
    color: COLORS.gold,
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },
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
  resultFailHint: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,4,10,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderGold,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  modalTitle: { color: COLORS.textPrimary, fontSize: FONTS.sizes.lg, fontWeight: '800' },
  modalText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, lineHeight: 20 },
  modalAction: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: COLORS.borderGold,
    borderRadius: RADIUS.md,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  modalActionText: { color: COLORS.gold, fontWeight: '700' },
  modalCancel: { marginTop: SPACING.xs, alignSelf: 'center', padding: 8 },
  modalCancelText: { color: COLORS.textMuted, fontWeight: '700' },
  modalPrimary: {
    marginTop: SPACING.xs,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    paddingVertical: 12,
  },
  modalPrimaryText: { color: '#0a0a0f', fontWeight: '800', fontSize: FONTS.sizes.base },
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
  resultActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  resultActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderGold,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  resultActionText: { color: COLORS.gold, fontSize: FONTS.sizes.xs, fontWeight: '700' },
  reportBox: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  reportTitle: { color: COLORS.textPrimary, fontWeight: '700' },
  claimInfoBox: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
    padding: SPACING.md,
    gap: 4,
  },
  claimInfoTitle: {
    color: COLORS.gold,
    fontSize: FONTS.sizes.sm,
    fontWeight: '800',
    marginBottom: 2,
  },
  claimInfoLine: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
  },
  issueTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  issueChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  issueChipActive: { borderColor: COLORS.borderGold, backgroundColor: 'rgba(212,175,55,0.12)' },
  issueChipText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.xs, fontWeight: '600' },
  issueChipTextActive: { color: COLORS.gold },
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

  // ── Claim section ───────────────────────────────────────────────────────────
  claimSection: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  claimHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
  },
  claimTitle: {
    fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.textPrimary,
  },
  claimSubtitle: {
    fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.xs,
  },
  claimGeoText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
  },
  claimMethodBox: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  claimMethodHeader: { gap: 2 },
  claimMethodLabel: {
    fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.textPrimary,
  },
  claimMethodDesc: {
    fontSize: FONTS.sizes.xs, color: COLORS.textMuted,
  },
  claimBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: RADIUS.md, height: 50, gap: SPACING.sm,
  },
  claimBtnMetamask: {
    backgroundColor: '#f6851b', // MetaMask orange
  },
  claimBtnBackend: {
    backgroundColor: COLORS.gold,
  },
  claimBtnIcon: { fontSize: 18 },
  claimBtnText: {
    color: '#fff', fontWeight: '800', fontSize: FONTS.sizes.base,
  },
  claimSuccessBox: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: RADIUS.md,
    padding: SPACING.md, flexWrap: 'wrap',
  },
  claimSuccessText: {
    color: COLORS.success, fontWeight: '700', fontSize: FONTS.sizes.sm,
  },
  txHashLink: {
    color: COLORS.gold, fontSize: FONTS.sizes.xs, fontWeight: '700',
    textDecorationLine: 'underline',
  },
  claimErrorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    backgroundColor: COLORS.errorBg, borderRadius: RADIUS.md,
    padding: SPACING.md, flexWrap: 'wrap',
  },
  claimErrorText: {
    color: COLORS.error, fontSize: FONTS.sizes.xs, flex: 1,
  },
  retryText: {
    color: COLORS.gold, fontSize: FONTS.sizes.xs, fontWeight: '700',
    textDecorationLine: 'underline', marginTop: 2,
  },

  // ── Expo Go / WalletConnect unavailable styles ───────────────────────────
  claimMethodBoxDisabled: {
    opacity: 0.75,
    borderColor: 'rgba(255,165,0,0.2)',
    borderStyle: 'dashed',
  },
  claimMethodLabelRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: SPACING.sm, flexWrap: 'wrap',
  },
  expoGoBadge: {
    backgroundColor: 'rgba(255,165,0,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,165,0,0.4)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  expoGoBadgeText: {
    color: COLORS.warning || '#f59e0b',
    fontSize: 10, fontWeight: '700',
  },
  wcUnsupportedBox: {
    flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start',
    backgroundColor: 'rgba(255,165,0,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,165,0,0.2)',
    borderRadius: RADIUS.md, padding: SPACING.md,
  },
  wcUnsupportedTitle: {
    color: COLORS.warning || '#f59e0b',
    fontSize: FONTS.sizes.sm, fontWeight: '700', marginBottom: 4,
  },
  wcUnsupportedDesc: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.xs, lineHeight: 16,
  },
  wcLearnMore: {
    color: COLORS.gold, fontSize: FONTS.sizes.xs,
    fontWeight: '700', marginTop: 6,
    textDecorationLine: 'underline',
  },
});
