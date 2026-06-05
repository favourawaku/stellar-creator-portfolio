/**
 * LanguageSettingsScreen
 *
 * Issue 4 — "Support dynamic native explicit Internationalization
 * paradigms systematically"
 *
 * Features:
 *  - Lists all 5 supported locales with native name + RTL indicator
 *  - Animated selection with checkmark
 *  - Persists choice via AsyncStorage (loaded on next cold start)
 *  - Applies RTL layout direction immediately via I18nManager
 *  - Haptic feedback on selection
 *  - Fully accessible (roles, states, labels)
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  Colors,
  FontSize,
  FontWeight,
  Radius,
  Shadow,
  Spacing,
} from '../theme/tokens';
import { AppLocale, LOCALE_INFO, SUPPORTED_LOCALES } from '../i18n';
import { useI18n } from '../i18n/I18nProvider';

const LOCALE_STORAGE_KEY = '@stellar/locale';

// ─── Locale row ───────────────────────────────────────────────────────────────

interface LocaleRowProps {
  locale: AppLocale;
  isSelected: boolean;
  onSelect: (locale: AppLocale) => void;
}

function LocaleRow({ locale, isSelected, onSelect }: LocaleRowProps) {
  const info = LOCALE_INFO[locale];
  const scaleAnimRef = React.useRef(new Animated.Value(1));
  const scaleAnim = scaleAnimRef.current;

  const handlePress = useCallback(async () => {
    // Bounce animation
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 120, useNativeDriver: true }),
    ]).start();
    await Haptics.selectionAsync();
    onSelect(locale);
  }, [locale, onSelect, scaleAnim]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={handlePress}
        style={[styles.localeRow, isSelected && styles.localeRowSelected]}
        accessibilityRole="radio"
        accessibilityState={{ checked: isSelected }}
        accessibilityLabel={`${info.label} — ${info.nativeLabel}${info.rtl ? ' (RTL)' : ''}`}
      >
        {/* Flag emoji placeholder — replace with actual flag icons if desired */}
        <View style={styles.flagWrap}>
          <Text style={styles.flagEmoji}>
            {locale === 'en' ? '🇬🇧' :
             locale === 'es' ? '🇪🇸' :
             locale === 'fr' ? '🇫🇷' :
             locale === 'de' ? '🇩🇪' :
             locale === 'ar' ? '🇸🇦' : '🌐'}
          </Text>
        </View>

        <View style={styles.localeText}>
          <Text style={[styles.localeName, isSelected && styles.localeNameSelected]}>
            {info.label}
          </Text>
          <Text style={styles.localeNative}>{info.nativeLabel}</Text>
        </View>

        <View style={styles.localeRight}>
          {info.rtl && (
            <View style={styles.rtlBadge}>
              <Text style={styles.rtlBadgeText}>RTL</Text>
            </View>
          )}
          {isSelected && (
            <View style={styles.checkmark}>
              <Text style={styles.checkmarkText}>✓</Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

interface LanguageSettingsScreenProps {
  onBack?: () => void;
}

export function LanguageSettingsScreen({ onBack }: LanguageSettingsScreenProps) {
  const { t, locale, setLocale } = useI18n();
  const [pending, setPending]    = useState<AppLocale | null>(null);

  // Load persisted locale on mount
  useEffect(() => {
    AsyncStorage.getItem(LOCALE_STORAGE_KEY)
      .then((stored) => {
        if (stored && SUPPORTED_LOCALES.includes(stored as AppLocale)) {
          setLocale(stored as AppLocale);
        }
      })
      .catch(() => {/* ignore */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = useCallback(
    async (selected: AppLocale) => {
      if (selected === locale) return;
      setPending(selected);

      try {
        // Persist first so the choice survives a cold start
        await AsyncStorage.setItem(LOCALE_STORAGE_KEY, selected);
        setLocale(selected);

        const info = LOCALE_INFO[selected];
        const msg = t('settings.languageChanged', { language: info.nativeLabel });

        if (info.rtl) {
          Alert.alert(msg, t('settings.rtlNote'));
        }
      } catch {
        Alert.alert('', t('common.error'));
      } finally {
        setPending(null);
      }
    },
    [locale, setLocale, t],
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Text style={styles.backBtnText}>‹ {t('common.back')}</Text>
          </Pressable>
        )}
        <Text style={styles.screenTitle}>{t('settings.language')}</Text>
        <Text style={styles.screenSubtitle}>{t('settings.languageSubtitle')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Current language indicator */}
        <View style={styles.currentCard}>
          <Text style={styles.currentLabel}>{t('settings.currentLanguage', {
            language: LOCALE_INFO[locale].nativeLabel,
          })}</Text>
        </View>

        {/* Locale list */}
        <Text style={styles.sectionLabel}>{t('settings.selectLanguage')}</Text>

        {SUPPORTED_LOCALES.map((loc) => (
          <LocaleRow
            key={loc}
            locale={loc}
            isSelected={locale === loc}
            onSelect={handleSelect}
          />
        ))}

        {/* RTL note */}
        <View style={styles.noteCard}>
          <Text style={styles.noteText}>
            ℹ️  Arabic uses a right-to-left layout. A restart may be required for full effect on some devices.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    marginBottom: Spacing.xs,
  },
  backBtnText: {
    fontSize: FontSize.base,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  screenTitle: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  screenSubtitle: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  content: {
    padding: Spacing.base,
    paddingBottom: Spacing['3xl'],
  },
  currentCard: {
    backgroundColor: Colors.primaryLight + '22',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  currentLabel: {
    fontSize: FontSize.base,
    color: Colors.primaryDark,
    fontWeight: FontWeight.semibold,
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
  },
  localeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  localeRowSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight + '11',
  },
  flagWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  flagEmoji: {
    fontSize: 24,
  },
  localeText: {
    flex: 1,
  },
  localeName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  localeNameSelected: {
    color: Colors.primaryDark,
  },
  localeNative: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  localeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  rtlBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.warningLight,
  },
  rtlBadgeText: {
    fontSize: FontSize.xs,
    color: '#92400e',
    fontWeight: FontWeight.bold,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: Colors.textInverse,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  noteCard: {
    backgroundColor: Colors.infoLight,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.base,
  },
  noteText: {
    fontSize: FontSize.sm,
    color: '#1d4ed8',
    lineHeight: 20,
  },
});
