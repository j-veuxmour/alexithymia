import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DecisionSchema } from '../src/entities/decision.entity.js';
import { LessonSchema } from '../src/entities/lesson.entity.js';
import { PoolSchema } from '../src/entities/pool.entity.js';
import { PositionSchema } from '../src/entities/position.entity.js';
import { SignalSnapshotSchema } from '../src/entities/signal-snapshot.entity.js';
import { WalletSchema } from '../src/entities/wallet.entity.js';

const PUBKEY = 'So11111111111111111111111111111111111111112';
const SIG =
  '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';
const ISO = '2026-05-17T12:00:00.000Z';

describe('PositionSchema', () => {
  it('parses a valid row and coerces bigints / dates', () => {
    const parsed = PositionSchema.parse({
      id: randomUUID(),
      poolAddress: PUBKEY,
      ownerWallet: PUBKEY,
      status: 'open',
      lowerBinId: -10,
      upperBinId: 10,
      costBasisLamports: '1000000000',
      baseTokenAmount: '500',
      quoteTokenAmount: '500',
      openedAt: ISO,
      closedAt: null,
      openTxSignature: SIG,
      closeTxSignature: null,
      strategyId: null,
    });
    expect(typeof parsed.costBasisLamports).toBe('bigint');
    expect(parsed.openedAt).toBeInstanceOf(Date);
    expect(parsed.metadata).toEqual({});
  });

  it('rejects negative cost basis', () => {
    const result = PositionSchema.safeParse({
      id: randomUUID(),
      poolAddress: PUBKEY,
      ownerWallet: PUBKEY,
      status: 'open',
      lowerBinId: 0,
      upperBinId: 0,
      costBasisLamports: -1n,
      baseTokenAmount: 0n,
      quoteTokenAmount: 0n,
      openedAt: ISO,
      closedAt: null,
      openTxSignature: null,
      closeTxSignature: null,
      strategyId: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('PoolSchema', () => {
  it('parses a valid pool', () => {
    const parsed = PoolSchema.parse({
      address: PUBKEY,
      baseMint: PUBKEY,
      quoteMint: PUBKEY,
      baseDecimals: 9,
      quoteDecimals: 6,
      binStep: 25,
      baseFeeBps: 30,
      protocolFeeBps: 5,
      tvlLamports: 1_000_000_000n,
      volume24hLamports: 2_000_000_000n,
      createdAt: ISO,
      discoveredAt: ISO,
      source: 'meteora',
    });
    expect(parsed.binStep).toBe(25);
  });
});

describe('WalletSchema', () => {
  it('parses minimal wallet metadata', () => {
    const parsed = WalletSchema.parse({
      id: randomUUID(),
      address: PUBKEY,
      label: 'primary',
      kmsKeyRef: null,
      createdAt: ISO,
    });
    expect(parsed.label).toBe('primary');
  });

  it('rejects empty label', () => {
    expect(
      WalletSchema.safeParse({
        id: randomUUID(),
        address: PUBKEY,
        label: '',
        kmsKeyRef: null,
        createdAt: ISO,
      }).success,
    ).toBe(false);
  });
});

describe('DecisionSchema', () => {
  it('parses a decision with required reasoning', () => {
    const parsed = DecisionSchema.parse({
      id: randomUUID(),
      agentKind: 'analyst-manager',
      action: 'deploy',
      subjectId: PUBKEY,
      reasoning: 'high score + favorable regime',
      modelTier: 'premium',
      confidence: 0.82,
      createdAt: ISO,
    });
    expect(parsed.risks).toEqual([]);
    expect(parsed.rejectedAlternatives).toEqual([]);
    expect(parsed.metadata).toEqual({});
  });

  it('rejects an unknown agent kind', () => {
    expect(
      DecisionSchema.safeParse({
        id: randomUUID(),
        agentKind: 'nope',
        action: 'deploy',
        subjectId: 'x',
        reasoning: 'r',
        modelTier: null,
        confidence: null,
        createdAt: ISO,
      }).success,
    ).toBe(false);
  });
});

describe('LessonSchema', () => {
  it('parses with statistical backing', () => {
    const parsed = LessonSchema.parse({
      id: randomUUID(),
      scope: 'range-sizing',
      statement: 'tighter ranges underperform in trending regimes',
      statisticalBacking: {
        sampleSize: 42,
        pValue: 0.03,
        effectSize: 0.4,
        method: 'mann-whitney',
      },
      createdAt: ISO,
      retiredAt: null,
    });
    expect(parsed.active).toBe(true);
    expect(parsed.sourceDecisionIds).toEqual([]);
  });
});

describe('SignalSnapshotSchema', () => {
  it('parses a snapshot with arbitrary signal record', () => {
    const parsed = SignalSnapshotSchema.parse({
      id: randomUUID(),
      poolAddress: PUBKEY,
      capturedAt: ISO,
      score: 0.71,
      signals: { momentum: 0.5, depth: 0.8 },
      regime: 'risk-on',
    });
    expect(parsed.signals.momentum).toBe(0.5);
  });
});
