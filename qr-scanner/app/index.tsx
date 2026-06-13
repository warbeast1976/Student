import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnimatedPressable } from '@/components/animated-pressable';
import { AppIcon } from '@/components/ui/app-icon';
import { BrandGradients, Radii, Shadows, Spacing } from '@/constants/design';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

type RoleOption = 'student' | 'teacher';

export default function LoginScreen() {
  const { user, login, isHydrating } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RoleOption>('student');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const colorScheme = useColorScheme() ?? 'light';
  const background = useThemeColor({}, 'background');
  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');
  const tint = useThemeColor({}, 'tint');

  useEffect(() => {
    if (!isHydrating && user) {
      router.replace('/(tabs)');
    }
  }, [isHydrating, user]);

  if (isHydrating) {
    return <SafeAreaView style={styles.safeArea} />;
  }

  const handleLogin = async () => {
    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setError(role === 'student' ? 'Please enter your student ID.' : 'Please enter your teacher email.');
      return;
    }

    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);

    try {
      await login({
        identifier: cleanIdentifier,
        password,
        roleHint: role,
      });
      router.replace('/(tabs)');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.bgDecorA} pointerEvents="none" />
        <View style={styles.bgDecorB} pointerEvents="none" />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <LinearGradient
            style={styles.brandStrip}
            colors={colorScheme === 'dark' ? [...BrandGradients.darkHero] : [...BrandGradients.lightHero]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <AppIcon name="dashboard" size={16} color="#CCFBF1" />
              </View>
              <View style={styles.brandTextBlock}>
                <ThemedText style={styles.brandKicker}>SCHOOL PORTAL</ThemedText>
                <ThemedText style={styles.brandTitle}>MLGCL Mobile</ThemedText>
                <ThemedText style={styles.brandSubtitle}>Attendance and announcements</ThemedText>
              </View>
            </View>
          </LinearGradient>

          <ThemedView style={[styles.authCard, Shadows.md, { backgroundColor: surface, borderColor: border }]}>
            <View style={styles.header}>
              <ThemedText type="title">Welcome back</ThemedText>
              <ThemedText style={[styles.subtitle, { color: muted }]}>
                Sign in with your school account to continue.
              </ThemedText>
            </View>

            <View style={[styles.roleRow, { backgroundColor: surfaceMuted, borderColor: border }]}>
              {(['student', 'teacher'] as const).map((option) => {
                const active = role === option;
                return (
                  <Pressable
                    key={option}
                    style={[styles.roleButton, active && [styles.roleButtonActive, { backgroundColor: surface }]]}
                    onPress={() => setRole(option)}>
                    <ThemedText
                      style={[
                        active ? styles.roleTextActive : styles.roleText,
                        active ? { color: tint } : { color: muted },
                      ]}>
                      {option === 'student' ? 'Student' : 'Teacher'}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.fieldGroup}>
              <ThemedText style={[styles.fieldLabel, { color: muted }]}>
                {role === 'student' ? 'Email or student number' : 'Teacher email'}
              </ThemedText>
              <TextInput
                style={[styles.input, { borderColor: border, backgroundColor: surface, color: text }]}
                placeholder={role === 'student' ? 'you@school.edu or 2026-0001' : 'teacher@school.edu'}
                placeholderTextColor={muted}
                value={identifier}
                autoCapitalize="none"
                keyboardType={role === 'student' ? 'default' : 'email-address'}
                onChangeText={(value) => {
                  setIdentifier(value);
                  if (error) setError('');
                }}
              />
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.passwordHeader}>
                <ThemedText style={[styles.fieldLabel, { color: muted }]}>Password</ThemedText>
                <Pressable onPress={() => setShowPassword((prev) => !prev)}>
                  <ThemedText style={[styles.passwordToggleText, { color: tint }]}>
                    {showPassword ? 'Hide' : 'Show'}
                  </ThemedText>
                </Pressable>
              </View>
              <TextInput
                style={[styles.input, { borderColor: border, backgroundColor: surface, color: text }]}
                placeholder="Enter your password"
                placeholderTextColor={muted}
                value={password}
                secureTextEntry={!showPassword}
                onChangeText={(value) => {
                  setPassword(value);
                  if (error) setError('');
                }}
              />
            </View>

            {!!error && <ThemedText style={styles.errorText}>{error}</ThemedText>}

            <AnimatedPressable
              style={[styles.loginButton, { backgroundColor: tint }]}
              onPress={handleLogin}
              disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.loginButtonText}>Sign in</ThemedText>
              )}
            </AnimatedPressable>

            <ThemedText style={[styles.helperText, { color: muted }]}>
              Use the same password as the web portal. Students can sign in with school email or student number.
            </ThemedText>
          </ThemedView>
          <View style={styles.footerInfo}>
            <ThemedText style={[styles.footerText, { color: muted }]}>Secure school access</ThemedText>
            <View style={styles.footerChips}>
              <View style={[styles.footerChip, { borderColor: border, backgroundColor: surface }]}>
                <AppIcon name="scan" size={14} color={tint} />
                <ThemedText style={[styles.footerChipText, { color: muted }]}>QR Check-in</ThemedText>
              </View>
              <View style={[styles.footerChip, { borderColor: border, backgroundColor: surface }]}>
                <AppIcon name="bell" size={14} color={tint} />
                <ThemedText style={[styles.footerChipText, { color: muted }]}>Class updates</ThemedText>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F6F8',
  },
  keyboardContainer: {
    flex: 1,
  },
  bgDecorA: {
    position: 'absolute',
    top: -80,
    right: -55,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: 'rgba(13, 148, 136, 0.13)',
  },
  bgDecorB: {
    position: 'absolute',
    bottom: -90,
    left: -70,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
    gap: Spacing.lg,
    flexGrow: 1,
  },
  brandStrip: {
    borderRadius: Radii.xl,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#0D9488',
    gap: 8,
    shadowColor: '#0C1222',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTextBlock: {
    gap: 1,
  },
  brandKicker: {
    color: '#DFFCF8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  brandSubtitle: {
    color: '#ECFEFF',
    fontSize: 12,
  },
  authCard: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#DCE3EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 16,
  },
  header: {
    gap: 6,
    marginBottom: 2,
  },
  subtitle: {
    color: '#5C6B7F',
    lineHeight: 20,
    fontSize: 13,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    padding: 5,
  },
  roleButton: {
    flex: 1,
    borderRadius: 11,
    paddingVertical: 10,
    alignItems: 'center',
  },
  roleButtonActive: {
    ...Shadows.xs,
  },
  roleText: {
    fontWeight: '600',
  },
  roleTextActive: {
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
  },
  fieldGroup: {
    gap: 7,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  passwordToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  errorText: {
    color: '#D22B2B',
    fontSize: 13,
  },
  helperText: {
    color: '#5C6B7F',
    fontSize: 12,
  },
  loginButton: {
    borderRadius: 12,
    backgroundColor: '#0D9488',
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#0D9488',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footerInfo: {
    marginTop: 'auto',
    gap: 10,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  footerChips: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  footerChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
