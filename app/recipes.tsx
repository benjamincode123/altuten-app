import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAllergenPrefs } from '../src/allergens/AllergenPrefsContext';
import { allergenLabelMatches } from '../src/allergens/allergenPrefs';
import { getAuthToken } from '../src/auth/session';
import { CHEF_MIN_ITEMS, useChefItems } from '../src/chef/chefBasket';
import { AllergenBadge } from '../src/components/AllergenBadge';
import { AllergnomShelfLoader } from '../src/components/AllergnomShelfLoader';
import { ErrorText } from '../src/components/ErrorText';
import {
  fetchRecipeSuggestions,
  type RecipeSuggestion,
  type RecipeSuggestionResponse,
} from '../src/data/recipesApi';
import { AppError } from '../src/errors/appError';
import { userFacingError } from '../src/errors/userFacingError';
import { useI18n } from '../src/i18n/I18nContext';
import { useReliableBackHeader } from '../src/navigation/useReliableBackHeader';
import { useTheme } from '../src/theme/ThemeContext';

const CHEF_IMAGE = require('../assets/allergnom/chef.png');
const RECIPE_LIMIT = 40;
/** "You have" chips before collapsing into "+N". */
const HAVE_PREVIEW = 10;

export default function RecipesScreen() {
  const { colors } = useTheme();
  const { t, tf, allergenName } = useI18n();
  const { selected: avoidAllergens } = useAllergenPrefs();
  const items = useChefItems();

  const [data, setData] = useState<RecipeSuggestionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [safeOnly, setSafeOnly] = useState(false);
  const [showAllHave, setShowAllHave] = useState(false);
  const requestIdRef = useRef(0);

  useReliableBackHeader({ title: t('chef.recipesTitle') });

  // The basket store only swaps `items` when it changes, so this re-queries on edits.
  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (items.length < CHEF_MIN_ITEMS) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    const token = getAuthToken();
    setLoading(true);
    setError(null);
    try {
      if (!token) throw new AppError('unauthorized');
      const result = await fetchRecipeSuggestions(token, {
        products: items.map((i) => ({ catalog: i.catalog, id: i.id })),
        limit: RECIPE_LIMIT,
      });
      if (requestId !== requestIdRef.current) return;
      setData(result);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(userFacingError(err, t, 'generic'));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [items, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const avoidedIn = useCallback(
    (recipe: RecipeSuggestion) =>
      recipe.allergens.filter((a) => avoidAllergens.some((s) => allergenLabelMatches(s, a))),
    [avoidAllergens]
  );

  const recipes = useMemo(() => {
    const all = data?.recipes ?? [];
    return safeOnly ? all.filter((r) => avoidedIn(r).length === 0) : all;
  }, [data, safeOnly, avoidedIn]);

  const openRecipe = (recipe: RecipeSuggestion) => {
    if (!recipe.url) return;
    void Linking.openURL(recipe.url).catch(() => undefined);
  };

  if (loading && !data) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.surface }]}>
        <AllergnomShelfLoader label={t('chef.finding')} />
      </View>
    );
  }

  if (items.length < CHEF_MIN_ITEMS) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.surface }]}>
        <Image source={CHEF_IMAGE} style={styles.chefImage} resizeMode="contain" />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {tf('chef.scanMore', { count: CHEF_MIN_ITEMS - items.length })}
        </Text>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.surface }]}>
        <ErrorText>{error}</ErrorText>
        <Pressable
          onPress={() => void load()}
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
        >
          <Text style={[styles.retryText, { color: colors.onPrimary }]}>{t('chef.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  const have = data?.ingredientsYouHave ?? [];
  const visibleHave = showAllHave ? have : have.slice(0, HAVE_PREVIEW);
  const hiddenHave = have.length - visibleHave.length;
  const withoutData = data?.productsWithoutIngredients ?? [];

  const header = (
    <View style={styles.headerStack}>
      <View style={[styles.card, { backgroundColor: colors.background }]}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          {tf('chef.fromProducts', { count: items.length })}
        </Text>
        {have.length > 0 ? (
          <>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {t('chef.youHave')}
            </Text>
            <View style={styles.chipWrap}>
              {visibleHave.map((name) => (
                <View
                  key={name}
                  style={[styles.haveChip, { backgroundColor: colors.surface }]}
                >
                  <Text style={[styles.haveChipText, { color: colors.text }]}>{name}</Text>
                </View>
              ))}
              {hiddenHave > 0 || showAllHave ? (
                <Pressable
                  onPress={() => setShowAllHave((v) => !v)}
                  style={[styles.haveChip, { borderColor: colors.border, borderWidth: 1 }]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.haveChipText, { color: colors.textSecondary }]}>
                    {showAllHave ? t('chef.showLess') : `+${hiddenHave}`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}
        {withoutData.length > 0 ? (
          <View style={styles.noteRow}>
            <MaterialCommunityIcons
              name="information-outline"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={[styles.noteText, { color: colors.textSecondary }]}>
              {tf('chef.noIngredientData', {
                names: withoutData.map((p) => p.name?.trim() || p.product).join(', '),
              })}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.resultsBar}>
        <Text style={[styles.resultsCount, { color: colors.text }]}>
          {tf('chef.matchCount', { count: data?.matchingRecipes ?? 0 })}
        </Text>
        {avoidAllergens.length > 0 && (data?.recipes.length ?? 0) > 0 ? (
          <Pressable
            onPress={() => setSafeOnly((v) => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: safeOnly }}
            style={[
              styles.filterChip,
              safeOnly
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { borderColor: colors.border, backgroundColor: colors.background },
            ]}
          >
            <MaterialCommunityIcons
              name={safeOnly ? 'shield-check' : 'shield-outline'}
              size={16}
              color={safeOnly ? colors.onPrimary : colors.text}
            />
            <Text
              style={[
                styles.filterChipText,
                { color: safeOnly ? colors.onPrimary : colors.text },
              ]}
            >
              {t('chef.safeOnly')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <FlatList
        data={recipes}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        refreshing={loading}
        onRefresh={() => void load()}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons
              name="silverware-clean"
              size={40}
              color={colors.textSecondary}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {safeOnly ? t('chef.noSafeRecipes') : t('chef.noRecipes')}
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
              {t('chef.noRecipesHint')}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const avoided = avoidedIn(item);
          const otherAllergens = item.allergens.filter((a) => !avoided.includes(a));
          const pct = Math.round(Math.max(0, Math.min(1, item.coverage)) * 100);
          return (
            <Pressable
              onPress={() => openRecipe(item)}
              accessibilityRole="link"
              accessibilityLabel={item.name}
              style={[styles.recipeCard, { backgroundColor: colors.background }]}
            >
              <View style={styles.recipeTop}>
                <View style={[styles.thumb, { backgroundColor: colors.surface }]}>
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.thumbImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name="silverware-fork-knife"
                      size={24}
                      color={colors.textSecondary}
                    />
                  )}
                </View>
                <View style={styles.recipeMain}>
                  <Text style={[styles.recipeName, { color: colors.text }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <View style={styles.coverageRow}>
                    <View style={[styles.coverageTrack, { backgroundColor: colors.surface }]}>
                      <View
                        style={[
                          styles.coverageFill,
                          { width: `${pct}%`, backgroundColor: colors.primary },
                        ]}
                      />
                    </View>
                    <Text style={[styles.coverageText, { color: colors.textSecondary }]}>
                      {tf('chef.haveOf', { have: item.have, need: item.need })}
                    </Text>
                  </View>
                </View>
              </View>

              {item.missing.length > 0 ? (
                <Text style={[styles.detailLine, { color: colors.textSecondary }]}>
                  <Text style={[styles.detailLabel, { color: colors.text }]}>
                    {t('chef.missing')}{' '}
                  </Text>
                  {item.missing.join(', ')}
                </Text>
              ) : (
                <Text style={[styles.detailLine, styles.detailLabel, { color: colors.text }]}>
                  {t('chef.haveAll')}
                </Text>
              )}

              {avoided.length > 0 ? (
                <View style={styles.chipWrap}>
                  {avoided.map((a) => (
                    <AllergenBadge key={a} name={a} kind="contains" />
                  ))}
                </View>
              ) : null}
              {otherAllergens.length > 0 ? (
                <Text style={[styles.allergenLine, { color: colors.textSecondary }]}>
                  {t('chef.allergens')} {otherAllergens.map(allergenName).join(', ')}
                </Text>
              ) : null}

              <View style={[styles.sourceRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.sourceText, { color: colors.textSecondary }]}>
                  {tf('chef.openAt', { source: item.source?.toUpperCase() || 'MENY' })}
                </Text>
                <MaterialCommunityIcons
                  name="open-in-new"
                  size={16}
                  color={colors.textSecondary}
                />
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  list: { padding: 16, paddingBottom: 32 },
  headerStack: { gap: 12, marginBottom: 12 },
  card: { borderRadius: 12, padding: 16, gap: 8 },
  sectionLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  haveChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  haveChipText: { fontSize: 13, fontWeight: '600' },
  noteRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: 4 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17 },
  resultsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 2,
  },
  resultsCount: { flex: 1, fontSize: 15, fontWeight: '700' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipText: { fontSize: 13, fontWeight: '700' },
  recipeCard: { borderRadius: 12, padding: 14, marginBottom: 10, gap: 10 },
  recipeTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: { ...StyleSheet.absoluteFill },
  recipeMain: { flex: 1, minWidth: 0, gap: 8 },
  recipeName: { fontSize: 16, fontWeight: '700', lineHeight: 21 },
  coverageRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  coverageTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  coverageFill: { height: '100%', borderRadius: 3 },
  coverageText: { fontSize: 12, fontWeight: '600' },
  detailLine: { fontSize: 13, lineHeight: 18 },
  detailLabel: { fontWeight: '700' },
  allergenLine: { fontSize: 12, lineHeight: 17 },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  sourceText: { fontSize: 12, fontWeight: '600' },
  chefImage: { width: 96, height: 96 },
  emptyWrap: { alignItems: 'center', paddingTop: 32, paddingHorizontal: 16, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyBody: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  retryText: { fontWeight: '700', fontSize: 15 },
});
