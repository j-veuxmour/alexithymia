import { isErr, unwrap } from '@alexithymia/shared-errors';
import { describe, expect, it } from 'vitest';
import {
  checkConsecutiveLosses,
  checkDailyLossBreaker,
  checkDrawdownBreaker,
  checkKillSwitch,
  evaluateCircuitBreakers,
} from '../src/circuit-breakers.js';
import { makeBreakers, makeState } from './_fixtures.js';

describe('checkConsecutiveLosses', () => {
  it('passes when streak is below cap', () => {
    const r = unwrap(checkConsecutiveLosses(makeState({ consecutiveLosses: 3 }), makeBreakers()));
    expect(r.passed).toBe(true);
  });

  it('trips at the cap', () => {
    const r = unwrap(checkConsecutiveLosses(makeState({ consecutiveLosses: 5 }), makeBreakers()));
    expect(r.passed).toBe(false);
  });

  it('rejects negative streak', () => {
    expect(
      isErr(checkConsecutiveLosses(makeState({ consecutiveLosses: -1 }), makeBreakers())),
    ).toBe(true);
  });

  it('rejects non-integer cap', () => {
    expect(
      isErr(checkConsecutiveLosses(makeState(), makeBreakers({ maxConsecutiveLosses: 1.5 }))),
    ).toBe(true);
  });
});

describe('checkDailyLossBreaker', () => {
  it('passes below breaker', () => {
    const r = unwrap(
      checkDailyLossBreaker(
        makeState({ realizedDailyPnlLamports: -1_000_000_000n }),
        makeBreakers(),
      ),
    );
    expect(r.passed).toBe(true);
  });

  it('trips at or above breaker', () => {
    const r = unwrap(
      checkDailyLossBreaker(
        makeState({ realizedDailyPnlLamports: -10_000_000_000n }),
        makeBreakers(),
      ),
    );
    expect(r.passed).toBe(false);
  });

  it('positive PnL never trips', () => {
    const r = unwrap(
      checkDailyLossBreaker(
        makeState({ realizedDailyPnlLamports: 5_000_000_000n }),
        makeBreakers(),
      ),
    );
    expect(r.passed).toBe(true);
  });

  it('rejects negative breaker', () => {
    expect(
      isErr(checkDailyLossBreaker(makeState(), makeBreakers({ maxDailyLossLamports: -1n }))),
    ).toBe(true);
  });
});

describe('checkDrawdownBreaker', () => {
  it('passes below breaker', () => {
    // peak 100, current 90 → 1000 bps; breaker 3000
    const r = unwrap(
      checkDrawdownBreaker(
        makeState({ peakEquityLamports: 100n, totalEquityLamports: 90n }),
        makeBreakers(),
      ),
    );
    expect(r.passed).toBe(true);
  });

  it('trips at the breaker', () => {
    // peak 100, current 70 → 3000 bps == breaker (uses < so equal trips)
    const r = unwrap(
      checkDrawdownBreaker(
        makeState({ peakEquityLamports: 100n, totalEquityLamports: 70n }),
        makeBreakers(),
      ),
    );
    expect(r.passed).toBe(false);
  });

  it('disarmed when peak equity is zero', () => {
    const r = unwrap(
      checkDrawdownBreaker(
        makeState({ peakEquityLamports: 0n, totalEquityLamports: 0n }),
        makeBreakers(),
      ),
    );
    expect(r.passed).toBe(true);
  });

  it('rejects invalid breaker bps and negative equity/peak', () => {
    expect(isErr(checkDrawdownBreaker(makeState(), makeBreakers({ maxDrawdownBps: 10_001 })))).toBe(
      true,
    );
    expect(
      isErr(checkDrawdownBreaker(makeState({ totalEquityLamports: -1n }), makeBreakers())),
    ).toBe(true);
    expect(
      isErr(checkDrawdownBreaker(makeState({ peakEquityLamports: -1n }), makeBreakers())),
    ).toBe(true);
  });

  it('clamps drop at zero when current exceeds peak', () => {
    const r = unwrap(
      checkDrawdownBreaker(
        makeState({ peakEquityLamports: 50n, totalEquityLamports: 60n }),
        makeBreakers(),
      ),
    );
    expect(r.passed).toBe(true);
    expect(r.context.ddBps).toBe(0);
  });
});

describe('checkKillSwitch', () => {
  it('passes when switch inactive', () => {
    expect(checkKillSwitch(makeState({ killSwitchActive: false })).passed).toBe(true);
  });
  it('denies when switch active', () => {
    expect(checkKillSwitch(makeState({ killSwitchActive: true })).passed).toBe(false);
  });
});

describe('evaluateCircuitBreakers', () => {
  it('returns the four breakers in order', () => {
    const r = unwrap(evaluateCircuitBreakers(makeState(), makeBreakers()));
    expect(r.map((c) => c.id)).toEqual([
      'circuit.consecutive-losses',
      'circuit.daily-loss',
      'circuit.drawdown',
      'circuit.kill-switch',
    ]);
  });

  it('short-circuits on first invalid input', () => {
    expect(
      isErr(evaluateCircuitBreakers(makeState({ consecutiveLosses: -1 }), makeBreakers())),
    ).toBe(true);
  });

  it('propagates Err from daily-loss breaker', () => {
    expect(
      isErr(evaluateCircuitBreakers(makeState(), makeBreakers({ maxDailyLossLamports: -1n }))),
    ).toBe(true);
  });

  it('propagates Err from drawdown breaker', () => {
    expect(
      isErr(evaluateCircuitBreakers(makeState(), makeBreakers({ maxDrawdownBps: 10_001 }))),
    ).toBe(true);
  });
});
