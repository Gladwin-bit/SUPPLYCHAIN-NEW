import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Linking, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { verifyAPI, certificateAPI } from '../utils/api';
import { COLORS, SPACING, RADIUS, FONTS } from '../theme/colors';

export default function MyProductsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [certificatePickerOpen, setCertificatePickerOpen] = useState(false);
  const [certificateUrls, setCertificateUrls] = useState({ product: '', manufacturer: '' });
  const [feedbackModal, setFeedbackModal] = useState({ visible: false, title: '', message: '' });

  const openFeedback = (title, message) => setFeedbackModal({ visible: true, title, message });
  const closeFeedback = () => setFeedbackModal({ visible: false, title: '', message: '' });

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      const response = await verifyAPI.myProducts(120);
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to load products');
      }
      setItems(response.products || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load claimed products');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  const openCertificate = async (productId) => {
    try {
      const certData = await certificateAPI.getByProduct(productId);
      const manufacturerUrl = certData?.manufacturer?.certificate?.url;
      const productUrl = certData?.productCertificate?.url;
      if (!productUrl && !manufacturerUrl) {
        openFeedback('No Certificate', 'No certificate URL found for this product.');
        return;
      }

      const openUrl = async (url) => {
        if (!url) return;
        const can = await Linking.canOpenURL(url);
        if (!can) throw new Error('Could not open certificate on this device.');
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

  const renderCard = (p) => (
    <View key={p.id} style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardName}>{p.name}</Text>
        <Text style={styles.cardId}>{p.formattedId || `#${p.id}`}</Text>
      </View>
      <Text style={styles.meta}>Claimed at: {p.claimLocation || 'Not specified'}</Text>
      <Text style={styles.meta}>Claimed on: {p.claimedAt || '—'}</Text>
      <Text style={styles.meta}>Claimed by: {p.ownerName || 'You'}</Text>
      <Text style={styles.meta}>Status: {p.state || '—'}</Text>

      <TouchableOpacity style={styles.btn} onPress={() => openCertificate(p.id)}>
        <Ionicons name="document-text-outline" size={16} color={COLORS.gold} />
        <Text style={styles.btnText}>View Certificates</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.gold} />}
    >
      <LinearGradient colors={['#1a1508', '#0a0a0f']} style={styles.header}>
        <Text style={styles.title}>My Claimed Products</Text>
        <Text style={styles.sub}>Products you have successfully verified and claimed</Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.gold} style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !items.length ? (
        <View style={styles.emptyBox}>
          <Ionicons name="cube-outline" size={28} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No claimed products yet</Text>
        </View>
      ) : (
        items.map(renderCard)
      )}

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 30 },
  header: { padding: SPACING.lg, paddingTop: SPACING['2xl'] },
  title: { color: COLORS.textPrimary, fontSize: FONTS.sizes['2xl'], fontWeight: '800' },
  sub: { color: COLORS.textSecondary, marginTop: 4 },
  card: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { color: COLORS.textPrimary, fontWeight: '700', flex: 1, marginRight: 8 },
  cardId: { color: COLORS.gold, fontWeight: '700' },
  meta: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm },
  btn: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.borderGold,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  btnText: { color: COLORS.gold, fontWeight: '700' },
  errorBox: {
    margin: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.errorBg,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  errorText: { color: COLORS.error },
  emptyBox: {
    margin: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: { color: COLORS.textMuted },
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
});
