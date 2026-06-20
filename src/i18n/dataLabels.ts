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

// The backend stores the signer's side of the frame as 'left' / 'right' (or '-'
// for single-signer clips). Translate the directional words for Polish.
const SPEAKER_SIDE: LabelMap = {
  left: { pl: 'lewa', en: 'left' },
  right: { pl: 'prawa', en: 'right' },
}

// Sex is stored as 'M' / 'F'. Polish uses 'K' (kobieta) for female; 'M' is shared.
const SEX: LabelMap = {
  M: { pl: 'M', en: 'M' },
  F: { pl: 'K', en: 'F' },
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

export function localizeSpeakerSide(value: string, locale: AppLocale): string {
  return localize(SPEAKER_SIDE, value, locale)
}

export function localizeSex(value: string, locale: AppLocale): string {
  return localize(SEX, value, locale)
}
