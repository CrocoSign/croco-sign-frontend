// External links for an experiment: source code (per architecture) and trained
// weights (per case = model + transfer source + split).
//
// Weights URL pattern, inferred from the provided examples:
//   .../pjm-models/tree/main/{family}/{modelSlug}-pjm-{sourceSlug}-{split}
//   e.g. spamo/mod-spamo-pjm-phoenix-ms , unisign/unisign-pjm-cslnews-ms
//
// NOTE: sourceSlug for `phoenix` and `cslnews` is confirmed; the others
// (how2sign, openasl, pjm, scratch) are inferred - correct SOURCE_SLUG below if
// a folder name differs.

const CODE_REPO: Record<string, string> = {
  SpaMo: 'https://github.com/croco-corp/spaMo-PJM',
  'SpaMo (modyf.)': 'https://github.com/croco-corp/spaMo-PJM',
  'Uni-Sign': 'https://github.com/croco-corp/Uni-Sign-PJM',
}

const WEIGHTS_BASE = 'https://huggingface.co/croco-corp/pjm-models/tree/main'

const FAMILY: Record<string, string> = {
  SpaMo: 'spamo',
  'SpaMo (modyf.)': 'spamo',
  'Uni-Sign': 'unisign',
}

const MODEL_SLUG: Record<string, string> = {
  SpaMo: 'spamo',
  'SpaMo (modyf.)': 'mod-spamo',
  'Uni-Sign': 'unisign',
}

const SOURCE_SLUG: Record<string, string> = {
  PHOENIX: 'phoenix', // confirmed
  'CSL-News': 'cslnews', // confirmed
  How2Sign: 'how2sign', // inferred
  OpenASL: 'openasl', // inferred
  'brak (tylko PJM)': 'pjm', // inferred
  'brak (od zera)': 'scratch', // inferred
}

export function codeUrl(modelName: string): string | null {
  return CODE_REPO[modelName] ?? null
}

export function weightsUrl(modelName: string, transferSource: string, split: string): string | null {
  const family = FAMILY[modelName]
  const model = MODEL_SLUG[modelName]
  const source = SOURCE_SLUG[transferSource]
  if (!family || !model || !source || !split) {
    return null
  }
  return `${WEIGHTS_BASE}/${family}/${model}-pjm-${source}-${split.toLowerCase()}`
}
