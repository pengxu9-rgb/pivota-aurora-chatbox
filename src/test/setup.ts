import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

if (!(globalThis as any).ResizeObserver) {
  class ResizeObserverMock {
    private callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element) {
      this.callback(
        [
          {
            target,
            contentRect: {
              x: 0,
              y: 0,
              width: 320,
              height: 320,
              top: 0,
              right: 320,
              bottom: 320,
              left: 0,
              toJSON: () => ({}),
            },
          } as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver,
      );
    }

    unobserve() {}

    disconnect() {}
  }

  (globalThis as any).ResizeObserver = ResizeObserverMock;
}

const toConsoleText = (args: unknown[]): string =>
  args
    .map((item) => {
      if (typeof item === "string") return item;
      if (item instanceof Error) return `${item.name}: ${item.message}`;
      try {
        return JSON.stringify(item);
      } catch {
        return String(item);
      }
    })
    .join(" ");

const shouldSuppressWarning = (text: string): boolean => {
  return /React Router Future Flag Warning/i.test(text);
};

const shouldSuppressError = (text: string): boolean => {
  return /not wrapped in act\(\.\.\.\)/i.test(text);
};

const originalWarn = console.warn.bind(console);
const originalError = console.error.bind(console);

console.warn = (...args: Parameters<typeof console.warn>) => {
  if (shouldSuppressWarning(toConsoleText(args))) return;
  originalWarn(...args);
};

console.error = (...args: Parameters<typeof console.error>) => {
  if (shouldSuppressError(toConsoleText(args))) return;
  originalError(...args);
};
