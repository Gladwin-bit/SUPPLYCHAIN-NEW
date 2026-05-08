// src/screens/ProfileScreen.js
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, RADIUS, FONTS } from '../theme/colors';

const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconBox}>
      <Ionicons name={icon} size={18} color={COLORS.gold} />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  </View>
);

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const handleLogout = () => {
    setLogoutOpen(true);
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'C';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <LinearGradient colors={['#1a1508', '#0a0a0f']} style={styles.header}>
        <View style={styles.avatarContainer}>
          <LinearGradient
            colors={[COLORS.gold, COLORS.goldLight]}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </LinearGradient>
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark" size={10} color="#0a0a0f" />
          </View>
        </View>
        <Text style={styles.userName}>{user?.name || 'Customer'}</Text>
        <Text style={styles.userEmail}>{user?.email || ''}</Text>
        <View style={styles.rolePill}>
          <Ionicons name="person" size={12} color={COLORS.gold} />
          <Text style={styles.rolePillText}>Customer</Text>
        </View>
      </LinearGradient>

      {/* Account Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Information</Text>
        <View style={styles.card}>
          <InfoRow icon="person-outline" label="Full Name" value={user?.name} />
          <View style={styles.divider} />
          <InfoRow icon="mail-outline" label="Email Address" value={user?.email} />
          <View style={styles.divider} />
          <InfoRow icon="call-outline" label="Phone Number" value={user?.phone} />
          <View style={styles.divider} />
          <InfoRow icon="shield-checkmark-outline" label="Account Role" value="Customer (Verified)" />
        </View>
      </View>

      {/* App Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About This App</Text>
        <View style={styles.card}>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Blockchain</Text>
            <Text style={styles.aboutValue}>Sepolia Testnet</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Auth</Text>
            <Text style={styles.aboutValue}>JWT + MongoDB</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Project</Text>
            <Text style={styles.aboutValue}>Kasaragod Sarees</Text>
          </View>
        </View>
      </View>

      {/* Trust badges */}
      <View style={styles.trustSection}>
        {[
          { icon: 'shield-checkmark', text: 'Blockchain Verified' },
          { icon: 'lock-closed', text: 'Data Encrypted' },
          { icon: 'eye-off', text: 'Privacy Protected' },
        ].map(({ icon, text }) => (
          <View key={text} style={styles.trustBadge}>
            <Ionicons name={icon} size={16} color={COLORS.gold} />
            <Text style={styles.trustBadgeText}>{text}</Text>
          </View>
        ))}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        Kasaragod Sarees Supply Chain Verification{'\n'}Built with ♥ on Blockchain
      </Text>

      {/* Themed Sign Out Modal */}
      <Modal
        visible={logoutOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIcon}>
                <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Sign Out</Text>
                <Text style={styles.modalText}>Are you sure you want to sign out?</Text>
              </View>
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.modalSecondary} onPress={() => setLogoutOpen(false)} activeOpacity={0.85}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDanger}
                onPress={() => {
                  setLogoutOpen(false);
                  logout();
                }}
                activeOpacity={0.9}
              >
                <Text style={styles.modalDangerText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 40 },
  header: { padding: SPACING.lg, paddingTop: SPACING['2xl'], alignItems: 'center', gap: SPACING.sm },
  avatarContainer: { position: 'relative', marginBottom: SPACING.sm },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#0a0a0f' },
  verifiedBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.success, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.background,
  },
  userName: { fontSize: FONTS.sizes['2xl'], fontWeight: '800', color: COLORS.textPrimary },
  userEmail: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(212,175,55,0.1)', borderRadius: RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)',
  },
  rolePillText: { color: COLORS.gold, fontSize: FONTS.sizes.xs, fontWeight: '700' },
  section: { padding: SPACING.lg, paddingBottom: 0 },
  sectionTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.textSecondary, marginBottom: SPACING.sm, letterSpacing: 0.5 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.md },
  infoIconBox: {
    width: 36, height: 36, borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(212,175,55,0.1)', justifyContent: 'center', alignItems: 'center',
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontWeight: '600', marginBottom: 2 },
  infoValue: { fontSize: FONTS.sizes.base, color: COLORS.textPrimary, fontWeight: '600' },
  divider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.md },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md },
  aboutLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  aboutValue: { fontSize: FONTS.sizes.sm, color: COLORS.textPrimary, fontWeight: '600' },
  trustSection: { flexDirection: 'row', justifyContent: 'space-around', margin: SPACING.lg, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  trustBadge: { alignItems: 'center', gap: 4 },
  trustBadgeText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, marginHorizontal: SPACING.lg, padding: SPACING.md,
    backgroundColor: COLORS.errorBg, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  logoutText: { color: COLORS.error, fontSize: FONTS.sizes.base, fontWeight: '700' },
  footer: { textAlign: 'center', color: COLORS.textMuted, fontSize: FONTS.sizes.xs, marginTop: SPACING.lg, lineHeight: 20 },

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
    gap: SPACING.md,
  },
  modalHeader: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center' },
  modalIcon: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.errorBg,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: { color: COLORS.textPrimary, fontSize: FONTS.sizes.lg, fontWeight: '900' },
  modalText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, marginTop: 2, lineHeight: 20 },
  modalActionsRow: { flexDirection: 'row', gap: SPACING.sm },
  modalSecondary: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    paddingVertical: 12,
  },
  modalSecondaryText: { color: COLORS.textPrimary, fontWeight: '800', fontSize: FONTS.sizes.base },
  modalDanger: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    backgroundColor: 'rgba(239,68,68,0.18)',
    alignItems: 'center',
    paddingVertical: 12,
  },
  modalDangerText: { color: '#ffd7d7', fontWeight: '900', fontSize: FONTS.sizes.base },
});
