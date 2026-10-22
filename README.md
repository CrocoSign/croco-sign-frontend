# croco-sign-frontend

Web interface for CrocoSign, our research on translating Polish Sign Language (PJM) into text. It lets you browse the corpus clips with their reference sentences and signer metadata, compare the results of our models and view their architecture diagrams, and submit a video for translation (one model or two side by side). Built with Vue 3, TypeScript, Vite, Pinia and vue-i18n (English and Polish).

This is a research prototype, not a replacement for an interpreter.

## Where this fits

All repositories are under [github.com/crocosign](https://github.com/crocosign), project site https://crocosign.github.io:

CrocoSign (data preparation) -> SpaMo-PJM / Uni-Sign-PJM (training) -> pjm-models (inference) -> [croco-sign-backend](https://github.com/crocosign/croco-sign-backend) / **croco-sign-frontend** (app).

The frontend only talks to the backend API (models, jobs and server-sent events, segments, metrics, experiments). The public site shows this app without live translation; to translate your own video, run the stack locally.

## Requirements

Node.js `^20.19.0` or `>=22.12.0` (we used 24) and npm. A running [croco-sign-backend](https://github.com/crocosign/croco-sign-backend) for anything beyond the unit tests.

## Run locally

```bash
npm install
npm run dev
```

The dev server listens on all interfaces, port 5173, and accepts any Host header, so it can be opened over LAN or Tailscale. Do not expose the dev server publicly; serve a production build instead.

### Backend address

Unless configured, the app calls the backend on the same host that served the page, port 8000 (`http(s)://<page hostname>:8000`). This keeps one build working on localhost, LAN and Tailscale. If the backend is elsewhere, set `VITE_API_BASE_URL` when starting or building:

```bash
VITE_API_BASE_URL=https://api.example.org npm run dev
```

The backend must allow the page origin in `CROCO_CORS_ALLOW_ORIGINS` (it allows all origins by default).

## Build and test

```bash
npm run build           # type-check and production build
npm run preview         # serve the build (port 4173)
npm run test:unit       # Vitest
npm run lint
npm run test:e2e        # Playwright with mocked API
npx playwright install  # once, to get browsers
npm run test:e2e:real   # Playwright against a real backend on :8000
```

`npm run build` type-checks and `npm run test:unit` runs the unit tests. `test:e2e:real` needs the backend running with Redis, the worker and a DeepL key; it translates with the backend's `mock` model, so no GPU is needed, but it streams a real clip from Hugging Face.

## Notes

- Translation results come from the models in [pjm-models](https://github.com/crocosign/pjm-models); on signers never seen in training (the SI split) they are weak, so do not rely on the output.
- Interface strings live in `src/i18n`; add a locale there.

## License

Our code is under the MIT licence (see `LICENSE`). The corpus clips shown in the app come from the Open Repository of the PJM Corpus (University of Warsaw), which is non-commercial only.

## Authors

Wojciech Sieńko and Rostyslav Kovalenko, PJATK engineering thesis, supervised by dr Albert Śledzianowski, MBA.
