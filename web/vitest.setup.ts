import '@testing-library/jest-dom/vitest'

// jsdom lacks these; React Flow and some layout code expect them.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub
if (!globalThis.DOMMatrixReadOnly) {
  // @ts-expect-error minimal stub
  globalThis.DOMMatrixReadOnly = class { m22 = 1; constructor() {} }
}
