// 最小のテストランナー。テストランナー (vitest/playwright test 等) には
// 依存せず、各テストを順に実行し失敗したものだけ1回リトライする。
//
// 1回までのリトライはタイミング起因の揺れを吸収するための保険であり、
// 実装バグは (毎回失敗するはずなので) リトライしても最終的に失敗として
// 報告される。

/**
 * @param {{name: string, run: () => Promise<void>}[]} tests
 * @returns {Promise<{name: string, passed: boolean, attempts: number, durationMs: number, error: unknown}[]>}
 */
export async function runSuite(tests) {
  const results = [];
  for (const test of tests) {
    const start = Date.now();
    let lastError = null;
    let passed = false;
    let attempts = 0;
    for (let attempt = 1; attempt <= 2 && !passed; attempt++) {
      attempts = attempt;
      try {
        await test.run();
        passed = true;
      } catch (e) {
        lastError = e;
        if (attempt === 1) {
          console.warn(`  [e2e] "${test.name}" が1回目の実行で失敗、リトライします: ${e && e.message}`);
        }
      }
    }
    const durationMs = Date.now() - start;
    results.push({ name: test.name, passed, attempts, durationMs, error: passed ? null : lastError });
    const attemptsNote = attempts > 1 ? ` (${attempts}回目で成功)` : "";
    if (passed) {
      console.log(`✓ PASS  ${test.name}${attemptsNote}  [${durationMs}ms]`);
    } else {
      console.log(`✗ FAIL  ${test.name}  [${durationMs}ms]`);
      console.log(`        ${(lastError && lastError.stack) || lastError}`);
    }
  }
  return results;
}
