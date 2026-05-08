// src/screens/HomeScreen.js
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, RADIUS, FONTS } from '../theme/colors';

const FeatureCard = ({ icon, title, description, onPress, accent }) => (
  <TouchableOpacity style={styles.featureCard} onPress={onPress} activeOpacity={0.8}>
    <View style={[styles.featureIconBox, { backgroundColor: accent + '15' }]}>
      <Ionicons name={icon} size={28} color={accent} />
    </View>
    <Text style={styles.featureTitle}>{title}</Text>
    <Text style={styles.featureDesc}>{description}</Text>
    <View style={styles.featureArrow}>
      <Ionicons name="arrow-forward" size={16} color={accent} />
    </View>
  </TouchableOpacity>
);

const StepCard = ({ number, title, description }) => (
  <View style={styles.stepCard}>
    <View style={styles.stepNumber}>
      <Text style={styles.stepNumberText}>{number}</Text>
    </View>
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepDesc}>{description}</Text>
    </View>
  </View>
);

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const { width } = useWindowDimensions();

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Banner */}
      <LinearGradient
        colors={['#1a1508', '#0a0a0f']}
        style={styles.headerBanner}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.userName}>{user?.name || 'Customer'} 👋</Text>
          </View>
          <View style={styles.logoMini}>
            <Text style={styles.logoMiniIcon}>⬡</Text>
          </View>
        </View>

        {/* Trust badges */}
        <View style={styles.trustBadges}>
          {['⛓️ Blockchain', '🔐 Secure', '✅ Verified'].map(b => (
            <View key={b} style={styles.trustBadge}>
              <Text style={styles.trustBadgeText}>{b}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* Hero verification card */}
      <TouchableOpacity onPress={() => navigation.navigate('Verify')} activeOpacity={0.9} style={styles.heroPressable}>
        <LinearGradient
          colors={['rgba(212,175,55,0.55)', 'rgba(212,175,55,0.10)', 'rgba(255,255,255,0.06)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroOuter}
        >
          <LinearGradient
            colors={['#121016', '#0a0a0f']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroInner}
          >
            <View style={styles.heroRow}>
              <View style={styles.heroIconWrap}>
                <LinearGradient
                  colors={['rgba(212,175,55,0.22)', 'rgba(212,175,55,0.10)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroIconBox}
                >
                  <Ionicons name="shield-checkmark" size={30} color={COLORS.gold} />
                </LinearGradient>
              </View>

              <View style={styles.heroTextCol}>
                <Text style={styles.heroCardLabel}>START VERIFICATION</Text>
                <Text style={styles.heroCardTitle}>Verify Your Saree</Text>
                <Text style={styles.heroCardDesc}>Scan QR or enter product ID</Text>
              </View>

              <View style={styles.heroCtaWrap}>
                <LinearGradient
                  colors={[COLORS.gold, COLORS.goldLight]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroCtaBtn}
                >
                  <Ionicons name="arrow-forward" size={18} color="#0a0a0f" />
                </LinearGradient>
              </View>
            </View>
          </LinearGradient>
        </LinearGradient>
      </TouchableOpacity>

      {/* How it works */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        <StepCard
          number="1"
          title="Scan or Enter Product ID"
          description="Use your camera to scan the QR code on the packaging, or type the product ID manually"
        />
        <StepCard
          number="2"
          title="Enter Scratch-Off Code"
          description="Scratch the security panel on the label to reveal your unique verification code"
        />
        <StepCard
          number="3"
          title="Get Verification Result"
          description="The blockchain instantly confirms authenticity and shows the complete supply chain history"
        />
      </View>

      {/* Features */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What You Can Verify</Text>
        <View style={styles.featuresGrid}>
          <FeatureCard
            icon="location"
            title="Origin"
            description="Loom location & weave date"
            accent="#22c55e"
            onPress={() => navigation.navigate('Verify')}
          />
          <FeatureCard
            icon="git-network"
            title="Chain"
            description="Full custody history"
            accent={COLORS.info}
            onPress={() => navigation.navigate('TraceJourney')}
          />
          <FeatureCard
            icon="document-text"
            title="Cert"
            description="Quality certificates"
            accent={COLORS.gold}
            onPress={() => navigation.navigate('Verify')}
          />
          <FeatureCard
            icon="person"
            title="My Products"
            description="Claimed items history"
            accent={COLORS.warning}
            onPress={() => navigation.navigate('MyProducts')}
          />
        </View>
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Ionicons name="information-circle" size={16} color={COLORS.textMuted} />
        <Text style={styles.disclaimerText}>
          Verification data is stored on the Polygon blockchain and cannot be altered. Each product has a unique cryptographic identity.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: SPACING.xl },
  headerBanner: {
    padding: SPACING.lg,
    paddingTop: SPACING['2xl'],
    marginBottom: SPACING.md,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  greeting: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary },
  userName: { fontSize: FONTS.sizes['2xl'], fontWeight: '800', color: COLORS.textPrimary },
  logoMini: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212,175,55,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderGold,
  },
  logoMiniIcon: { fontSize: 22, color: COLORS.gold },
  trustBadges: { flexDirection: 'row', gap: SPACING.sm },
  trustBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  trustBadgeText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.xs },
  heroPressable: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  heroOuter: {
    borderRadius: RADIUS.xl,
    padding: 1,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  heroInner: {
    borderRadius: RADIUS.xl,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIconWrap: { justifyContent: 'center' },
  heroIconBox: {
    width: 58,
    height: 58,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
  },
  heroTextCol: { flex: 1, gap: 2 },
  heroCardLabel: { fontSize: FONTS.sizes.xs, color: COLORS.gold, fontWeight: '800', letterSpacing: 2.2, opacity: 0.95 },
  heroCardTitle: { fontSize: 22, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: -0.2 },
  heroCardDesc: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 1, opacity: 0.95 },
  heroCtaWrap: { alignItems: 'flex-end', justifyContent: 'center' },
  heroCtaBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 12,
  },
  section: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(212,175,55,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderGold,
  },
  stepNumberText: { color: COLORS.gold, fontWeight: '800', fontSize: FONTS.sizes.base },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  stepDesc: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 20 },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  featureCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  featureIconBox: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  featureTitle: { fontSize: FONTS.sizes.base, fontWeight: '700', color: COLORS.textPrimary },
  featureDesc: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  featureArrow: { alignSelf: 'flex-end', marginTop: 4 },
  disclaimer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  disclaimerText: { flex: 1, color: COLORS.textMuted, fontSize: FONTS.sizes.xs, lineHeight: 18 },
});
