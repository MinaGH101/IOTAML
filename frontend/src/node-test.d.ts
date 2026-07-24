declare module 'node:test' {
  const test: (name: string, callback: () => void | Promise<void>) => void;
  export default test;
}

declare module 'node:assert/strict' {
  const assert: {
    deepEqual(actual: unknown, expected: unknown): void;
    equal(actual: unknown, expected: unknown): void;
    ok(value: unknown): void;
  };
  export default assert;
}
