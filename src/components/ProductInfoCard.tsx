import { useEffect, useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';

interface ChipAccent {
  color: string;
  backgroundColor: string;
}

/** Bordered card that groups labelled product fields into one tidy block. */
export function InfoCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A single "LABEL / value" row inside an InfoCard. */
export function InfoRow({
  label,
  value,
  emptyLabel,
  numberOfLines,
  collapsibleLines,
  translatedValue,
}: {
  label: string;
  value: string;
  emptyLabel: string;
  numberOfLines?: number;
  /** When set, clamp to this many lines and show expand/collapse if longer. */
  collapsibleLines?: number;
  /**
   * Translation of `value` into the app language. When provided, a translate
   * button lets the user swap the text for this version.
   */
  translatedValue?: string | null;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const trimmed = value.trim();
  const translated = translatedValue?.trim() || '';
  const canTranslate = translated.length > 0 && translated !== trimmed;
  const [showTranslated, setShowTranslated] = useState(false);
  const shown = canTranslate && showTranslated ? translated : trimmed;
  const display = shown || emptyLabel;
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  // Reset only when the underlying product text changes, so toggling the
  // translation keeps whatever expand state the user chose.
  useEffect(() => {
    setShowTranslated(false);
    setExpanded(false);
  }, [trimmed, translated]);

  const clampLines =
    collapsibleLines != null && !expanded ? collapsibleLines : numberOfLines;
  const showToggle = collapsibleLines != null && overflows;

  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Pressable
          style={styles.labelPress}
          onPress={showToggle ? () => setExpanded((open) => !open) : undefined}
          disabled={!showToggle}
          accessibilityRole={showToggle ? 'button' : 'header'}
          accessibilityState={showToggle ? { expanded } : undefined}
          accessibilityLabel={label}
          hitSlop={8}
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {label}
          </Text>
        </Pressable>
        {canTranslate ? (
          <Pressable
            onPress={() => setShowTranslated((on) => !on)}
            accessibilityRole="button"
            accessibilityState={{ selected: showTranslated }}
            accessibilityLabel={
              showTranslated ? t('result.showOriginal') : t('result.translate')
            }
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name="translate"
              size={20}
              color={showTranslated ? colors.primary : colors.textSecondary}
            />
          </Pressable>
        ) : null}
        {showToggle ? (
          <Pressable
            onPress={() => setExpanded((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={label}
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>
      {collapsibleLines != null ? (
        // Stays mounted: the first layout pass can happen before the row has its
        // final width, so we let every relayout correct the line count.
        <Text
          style={[styles.value, styles.measureText]}
          accessible={false}
          onTextLayout={(e) => {
            const next = e.nativeEvent.lines.length > collapsibleLines;
            setOverflows((prev) => (prev === next ? prev : next));
          }}
        >
          {display}
        </Text>
      ) : null}
      <Text
        style={[
          styles.value,
          { color: trimmed ? colors.text : colors.textSecondary },
        ]}
        numberOfLines={clampLines}
        ellipsizeMode="tail"
        onPress={showToggle ? () => setExpanded((open) => !open) : undefined}
        suppressHighlighting
      >
        {display}
      </Text>
    </View>
  );
}

/** A row whose value is a set of coloured allergen chips. */
export function InfoChipRow({
  label,
  names,
  accent,
  emptyLabel,
}: {
  label: string;
  names: string[];
  accent: ChipAccent;
  emptyLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      {names.length > 0 ? (
        <View style={styles.chipWrap}>
          {names.map((name) => (
            <View
              key={name}
              style={[
                styles.chip,
                { borderColor: accent.color, backgroundColor: accent.backgroundColor },
              ]}
            >
              <Text style={[styles.chipText, { color: accent.color }]}>{name}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.value, { color: colors.textSecondary }]}>{emptyLabel}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 14,
  },
  row: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
  },
  measureText: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    right: 0,
    zIndex: -1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  labelPress: {
    flex: 1,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
