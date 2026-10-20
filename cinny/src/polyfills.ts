/**
 * 运行时补丁：老版本安卓 WebView（Chrome <119，常见于华为等机型）缺 ES2024 的
 * Promise.withResolvers，而 matrix-js-sdk 的 rust-crypto 层（密钥请求、设备验证、
 * 交叉签名引导）会调用它，缺了就直接抛 "Promise.withResolvers is not a function"。
 * 必须在任何 SDK 代码运行前装上（index.tsx 第一行导入）。
 */
if (typeof (Promise as unknown as Record<string, unknown>).withResolvers !== 'function') {
  (Promise as unknown as Record<string, unknown>).withResolvers = function withResolvers() {
    let resolve!: (value: unknown) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<unknown>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

export {};
