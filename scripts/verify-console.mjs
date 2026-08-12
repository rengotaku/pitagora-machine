/**
 * CDP のコンソール関連イベントから「記録すべきコンソールエラー」を判定・整形する
 * 純粋ロジック (verify-stability.mjs から切り出し。WebSocket 通信を伴わないため
 * 単体テスト可能)。
 *
 * scripts/verify-stability.mjs は CLI 引数を要求しトップレベルで即座に副作用
 * (fetch・process.exit 等) を起こす構成のため、そのままでは import してテストできない。
 * 判定・整形ロジックだけをここへ切り出すことで、実際の CDP 接続なしに検証できるようにする。
 */

/**
 * Runtime.consoleAPICalled の args (RemoteObject の配列) を人間が読める文字列に
 * まとめる。console.error("x", 1, {a:1}) のように複数引数・非プリミティブが
 * 渡されることもあるため、それぞれの表現をスペース区切りで連結する。
 */
export function describeConsoleArgs(args) {
  return (args ?? [])
    .map((arg) => {
      if (arg.value !== undefined) return String(arg.value);
      if (arg.description !== undefined) return arg.description;
      if (arg.unserializableValue !== undefined) return arg.unserializableValue;
      return String(arg.type ?? "unknown");
    })
    .join(" ");
}

/**
 * CDP のメッセージが「記録すべきコンソールエラー」かどうかを判定し、該当すれば
 * 表示用の文字列を、該当しなければ null を返す。
 *
 * - Runtime.exceptionThrown: 未処理の JS 例外。
 * - Runtime.consoleAPICalled (type: "error"): console.error(...) による報告。
 *   Runtime.exceptionThrown は未処理例外しか通知しないため、これが無いと
 *   検証対象が例外を投げずに console.error(...) だけで異常を報告するケースを
 *   検知できない (docs/verification.md の「コンソールエラー 0 件」判定基準に対する
 *   レビュー指摘 #3)。
 */
export function extractConsoleError(msg) {
  if (msg?.method === "Runtime.exceptionThrown") {
    return msg.params?.exceptionDetails?.exception?.description ?? "unknown";
  }
  if (msg?.method === "Runtime.consoleAPICalled" && msg.params?.type === "error") {
    return describeConsoleArgs(msg.params.args);
  }
  return null;
}
