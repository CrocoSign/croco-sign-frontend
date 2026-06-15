// Localised labels for a few descriptive values the backend stores in Polish.
// Proper nouns (PHOENIX, OpenASL, How2Sign, CSL-News, model architectures) are
// language-neutral and pass through unchanged.
import type { AppLocale } from '@/i18n'

type LabelMap = Record<string, { pl: string; en: string }>

const TRANSFER_SOURCE: LabelMap = {
  'brak (tylko PJM)': { pl: 'brak (tylko PJM)', en: 'none (PJM only)' },
  'brak (od zera)': { pl: 'brak (od zera)', en: 'none (from scratch)' },
}

const MODEL_NAME: LabelMap = {
  'SpaMo (modyf.)': { pl: 'SpaMo (modyf.)', en: 'SpaMo (mod.)' },
}

function localize(map: LabelMap, value: string, locale: AppLocale): string {
  return map[value]?.[locale] ?? value
}

export function localizeTransferSource(value: string, locale: AppLocale): string {
  return localize(TRANSFER_SOURCE, value, locale)
}

export function localizeModelName(value: string, locale: AppLocale): string {
  return localize(MODEL_NAME, value, locale)
}
