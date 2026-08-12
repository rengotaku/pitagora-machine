import { describe, expect, it } from "vitest";
import { describeConsoleArgs, extractConsoleError } from "./verify-console.mjs";

describe("verify-console: describeConsoleArgs", () => {
  it("string 値を持つ単一引数はその値をそのまま返す", () => {
    expect(describeConsoleArgs([{ type: "string", value: "boom" }])).toBe("boom");
  });

  it("複数引数はスペース区切りで連結する (console.error('x', 1) 相当)", () => {
    expect(
      describeConsoleArgs([
        { type: "string", value: "x" },
        { type: "number", value: 1 },
      ])
    ).toBe("x 1");
  });

  it("value を持たずdescription のみのオブジェクト引数は description を使う", () => {
    expect(
      describeConsoleArgs([
        {
          type: "object",
          subtype: "error",
          description: "Error: boom\n    at foo.js:1:1",
        },
      ])
    ).toBe("Error: boom\n    at foo.js:1:1");
  });

  it("value も description も無く unserializableValue のみの引数 (NaN 等) はそれを使う", () => {
    expect(describeConsoleArgs([{ type: "number", unserializableValue: "NaN" }])).toBe(
      "NaN"
    );
  });

  it("value も description も unserializableValue も無い引数は type を文字列化する", () => {
    expect(describeConsoleArgs([{ type: "undefined" }])).toBe("undefined");
  });

  it("args が undefined / null のときは空文字列を返す", () => {
    expect(describeConsoleArgs(undefined)).toBe("");
    expect(describeConsoleArgs(null)).toBe("");
  });
});

describe("verify-console: extractConsoleError (レビュー指摘 #3 回帰テスト)", () => {
  it("Runtime.exceptionThrown は exception.description を返す", () => {
    const msg = {
      method: "Runtime.exceptionThrown",
      params: {
        exceptionDetails: {
          exception: { description: "TypeError: boom" },
        },
      },
    };
    expect(extractConsoleError(msg)).toBe("TypeError: boom");
  });

  it("Runtime.exceptionThrown で description が欠けている場合は 'unknown' を返す", () => {
    const msg = { method: "Runtime.exceptionThrown", params: {} };
    expect(extractConsoleError(msg)).toBe("unknown");
  });

  it("Runtime.consoleAPICalled (type: error) は console.error の引数を文字列化して返す (レビュー指摘 #3 の中核)", () => {
    // Runtime.exceptionThrown は未処理例外しか通知しないため、検証対象が
    // console.error(...) だけで異常を報告するケース (例外を投げない) を
    // 検知できていなかった。type: "error" の consoleAPICalled を拾えることを確認する。
    const msg = {
      method: "Runtime.consoleAPICalled",
      params: {
        type: "error",
        args: [{ type: "string", value: "詰まりを検知しました" }],
      },
    };
    expect(extractConsoleError(msg)).toBe("詰まりを検知しました");
  });

  it("Runtime.consoleAPICalled で type が error 以外 (log/warning/info) なら null を返す", () => {
    for (const type of ["log", "warning", "info", "debug"]) {
      const msg = {
        method: "Runtime.consoleAPICalled",
        params: { type, args: [{ type: "string", value: "noise" }] },
      };
      expect(extractConsoleError(msg)).toBeNull();
    }
  });

  it("無関係な CDP メソッドは null を返す", () => {
    expect(extractConsoleError({ method: "Page.frameNavigated", params: {} })).toBeNull();
    expect(extractConsoleError({ method: "Network.requestWillBeSent" })).toBeNull();
  });

  it("msg が null / undefined でも例外を投げず null を返す", () => {
    expect(extractConsoleError(null)).toBeNull();
    expect(extractConsoleError(undefined)).toBeNull();
  });
});
