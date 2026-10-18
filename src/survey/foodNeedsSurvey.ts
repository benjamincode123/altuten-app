import type { ProductCatalog } from '../db/types';
import type { TranslationKey } from '../i18n/translations';

/**
 * Field names in the /api/food-needs-survey body, used as question ids so the
 * draft maps straight onto the request.
 */
export type FoodNeedsQuestionId =
  | 'ageGroup'
  | 'allergies'
  | 'diagnosisStatus'
  | 'actualNeed'
  | 'buyerRole';

export interface FoodNeedsOption {
  /**
   * Exact string the API accepts. The server validates against this list, so
   * it is the wire value even when the UI shows an English label.
   */
  value: string;
  labelKey: TranslationKey;
}

export interface FoodNeedsQuestion {
  id: FoodNeedsQuestionId;
  sectionKey: TranslationKey;
  questionKey: TranslationKey;
  hintKey: TranslationKey | null;
  multiple: boolean;
  /** Value that clears every other choice when picked, per API validation. */
  exclusiveValue?: string;
  options: FoodNeedsOption[];
}

export const FOOD_NEEDS_QUESTIONS: readonly FoodNeedsQuestion[] = [
  {
    id: 'ageGroup',
    sectionKey: 'survey.age.section',
    questionKey: 'survey.age.question',
    hintKey: 'survey.age.hint',
    multiple: false,
    options: [
      { value: '0–5 år', labelKey: 'survey.age.0_5' },
      { value: '6–12 år', labelKey: 'survey.age.6_12' },
      { value: '13–17 år', labelKey: 'survey.age.13_17' },
      { value: '18–29 år', labelKey: 'survey.age.18_29' },
      { value: '30–44 år', labelKey: 'survey.age.30_44' },
      { value: '45–59 år', labelKey: 'survey.age.45_59' },
      { value: '60 år eller eldre', labelKey: 'survey.age.60plus' },
    ],
  },
  {
    id: 'allergies',
    sectionKey: 'survey.needs.section',
    questionKey: 'survey.needs.question',
    hintKey: 'survey.needs.hint',
    multiple: true,
    exclusiveValue: 'Ingen av disse',
    options: [
      { value: 'Melkeproteinallergi', labelKey: 'survey.needs.milkProtein' },
      { value: 'Laktoseintoleranse', labelKey: 'survey.needs.lactose' },
      { value: 'Cøliaki', labelKey: 'survey.needs.celiac' },
      { value: 'Hveteallergi', labelKey: 'survey.needs.wheat' },
      { value: 'Eggallergi', labelKey: 'survey.needs.egg' },
      { value: 'Peanøttallergi', labelKey: 'survey.needs.peanut' },
      { value: 'Nøtteallergi (andre nøtter)', labelKey: 'survey.needs.treeNut' },
      { value: 'Soyaallergi', labelKey: 'survey.needs.soy' },
      { value: 'Fiskeallergi', labelKey: 'survey.needs.fish' },
      { value: 'Skalldyrallergi', labelKey: 'survey.needs.shellfish' },
      {
        value: 'Annen diagnostisert matallergi',
        labelKey: 'survey.needs.otherAllergy',
      },
      {
        value: 'Annen diagnostisert intoleranse',
        labelKey: 'survey.needs.otherIntolerance',
      },
      {
        value: 'Mistenkt allergi eller intoleranse',
        labelKey: 'survey.needs.suspected',
      },
      { value: 'Ingen av disse', labelKey: 'survey.needs.none' },
    ],
  },
  {
    id: 'diagnosisStatus',
    sectionKey: 'survey.diagnosis.section',
    questionKey: 'survey.diagnosis.question',
    hintKey: null,
    multiple: false,
    options: [
      {
        value: 'Matallergi diagnostisert av helsepersonell',
        labelKey: 'survey.diagnosis.allergyDiagnosed',
      },
      {
        value: 'Intoleranse eller cøliaki diagnostisert av helsepersonell',
        labelKey: 'survey.diagnosis.intoleranceDiagnosed',
      },
      {
        value: 'Mistenker allergi eller intoleranse',
        labelKey: 'survey.diagnosis.suspected',
      },
      {
        value: 'Basert på egne erfaringer, uten bekreftet diagnose',
        labelKey: 'survey.diagnosis.selfReported',
      },
      {
        value: 'Usikker på diagnosen / svarer på vegne av en annen',
        labelKey: 'survey.diagnosis.unsure',
      },
    ],
  },
  {
    id: 'actualNeed',
    sectionKey: 'survey.reaction.section',
    questionKey: 'survey.reaction.question',
    hintKey: 'survey.reaction.hint',
    multiple: false,
    options: [
      {
        value: 'Jeg har fått milde symptomer, for eksempel kløe eller mageplager',
        labelKey: 'survey.reaction.mild',
      },
      {
        value: 'Jeg har fått alvorlige symptomer eller trengt akutt behandling',
        labelKey: 'survey.reaction.severe',
      },
      {
        value: 'Jeg unngår maten, men har ikke nylig blitt eksponert',
        labelKey: 'survey.reaction.avoiding',
      },
      {
        value: 'Jeg har ikke merket symptomer ved inntak',
        labelKey: 'survey.reaction.noSymptoms',
      },
      {
        value: 'Jeg unngår maten av andre grunner eller er usikker',
        labelKey: 'survey.reaction.otherReason',
      },
    ],
  },
  {
    id: 'buyerRole',
    sectionKey: 'survey.buyer.section',
    questionKey: 'survey.buyer.question',
    hintKey: null,
    multiple: false,
    options: [
      {
        value: 'Jeg kjøper mat hovedsakelig til meg selv',
        labelKey: 'survey.buyer.self',
      },
      {
        value: 'Jeg er forelder og kjøper mat til et barn',
        labelKey: 'survey.buyer.parent',
      },
      {
        value: 'Jeg kjøper mat til flere i husholdningen',
        labelKey: 'survey.buyer.household',
      },
      {
        value: 'Jeg handler for noen jeg hjelper eller har omsorg for',
        labelKey: 'survey.buyer.caregiver',
      },
      {
        value: 'Jeg er ikke den som vanligvis kjøper maten',
        labelKey: 'survey.buyer.notBuyer',
      },
    ],
  },
];

/** Picked values per question. Single-choice questions hold one entry. */
export type FoodNeedsDraft = Partial<Record<FoodNeedsQuestionId, string[]>>;

/** The product an answer belongs to — answers are stored per user per product. */
export interface FoodNeedsSurveyProductRef {
  catalog: ProductCatalog;
  productId: number;
}

/** Request body of POST /api/food-needs-survey/. */
export interface FoodNeedsSurveyRequest extends FoodNeedsSurveyProductRef {
  ageGroup: string;
  allergies: string[];
  diagnosisStatus: string;
  actualNeed: string;
  buyerRole: string;
}

export interface FoodNeedsSurveyResponse extends FoodNeedsSurveyRequest {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export function isQuestionAnswered(
  question: FoodNeedsQuestion,
  draft: FoodNeedsDraft
): boolean {
  return (draft[question.id]?.length ?? 0) > 0;
}

/**
 * Apply a tap to a question's current selection: single-choice replaces,
 * multi-choice toggles, and the exclusive value clears the rest.
 */
export function toggleAnswer(
  question: FoodNeedsQuestion,
  current: string[],
  value: string
): string[] {
  if (!question.multiple) {
    return [value];
  }
  if (current.includes(value)) {
    return current.filter((item) => item !== value);
  }
  if (value === question.exclusiveValue) {
    return [value];
  }
  const kept = question.exclusiveValue
    ? current.filter((item) => item !== question.exclusiveValue)
    : current;
  return [...kept, value];
}

/** Null until every question has an answer, which the API requires. */
export function buildRequest(
  product: FoodNeedsSurveyProductRef,
  draft: FoodNeedsDraft
): FoodNeedsSurveyRequest | null {
  const ageGroup = draft.ageGroup?.[0];
  const diagnosisStatus = draft.diagnosisStatus?.[0];
  const actualNeed = draft.actualNeed?.[0];
  const buyerRole = draft.buyerRole?.[0];
  const allergies = [...new Set(draft.allergies ?? [])];
  if (!ageGroup || !diagnosisStatus || !actualNeed || !buyerRole) return null;
  if (allergies.length === 0) return null;
  return {
    catalog: product.catalog,
    productId: product.productId,
    ageGroup,
    allergies,
    diagnosisStatus,
    actualNeed,
    buyerRole,
  };
}

/** Turn saved answers back into a draft so the sheet opens pre-filled. */
export function draftFromResponse(saved: FoodNeedsSurveyResponse): FoodNeedsDraft {
  return {
    ageGroup: [saved.ageGroup],
    allergies: [...saved.allergies],
    diagnosisStatus: [saved.diagnosisStatus],
    actualNeed: [saved.actualNeed],
    buyerRole: [saved.buyerRole],
  };
}
