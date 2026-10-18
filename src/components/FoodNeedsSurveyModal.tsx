import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../auth/AuthContext';
import { getAuthToken } from '../auth/session';
import { userFacingError } from '../errors/userFacingError';
import { useI18n } from '../i18n/I18nContext';
import {
  buildRequest,
  draftFromResponse,
  FOOD_NEEDS_QUESTIONS,
  isQuestionAnswered,
  toggleAnswer,
  type FoodNeedsDraft,
  type FoodNeedsSurveyProductRef,
  type FoodNeedsSurveyResponse,
} from '../survey/foodNeedsSurvey';
import { submitFoodNeedsSurvey } from '../survey/foodNeedsSurveyApi';
import { saveCachedFoodNeedsSurvey } from '../survey/foodNeedsSurveyCache';
import { useTheme } from '../theme/ThemeContext';
import { ErrorText } from './ErrorText';

const SHEET_SLIDE = Math.round(Dimensions.get('window').height * 0.42);

interface FoodNeedsSurveyModalProps {
  visible: boolean;
  /** Product the answers belong to. */
  product: FoodNeedsSurveyProductRef | null;
  productName?: string;
  /** Existing answers for this product, so answering again is an edit. */
  saved: FoodNeedsSurveyResponse | null;
  onClose: () => void;
  /** Called with the message to show behind the sheet and the stored answers. */
  onSubmitted?: (message: string, saved: FoodNeedsSurveyResponse) => void;
}

export function FoodNeedsSurveyModal({
  visible,
  product,
  productName,
  saved,
  onClose,
  onSubmitted,
}: FoodNeedsSurveyModalProps) {
  const { colors } = useTheme();
  const { t, tf } = useI18n();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<FoodNeedsDraft>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SHEET_SLIDE)).current;
  const signedIn = !!getAuthToken() && !!user;

  useEffect(() => {
    if (visible) {
      setStep(0);
      setDraft(saved ? draftFromResponse(saved) : {});
      setError(null);
      setSubmitting(false);
      setModalVisible(true);
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(SHEET_SLIDE);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: SHEET_SLIDE,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setModalVisible(false);
    });
  }, [visible, saved, backdropOpacity, sheetTranslateY]);

  const question = FOOD_NEEDS_QUESTIONS[step];
  const total = FOOD_NEEDS_QUESTIONS.length;
  const isLast = step === total - 1;
  const answered = isQuestionAnswered(question, draft);
  const selected = draft[question.id] ?? [];

  function pick(value: string) {
    setError(null);
    setDraft((prev) => ({
      ...prev,
      [question.id]: toggleAnswer(question, prev[question.id] ?? [], value),
    }));
  }

  function goBack() {
    setError(null);
    setStep((current) => Math.max(0, current - 1));
  }

  async function handleNext() {
    if (!answered) {
      setError(t('survey.needAnswer'));
      return;
    }
    if (!isLast) {
      setError(null);
      setStep((current) => current + 1);
      return;
    }

    const token = getAuthToken();
    if (!token || !user || !product) {
      setError(t('survey.signInRequired'));
      return;
    }
    const request = buildRequest(product, draft);
    if (!request) {
      setError(t('survey.needAnswer'));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await submitFoodNeedsSurvey(token, request);
      saveCachedFoodNeedsSurvey(user.id, product, result.response);
      onSubmitted?.(
        result.created ? t('survey.thanks') : t('survey.updated'),
        result.response
      );
      onClose();
    } catch (err) {
      setError(userFacingError(err, t, 'save_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>

          <View style={styles.titleRow}>
            <MaterialCommunityIcons
              name="comment-question-outline"
              size={28}
              color={colors.textSecondary}
            />
            <Text style={[styles.title, { color: colors.text }]}>
              {t('survey.open')}
            </Text>
          </View>
          {productName ? (
            <Text
              style={[styles.subtitle, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {productName}
            </Text>
          ) : null}

          {!signedIn ? (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              {t('survey.signInRequired')}
            </Text>
          ) : (
            <>
              <Text style={[styles.stepText, { color: colors.primary }]}>
                {`${tf('survey.step', { current: step + 1, total })} · ${t(
                  question.sectionKey
                )}`}
              </Text>
              <Text style={[styles.question, { color: colors.text }]}>
                {t(question.questionKey)}
              </Text>
              {question.hintKey ? (
                <Text style={[styles.hint, { color: colors.textSecondary }]}>
                  {t(question.hintKey)}
                </Text>
              ) : null}

              <ScrollView
                style={styles.options}
                contentContainerStyle={styles.optionsContent}
              >
                {question.options.map((option) => {
                  const picked = selected.includes(option.value);
                  return (
                    <Pressable
                      key={option.value}
                      style={[
                        styles.option,
                        {
                          borderColor: picked ? colors.primary : colors.border,
                          backgroundColor: picked
                            ? colors.primaryMuted ?? colors.surface
                            : colors.surface,
                        },
                      ]}
                      onPress={() => pick(option.value)}
                      disabled={submitting}
                      accessibilityRole={question.multiple ? 'checkbox' : 'radio'}
                      accessibilityState={{ checked: picked }}
                      accessibilityLabel={t(option.labelKey)}
                    >
                      <MaterialCommunityIcons
                        name={
                          question.multiple
                            ? picked
                              ? 'checkbox-marked'
                              : 'checkbox-blank-outline'
                            : picked
                              ? 'radiobox-marked'
                              : 'radiobox-blank'
                        }
                        size={22}
                        color={picked ? colors.primary : colors.textSecondary}
                      />
                      <Text style={[styles.optionText, { color: colors.text }]}>
                        {t(option.labelKey)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {error ? <ErrorText style={styles.error}>{error}</ErrorText> : null}

              <View style={styles.navRow}>
                {step > 0 ? (
                  <Pressable
                    style={[styles.navBack, { borderColor: colors.border }]}
                    onPress={goBack}
                    disabled={submitting}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.navBackText, { color: colors.text }]}>
                      {t('survey.back')}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={[
                    styles.navNext,
                    { backgroundColor: colors.primary },
                    submitting && styles.navDisabled,
                  ]}
                  onPress={() => void handleNext()}
                  disabled={submitting}
                  accessibilityRole="button"
                >
                  {submitting ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text style={[styles.navNextText, { color: colors.onPrimary }]}>
                      {isLast ? t('survey.submit') : t('survey.next')}
                    </Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingBottom: 28,
    paddingTop: 10,
    maxHeight: '88%',
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    marginLeft: '40%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  stepText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 6,
  },
  question: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 6,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  options: {
    marginTop: 12,
    // Let the list shrink inside the capped sheet height instead of overflowing.
    flexGrow: 0,
    flexShrink: 1,
  },
  optionsContent: {
    gap: 8,
    paddingBottom: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    marginTop: 10,
    fontSize: 14,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  navBack: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  navBackText: {
    fontSize: 16,
    fontWeight: '700',
  },
  navNext: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  navDisabled: {
    opacity: 0.7,
  },
  navNextText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
