import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAllergenPrefs } from '../src/allergens/AllergenPrefsContext';
import { allergenLabelMatches } from '../src/allergens/allergenPrefs';
import { getAuthToken } from '../src/auth/session';
import { CHEF_MIN_ITEMS, useChefItems } from '../src/chef/chefBasket';
import { rememberSuggestions } from '../src/chef/recipeCache';
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
  const { t, tf } = useI18n();
  const { selected: avoidAllergens } = useAllergenPrefs();
  const items = useChefItems();
  const router = useRouter();

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
      rememberSuggestions(result.recipes);
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
    router.push({ pathname: '/recipe', params: { id: String(recipe.id) } });
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
          const pct = Math.round(Math.max(0, Math.min(1, item.coverage)) * 100);
          const complete = item.missing.length === 0;
          return (
            <Pressable
              onPress={() => openRecipe(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${tf('chef.haveOf', { have: item.have, need: item.need })}`}
              style={({ pressed }) => [
                styles.recipeCard,
                { backgroundColor: colors.background, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <View style={[styles.hero, { backgroundColor: colors.surface }]}>
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.heroImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Image source={CHEF_IMAGE} style={styles.heroPlaceholder} resizeMode="contain" />
                )}
                <View style={[styles.coveragePill, { backgroundColor: colors.background }]}>
                  <MaterialCommunityIcons
                    name={complete ? 'check-circle' : 'basket-outline'}
                    size={14}
                    color={colors.text}
                  />
                  <Text style={[styles.coveragePillText, { color: colors.text }]}>
                    {tf('chef.haveOf', { have: item.have, need: item.need })}
                  </Text>
                </View>
              </View>

              <View style={styles.recipeBody}>
                <Text style={[styles.recipeName, { color: colors.text }]} numberOfLines={2}>
                  {item.name}
                </Text>
                <View style={[styles.coverageTrack, { backgroundColor: colors.surface }]}>
                  <View
                    style={[
                      styles.coverageFill,
                      { width: `${pct}%`, backgroundColor: colors.primary },
                    ]}
                  />
                </View>
                {complete ? (
                  <Text style={[styles.detailLine, styles.detailLabel, { color: colors.text }]}>
                    {t('chef.haveAll')}
                  </Text>
                ) : (
                  <Text
                    style={[styles.detailLine, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    <Text style={[styles.detailLabel, { color: colors.text }]}>
                      {t('chef.missing')}{' '}
                    </Text>
                    {item.missing.join(', ')}
                  </Text>
                )}
                {avoided.length > 0 ? (
                  <View style={styles.chipWrap}>
                    {avoided.map((a) => (
                      <AllergenBadge key={a} name={a} kind="contains" />
                    ))}
                  </View>
                ) : null}
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
  recipeCard: {
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
  },
  hero: {
    width: '100%',
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: { ...StyleSheet.absoluteFill },
  heroPlaceholder: { width: 88, height: 88, opacity: 0.9 },
  coveragePill: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  coveragePillText: { fontSize: 12, fontWeight: '700' },
  recipeBody: { padding: 14, gap: 10 },
  recipeName: { fontSize: 18, fontWeight: '800', lineHeight: 23 },
  coverageTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  coverageFill: { height: '100%', borderRadius: 3 },
  detailLine: { fontSize: 13, lineHeight: 18 },
  detailLabel: { fontWeight: '700' },
  chefImage: { width: 96, height: 96 },
  emptyWrap: { alignItems: 'center', paddingTop: 32, paddingHorizontal: 16, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyBody: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  retryText: { fontWeight: '700', fontSize: 15 },
});
