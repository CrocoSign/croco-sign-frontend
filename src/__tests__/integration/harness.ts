// Integration-test harness.
//
// Unlike the component unit specs (which stub `@/api/client`), these tests mount
// the REAL App + real router + real api/client and mock only at the network
// boundary: `fetch` for REST and `EventSource` for the job stream. That exercises
// the full chain — routing, fetch URL building, response/error unwrapping in
// client.ts, DTO shapes and rendering — the way the browser would.

import { vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import {
  createRouter,
  createMemoryHistory,
  type RouteRecordRaw,
  type Router,
} from 'vue-router'

import App from '@/App.vue'
import { routes } from '@/router'
import type {
  ExperimentDetail,
  Job,
  MetricsTable,
  ModelInfo,
  SegmentDetail,
  SegmentFacets,
  SegmentPage,
  TranslateAccepted,
} from '@/api/types'

// --- Minimal Response stand-in -------------------------------------------------
// client.ts only touches `ok`, `status`, `json()` and `blob()`, so a plain object
// is enough and keeps assertions obvious.
export interface FakeResponse {
  ok: boolean
  status: number
  json: () => Promise<unknown>
  blob: () => Promise<Blob>
}

export function jsonResponse(body: unknown, status = 200): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    blob: async () => new Blob([JSON.stringify(body)], { type: 'application/json' }),
  }
}

// Mirrors the backend's { code, message } error envelope that toError() unwraps.
export function apiError(message: string, status = 500, code = 'error'): FakeResponse {
  return jsonResponse({ code, message }, status)
}

export function binaryResponse(content = 'binary', type = 'video/mp4'): FakeResponse {
  const blob = new Blob([content], { type })
  return { ok: true, status: 200, json: async () => ({}), blob: async () => blob }
}

// --- fetch router --------------------------------------------------------------
export interface FetchRequest {
  method: string
  path: string
  search: URLSearchParams
  init?: RequestInit
}
export type FetchHandler = (req: FetchRequest) => FakeResponse | Promise<FakeResponse>

// Install a global `fetch` mock driven by `handler`. Returns the spy so tests can
// assert on calls. Unhandled requests reject loudly rather than hang.
export function installFetch(handler: FetchHandler) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.toString())
    const method = (init?.method ?? 'GET').toUpperCase()
    return handler({ method, path: url.pathname, search: url.searchParams, init })
  })
  vi.stubGlobal('fetch', spy)
  return spy
}

// --- Declarative fake backend --------------------------------------------------
// Most tests just describe the data the backend would return; the resulting
// handler routes the client's requests to it. `errors` forces a chosen route to
// fail, for the error-path tests.
export interface BackendData {
  models?: ModelInfo[]
  segmentPage?: SegmentPage
  facets?: SegmentFacets
  segments?: Record<number, SegmentDetail>
  metrics?: MetricsTable
  experiments?: Record<number, ExperimentDetail>
  translateAccepted?: TranslateAccepted
  jobs?: Record<string, Job>
  // Per-endpoint forced failures, keyed by a stable label (see routing below).
  errors?: Partial<Record<BackendRoute, FakeResponse>>
}

export type BackendRoute =
  | 'models'
  | 'translate'
  | 'job'
  | 'segments'
  | 'filters'
  | 'segment'
  | 'metrics'
  | 'experiment'

export function fakeBackend(data: BackendData): FetchHandler {
  const fail = (route: BackendRoute) => data.errors?.[route]

  return ({ method, path, search }) => {
    if (method === 'GET' && path === '/models') {
      return fail('models') ?? jsonResponse(data.models ?? [])
    }
    if (method === 'POST' && /^\/models\/[^/]+\/translate$/.test(path)) {
      return (
        fail('translate') ??
        jsonResponse(
          data.translateAccepted ?? {
            job_id: 'job-1',
            status: 'pending',
            status_url: 'http://localhost:8000/jobs/job-1',
          },
        )
      )
    }
    if (method === 'GET' && /^\/jobs\/[^/]+$/.test(path)) {
      const id = path.split('/')[2]!
      return fail('job') ?? jsonResponse(data.jobs?.[id] ?? {})
    }
    if (method === 'GET' && path === '/segments/filters') {
      return (
        fail('filters') ??
        jsonResponse(data.facets ?? { ages: [], sexes: [], speaker_ids: [] })
      )
    }
    if (method === 'GET' && path === '/segments') {
      const f = fail('segments')
      if (f) return f
      const page = data.segmentPage ?? { items: [], total: 0 }
      // Honour offset/limit so infinite-scroll pagination is exercised for real.
      const offset = Number(search.get('offset') ?? '0')
      const limit = Number(search.get('limit') ?? page.items.length)
      return jsonResponse({ items: page.items.slice(offset, offset + limit), total: page.total })
    }
    if (method === 'GET' && /^\/segments\/\d+$/.test(path)) {
      const id = Number(path.split('/')[2])
      const detail = data.segments?.[id]
      return fail('segment') ?? (detail ? jsonResponse(detail) : apiError('not found', 404))
    }
    if (method === 'GET' && /^\/segments\/\d+\/video$/.test(path)) {
      return binaryResponse()
    }
    if (method === 'GET' && path === '/metrics') {
      return fail('metrics') ?? jsonResponse(data.metrics ?? { metrics: [], experiments: [] })
    }
    if (method === 'GET' && /^\/experiments\/\d+$/.test(path)) {
      const id = Number(path.split('/')[2])
      const detail = data.experiments?.[id]
      return fail('experiment') ?? (detail ? jsonResponse(detail) : apiError('not found', 404))
    }
    if (method === 'GET' && /^\/experiments\/\d+\/architecture$/.test(path)) {
      return binaryResponse('png', 'image/png')
    }
    throw new Error(`No backend route for ${method} ${path}`)
  }
}

// --- EventSource stub ----------------------------------------------------------
// Lets a test drive the job stream the way the worker would push status changes.
export class MockEventSource {
  static instances: MockEventSource[] = []
  static get last(): MockEventSource | undefined {
    return MockEventSource.instances[MockEventSource.instances.length - 1]
  }
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  closed = false
  constructor(public url: string) {
    MockEventSource.instances.push(this)
  }
  emit(job: Job) {
    this.onmessage?.({ data: JSON.stringify(job) })
  }
  fail() {
    this.onerror?.()
  }
  close() {
    this.closed = true
  }
  static reset() {
    MockEventSource.instances = []
  }
}

// --- IntersectionObserver stub (ViewPage infinite scroll) ----------------------
export class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []
  constructor(public cb: IntersectionObserverCallback) {
    MockIntersectionObserver.instances.push(this)
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  // Simulate the sentinel scrolling into view.
  trigger() {
    this.cb(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    )
  }
  static reset() {
    MockIntersectionObserver.instances = []
  }
}

// --- App mounting --------------------------------------------------------------
// Eagerly resolve the route table's lazy `import()` components. A fire-and-forget
// router.push (how the views navigate) into a still-unresolved dynamic import
// never settles under the test event loop; pre-resolving makes in-test navigation
// synchronous so a flushPromises() after a click is enough.
async function eagerRoutes(): Promise<RouteRecordRaw[]> {
  return Promise.all(
    routes.map(async (route) => {
      if (typeof route.component === 'function') {
        const loader = route.component as () => Promise<{ default: unknown }>
        const mod = await loader()
        return { ...route, component: mod.default } as RouteRecordRaw
      }
      return route
    }),
  )
}

export async function mountApp(initialPath = '/translate'): Promise<{
  wrapper: VueWrapper
  router: Router
}> {
  const router = createRouter({ history: createMemoryHistory(), routes: await eagerRoutes() })
  await router.push(initialPath)
  await router.isReady()
  // i18n is registered globally in vitest.setup.ts; pinia + router added here.
  const wrapper = mount(App, { global: { plugins: [createPinia(), router] } })
  await flushPromises()
  return { wrapper, router }
}
