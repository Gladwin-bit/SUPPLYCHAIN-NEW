// src/screens/RegisterScreen.js
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, RADIUS, FONTS } from '../theme/colors';

// ✅ MOVED OUTSIDE component — prevents re-creation on every keystroke (keyboard fix)
const InputField = ({ label, icon, value, onChangeText, ...props }) => (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputWrapper}>
      <Ionicons name={icon} size={18} color={COLORS.textMuted} style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        placeholderTextColor={COLORS.textMuted}
        value={value}
        onChangeText={onChangeText}
        {...props}
      />
    </View>
  </View>
);

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    setError('');
    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const result = await register({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: 'customer',
      phone: phone.trim(),
    });

    if (!result.success) {
      setError(result.error || 'Registration failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <LinearGradient colors={['#0a0a0f', '#12121a']} style={StyleSheet.absoluteFill} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.logoIcon}>⬡</Text>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join as a verified customer</Text>
        </View>

        <View style={styles.roleBadge}>
          <Ionicons name="person" size={16} color={COLORS.gold} />
          <Text style={styles.roleBadgeText}>Customer Account</Text>
          <Text style={styles.roleBadgeDesc}>Verify and authenticate your sarees</Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={COLORS.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <InputField
            label="Full Name *"
            icon="person-outline"
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            autoCapitalize="words"
            returnKeyType="next"
          />

          <InputField
            label="Email Address *"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
          />

          <InputField
            label="Phone Number"
            icon="call-outline"
            value={phone}
            onChangeText={setPhone}
            placeholder="+91 XXXXX XXXXX"
            keyboardType="phone-pad"
            returnKeyType="next"
          />

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="At least 6 characters"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="next"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Repeat your password"
                placeholderTextColor={COLORS.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.registerButton, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={loading ? ['#555', '#444'] : [COLORS.gold, COLORS.goldLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Text>
              {!loading && <Ionicons name="arrow-forward" size={18} color="#0a0a0f" />}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flexGrow: 1, padding: SPACING.lg, paddingTop: SPACING['2xl'] },
  backButton: { width: 40, height: 40, justifyContent: 'center', marginBottom: SPACING.lg },
  header: { alignItems: 'center', marginBottom: SPACING.lg },
  logoIcon: { fontSize: 36, color: COLORS.gold, marginBottom: SPACING.sm },
  title: { fontSize: FONTS.sizes['2xl'], fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary },
  roleBadge: {
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    gap: 4,
  },
  roleBadgeText: { color: COLORS.gold, fontWeight: '700', fontSize: FONTS.sizes.base },
  roleBadgeDesc: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm },
  form: { gap: SPACING.md },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.errorBg, borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)', borderRadius: RADIUS.md, padding: SPACING.md,
  },
  errorText: { color: COLORS.error, fontSize: FONTS.sizes.sm, flex: 1 },
  inputGroup: { gap: SPACING.xs },
  label: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, fontWeight: '600', letterSpacing: 0.5 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated, borderWidth: 1,
    borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, height: 52,
  },
  inputIcon: { marginRight: SPACING.sm },
  input: { flex: 1, color: COLORS.textPrimary, fontSize: FONTS.sizes.base },
  eyeButton: { padding: SPACING.xs },
  registerButton: {
    borderRadius: RADIUS.md, overflow: 'hidden', marginTop: SPACING.sm,
    shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
  },
  buttonDisabled: { shadowOpacity: 0 },
  buttonGradient: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', height: 54, gap: SPACING.sm,
  },
  buttonText: { color: '#0a0a0f', fontSize: FONTS.sizes.lg, fontWeight: '800' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.sm },
  loginText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.base },
  loginLink: { color: COLORS.gold, fontSize: FONTS.sizes.base, fontWeight: '700' },
});
