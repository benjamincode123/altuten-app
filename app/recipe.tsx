import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAllergenPrefs } from '../src/allergens/AllergenPrefsContext';
import { allergenLabelMatches } from '../src/allergens/allergenPrefs';
import { getAuthToken } from '../src/auth/session';
import { getSuggestion } from '../src/chef/recipeCache';
import { AllergenBadge } from '../src/components/AllergenBadge';
import { AllergnomShelfLoader } from '../src/components/AllergnomShelfLoader';
import { ErrorText } from '../src/components/ErrorText';
import { fetchRecipe, type RecipeCredit, type RecipeDetail } from '../src/data/recipesApi';
import { AppError } from '../src/errors/appError';
import { userFacingError } from '../src/errors/userFacingError';
import { useI18n } from '../src/i18n/I18nContext';
import { useReliableBackHeader } from '../src/navigation/useReliableBackHeader';
import { useTheme } from '../src/theme/ThemeContext';

const CHEF_IMAGE = require('../assets/allergnom/chef.png');

function normalize(text: string): string {
  return text.toLocaleLowerCase('nb').normalize('NFC');
}

/** Opens a credit link; links are only on the small credit lines, never on the recipe itself. */
function openLink(url: string | null | undefined) {
  if (!url) return;
  void Linking.openURL(url).catch(() => undefined);
}

export default function RecipeScreen() {
  const { colors } = useTheme();
  const { t, tf, allergenName } = useI18n();
  const { selected: avoidAllergens } = useAllergenPrefs();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Number(params.id);
  const suggestion = Number.isFinite(id) ? getSuggestion(id) : undefined;

  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useReliableBackHeader({ title: t('chef.recipesTitle') });

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      if (!token) throw new AppError('unauthorized');
      if (!Number.isFinite(id)) throw new AppError('generic');
      const result = await fetchRecipe(token, id);
      if (requestId !== requestIdRef.current) return;
      setRecipe(result);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(userFacingError(err, t, 'generic'));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const name = recipe?.name || suggestion?.name || '';
  const imageUrl = recipe?.imageUrl ?? suggestion?.imageUrl ?? null;
  const credit = recipe?.credit ?? suggestion?.credit ?? null;

  // Ingredient names the user has (from the scan), to tick off matching lines.
  const haveNames = useMemo(
    () =>
      (suggestion?.matched ?? [])
        .map((m) => normalize(m.ingredient))
        .filter((n) => n.length > 1),
    [suggestion]
  );
  const hasLine = useCallback(
    (line: string) => {
      const l = normalize(line);
      return haveNames.some((n) => l.includes(n));
    },
    [haveNames]
  );

  if (!suggestion && loading && !recipe) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.surface }]}>
        <AllergnomShelfLoader label={t('chef.finding')} />
      </View>
    );
  }

  if (!suggestion && !recipe) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.surface }]}>
        <ErrorText>{error ?? t('chef.noRecipes')}</ErrorText>
        <RetryButton onPress={() => void load()} label={t('chef.retry')} />
      </View>
    );
  }

  const avoided = (suggestion?.allergens ?? []).filter((a) =>
    avoidAllergens.some((s) => allergenLabelMatches(s, a))
  );
  const otherAllergens = (suggestion?.allergens ?? []).filter((a) => !avoided.includes(a));
  const mayContain = suggestion?.mayContain ?? [];
  const complete = suggestion ? suggestion.missing.length === 0 : false;

  return (
    <ScrollView
      style={{ backgroundColor: colors.surface }}
      contentContainerStyle={styles.scroll}
    >
      <View style={[styles.hero, { backgroundColor: colors.background }]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <Image source={CHEF_IMAGE} style={styles.heroPlaceholder} resizeMode="contain" />
        )}
      </View>

      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {name}
        </Text>

        {recipe ? (
          <View style={styles.metaRow}>
            <MetaItem
              icon="format-list-bulleted"
              text={tf('chef.ingredientsCount', { count: recipe.ingredients.length })}
            />
            {recipe.steps.length > 0 ? (
              <MetaItem
                icon="chef-hat"
                text={tf('chef.stepsCount', { count: recipe.steps.length })}
              />
            ) : null}
          </View>
        ) : null}

        {suggestion ? (
          <View style={[styles.haveBox, { backgroundColor: colors.surface }]}>
            <View style={styles.haveHead}>
              <MaterialCommunityIcons
                name={complete ? 'check-circle' : 'basket-outline'}
                size={18}
                color={colors.text}
              />
              <Text style={[styles.haveTitle, { color: colors.text }]}>
                {complete
                  ? t('chef.haveAll')
                  : `${t('chef.youHave')} ${tf('chef.haveOf', {
                      have: suggestion.have,
                      need: suggestion.need,
                    })}`}
              </Text>
            </View>
            <View style={[styles.coverageTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.coverageFill,
                  {
                    width: `${Math.round(Math.max(0, Math.min(1, suggestion.coverage)) * 100)}%`,
                    backgroundColor: colors.primary,
                  },
                ]}
              />
            </View>
            {!complete ? (
              <Text style={[styles.smallText, { color: colors.textSecondary }]}>
                <Text style={{ fontWeight: '700', color: colors.text }}>{t('chef.missing')} </Text>
                {suggestion.missing.join(', ')}
              </Text>
            ) : null}
          </View>
        ) : null}

        {suggestion ? (
          <Section title={t('chef.allergensFromScan')}>
            {avoided.length > 0 ? (
              <View style={styles.badgeWrap}>
                {avoided.map((a) => (
                  <AllergenBadge key={a} name={a} kind="contains" />
                ))}
              </View>
            ) : null}
            {otherAllergens.length > 0 ? (
              <Text style={[styles.smallText, { color: colors.text }]}>
                <Text style={{ fontWeight: '700' }}>{t('chef.allergens')} </Text>
                {otherAllergens.map(allergenName).join(', ')}
              </Text>
            ) : null}
            {mayContain.length > 0 ? (
              <Text style={[styles.smallText, { color: colors.textSecondary }]}>
                <Text style={{ fontWeight: '700' }}>{t('chef.mayContain')} </Text>
                {mayContain.map(allergenName).join(', ')}
              </Text>
            ) : null}
            {suggestion.allergens.length === 0 && mayContain.length === 0 ? (
              <Text style={[styles.smallText, { color: colors.text }]}>
                {t('chef.noAllergensFound')}
              </Text>
            ) : null}
            {suggestion.allergensIncomplete ? (
              <View style={styles.noteRow}>
                <MaterialCommunityIcons
                  name="information-outline"
                  size={15}
                  color={colors.textSecondary}
                />
                <Text style={[styles.noteText, { color: colors.textSecondary }]}>
                  {t('chef.allergensIncomplete')}
                </Text>
              </View>
            ) : null}
          </Section>
        ) : null}

        {!recipe ? (
          <View style={styles.inlineState}>
            {loading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <>
                <ErrorText>{error ?? t('chef.noRecipes')}</ErrorText>
                <RetryButton onPress={() => void load()} label={t('chef.retry')} />
              </>
            )}
          </View>
        ) : (
          <>
            <Section title={t('chef.ingredients')}>
              <View style={styles.ingredientList}>
                {recipe.ingredients.map((line, i) => {
                  const have = hasLine(line);
                  return (
                    <View
                      key={`${i}-${line}`}
                      style={[
                        styles.ingredientRow,
                        i > 0 && {
                          borderTopColor: colors.border,
                          borderTopWidth: StyleSheet.hairlineWidth,
                        },
                      ]}
                      accessibilityLabel={have ? `${line}, ${t('chef.youHaveThis')}` : line}
                    >
                      <MaterialCommunityIcons
                        name={have ? 'check-circle' : 'circle-small'}
                        size={have ? 18 : 22}
                        color={have ? colors.text : colors.textSecondary}
                        style={have ? styles.ingredientIconHave : styles.ingredientIcon}
                      />
                      <Text
                        style={[
                          styles.ingredientText,
                          { color: colors.text },
                          have && styles.ingredientTextHave,
                        ]}
                      >
                        {line}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Section>

            <Section title={t('chef.steps')}>
              {recipe.steps.length === 0 ? (
                <Text style={[styles.smallText, { color: colors.textSecondary }]}>
                  {t('chef.noSteps')}
                </Text>
              ) : (
                <View style={styles.stepList}>
                  {recipe.steps.map((step, i) => (
                    <View key={`${i}-${step}`} style={styles.stepRow}>
                      <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                        <Text style={[styles.stepNumberText, { color: colors.onPrimary }]}>
                          {i + 1}
                        </Text>
                      </View>
                      <Text style={[styles.stepText, { color: colors.text }]}>{step}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Section>
          </>
        )}

        <CreditFooter
          credit={credit}
          title={recipe?.originalName || name}
          fallbackSource={(recipe?.source || suggestion?.source || '').toUpperCase()}
        />
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function MetaItem({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  text: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.metaItem}>
      <MaterialCommunityIcons name={icon} size={15} color={colors.textSecondary} />
      <Text style={[styles.metaText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

function RetryButton({ onPress, label }: { onPress: () => void; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.retryBtn, { backgroundColor: colors.primary }]}
      accessibilityRole="button"
    >
      <Text style={[styles.retryText, { color: colors.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Source credit at the bottom of the page, three small grey lines:
 *   Kilde: «Affogato» fra Wikibooks Cookbook
 *   Av Wikibooks-bidragsytere · Lisens: CC BY-SA 4.0
 *   Oversatt og tilpasset av AltUten · Foto: Jon Doe, CC BY 2.0
 */
function CreditFooter({
  credit,
  title,
  fallbackSource,
}: {
  credit: RecipeCredit | null;
  title: string;
  fallbackSource: string;
}) {
  const { colors } = useTheme();
  const { t, tf } = useI18n();
  const color = { color: colors.textSecondary };

  if (!credit) {
    if (!fallbackSource) return null;
    return (
      <View style={[styles.credit, { borderTopColor: colors.border }]}>
        <Text style={[styles.creditText, color]}>
          {tf('chef.creditSource', { title, source: fallbackSource })}
        </Text>
      </View>
    );
  }

  const shortSource = credit.sourceName.replace(/\s+Cookbook$/i, '');
  const author = credit.author?.trim() || tf('chef.creditContributors', { source: shortSource });
  const photo = credit.imageAuthor?.trim()
    ? `${tf('chef.creditPhoto', { author: credit.imageAuthor.trim() })}${
        credit.imageLicense ? `, ${credit.imageLicense}` : ''
      }`
    : null;

  return (
    <View style={[styles.credit, { borderTopColor: colors.border }]}>
      <Text
        style={[styles.creditText, color]}
        onPress={credit.sourceUrl ? () => openLink(credit.sourceUrl) : undefined}
        accessibilityRole={credit.sourceUrl ? 'link' : 'text'}
      >
        {tf('chef.creditSource', { title, source: credit.sourceName })}
      </Text>
      <Text style={[styles.creditText, color]}>
        <Text
          onPress={credit.authorsUrl ? () => openLink(credit.authorsUrl) : undefined}
          accessibilityRole={credit.authorsUrl ? 'link' : 'text'}
        >
          {tf('chef.creditBy', { author })}
        </Text>
        {' · '}
        <Text
          onPress={credit.licenseUrl ? () => openLink(credit.licenseUrl) : undefined}
          accessibilityRole={credit.licenseUrl ? 'link' : 'text'}
          style={credit.licenseUrl ? styles.creditLink : undefined}
        >
          {tf('chef.creditLicense', { license: credit.license })}
        </Text>
      </Text>
      <Text style={[styles.creditText, color]}>
        {[t('chef.creditChanges'), photo].filter(Boolean).join(' · ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  scroll: { paddingBottom: 40 },
  hero: {
    width: '100%',
    aspectRatio: 4 / 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroImage: { ...StyleSheet.absoluteFill },
  heroPlaceholder: { width: 120, height: 120 },
  sheet: {
    marginTop: -20,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 24,
    gap: 18,
  },
  title: { fontSize: 26, fontWeight: '800', lineHeight: 32 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: -8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 13, fontWeight: '600' },
  haveBox: { borderRadius: 14, padding: 14, gap: 10 },
  haveHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  haveTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  coverageTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  coverageFill: { height: '100%', borderRadius: 3 },
  smallText: { fontSize: 13, lineHeight: 19 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 19, fontWeight: '800' },
  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  noteRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17 },
  inlineState: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  ingredientList: {},
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 10,
  },
  ingredientIcon: { width: 22, marginTop: -1 },
  ingredientIconHave: { width: 22, paddingLeft: 2, marginTop: 1 },
  ingredientText: { flex: 1, fontSize: 15, lineHeight: 21 },
  ingredientTextHave: { fontWeight: '600' },
  stepList: { gap: 16 },
  stepRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { fontSize: 14, fontWeight: '800' },
  stepText: { flex: 1, fontSize: 16, lineHeight: 24, paddingTop: 2 },
  credit: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    marginTop: 8,
    gap: 3,
  },
  creditText: { fontSize: 12, lineHeight: 17 },
  creditLink: { textDecorationLine: 'underline' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  retryText: { fontWeight: '700', fontSize: 15 },
});
