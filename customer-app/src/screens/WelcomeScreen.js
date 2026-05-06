// src/screens/WelcomeScreen.js
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS } from '../theme/colors';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <LinearGradient
      colors={['#0a0a0f', '#12121a', '#0d0d16']}
      style={styles.container}
    >
      {/* Background decorative elements */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Logo */}
        <Animated.View style={[styles.logoContainer, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient
            colors={['rgba(212,175,55,0.2)', 'rgba(212,175,55,0.05)']}
            style={styles.logoGlow}
          >
            <Text style={styles.logoIcon}>⬡</Text>
          </LinearGradient>
        </Animated.View>

        {/* Title */}
        <Text style={styles.title}>Kasaragod</Text>
        <Text style={styles.titleAccent}>Sarees</Text>
        <Text style={styles.subtitle}>Blockchain-Verified Authenticity</Text>

        {/* Feature badges */}
        <View style={styles.badges}>
          {['🔐 Tamper-Proof', '⛓️ On-Chain', '✅ Instant'].map((badge) => (
            <View key={badge} style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ))}
        </View>

        {/* Description */}
        <Text style={styles.description}>
          Verify the authenticity of your Kasaragod Saree using blockchain technology.
          Scan the QR code or enter your product ID to get started.
        </Text>

        {/* CTA Buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[COLORS.gold, COLORS.goldLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButtonGradient}
            >
              <Text style={styles.primaryButtonText}>Verify My Product</Text>
              <Ionicons name="arrow-forward" size={18} color="#0a0a0f" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>Create Account</Text>
          </TouchableOpacity>
        </View>

        {/* Trust indicators */}
        <View style={styles.trustRow}>
          <Ionicons name="shield-checkmark" size={14} color={COLORS.gold} />
          <Text style={styles.trustText}>Protected by Ethereum Smart Contracts</Text>
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  bgCircle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(212,175,55,0.04)',
    top: -80,
    right: -80,
  },
  bgCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(212,175,55,0.03)',
    bottom: -50,
    left: -50,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: SPACING.lg,
  },
  logoGlow: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  logoIcon: {
    fontSize: 48,
    color: COLORS.gold,
  },
  title: {
    fontSize: FONTS.sizes['3xl'],
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  titleAccent: {
    fontSize: FONTS.sizes['3xl'],
    fontWeight: '800',
    color: COLORS.gold,
    letterSpacing: -0.5,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.lg,
  },
  badges: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  badge: {
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  badgeText: {
    color: COLORS.gold,
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  description: {
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.md,
  },
  buttons: {
    width: '100%',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  primaryButton: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  primaryButtonText: {
    color: '#0a0a0f',
    fontSize: FONTS.sizes.lg,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.borderGold,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.05)',
  },
  secondaryButtonText: {
    color: COLORS.gold,
    fontSize: FONTS.sizes.base,
    fontWeight: '600',
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustText: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.xs,
  },
});
