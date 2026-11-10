import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text } from 'react-native';

import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';
import type { ChefItem } from './chefBasket';

/** Chips added within this window pop in; older ones (e.g. on remount) don't. */
const FRESH_MS = 1500;

type Props = {
  item: ChefItem;
  onRemove: (key: string) => void;
  /** Stacking order; chips further left get higher values so they draw on top. */
  zIndex: number;
};

/**
 * Scanned-product chip in the chef panel. A freshly added product pops in
 * oversized with a highlight ring so the user clearly sees what was added.
 */
export function ChefChip({ item, onRemove, zIndex }: Props) {
  const { colors } = useTheme();
  const { tf } = useI18n();
  const fresh = Date.now() - item.addedAt < FRESH_MS;
  const scale = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(fresh ? 1 : 0)).current;

  useEffect(() => {
    if (!fresh) return;
    // Timing, not springs: grow once, then ease straight back to 1 with no
    // undershoot below normal size.
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.25,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(400),
        Animated.timing(scale, {
          toValue: 1,
          duration: 300,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(ring, {
        toValue: 0,
        duration: 1100,
        delay: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    // Only on mount: each chip animates once, when it is added.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        styles.chip,
        {
          borderColor: colors.border,
          backgroundColor: colors.background,
          zIndex,
          transform: [{ scale }],
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.ring, { borderColor: colors.primary, opacity: ring }]}
      />
      <Text style={[styles.text, { color: colors.text }]} numberOfLines={1}>
        {item.name}
      </Text>
      <Pressable
        onPress={() => onRemove(item.key)}
        accessibilityRole="button"
        accessibilityLabel={tf('chef.removeA11y', { name: item.name })}
        hitSlop={10}
      >
        <MaterialCommunityIcons name="close" size={16} color={colors.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 200,
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
  },
  ring: {
    ...StyleSheet.absoluteFill,
    margin: -1,
    borderWidth: 2.5,
    borderRadius: 999,
  },
  text: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
  },
});
