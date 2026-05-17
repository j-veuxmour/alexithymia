import type {
  NarrativeClass,
  NarrativeClassification,
  NarrativeInput,
} from '../signal.types.js';

/**
 * Keyword library per narrative class. Lowercased; matched against
 * normalized tokens from the candidate's name/symbol/description.
 *
 * The library is deliberately small and conservative — this is a
 * deterministic baseline that the Strategist Manager LLM can override
 * with richer judgment. The intent is "rough sort" not "perfect tag".
 */
const NARRATIVE_KEYWORDS: Readonly<Record<Exclude<NarrativeClass, 'unknown'>, readonly string[]>> = {
  memecoin: [
    'meme',
    'memecoin',
    'pepe',
    'doge',
    'shib',
    'wojak',
    'cat',
    'dog',
    'frog',
    'inu',
  ],
  'ai-agent': [
    'ai',
    'agent',
    'gpt',
    'llm',
    'neural',
    'autonomous',
    'bot',
    'cortex',
    'inference',
  ],
  gaming: [
    'game',
    'gaming',
    'gamefi',
    'play',
    'p2e',
    'metaverse',
    'nft',
    'quest',
    'arena',
  ],
  defi: [
    'defi',
    'swap',
    'dex',
    'amm',
    'lending',
    'borrow',
    'yield',
    'farm',
    'stake',
    'vault',
    'perp',
    'perpetual',
  ],
  rwa: [
    'rwa',
    'realworld',
    'tbill',
    'treasury',
    'bond',
    'gold',
    'commodity',
    'tokenized',
  ],
};

/**
 * Tokenize free-form text to lowercased alphanumeric tokens.
 * Splits on any non-alphanumeric run; drops empty tokens.
 */
const tokenize = (input: string): readonly string[] => {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
};

/**
 * Count keyword hits against the candidate's text. Each keyword counts
 * at most once per class (set membership) — this prevents a token like
 * "doge" from artificially inflating "memecoin" when the description
 * repeats it.
 */
const countHits = (
  tokens: ReadonlySet<string>,
  keywords: readonly string[],
): { hits: number; matched: readonly string[] } => {
  const matched: string[] = [];
  for (const kw of keywords) {
    if (tokens.has(kw)) matched.push(kw);
  }
  return { hits: matched.length, matched };
};

/**
 * Rule-based narrative classifier. Pure, deterministic, no LLM.
 *
 * Algorithm:
 *   1. Tokenize concatenated name + symbol + description.
 *   2. For each known class, count distinct keyword hits.
 *   3. Pick the class with the most hits; on a tie, the order is the
 *      object-key declaration order of `NARRATIVE_KEYWORDS` (stable).
 *   4. Confidence = winnerHits / (winnerHits + runnerUpHits). When the
 *      winner is the only class with hits, confidence is 1. When no
 *      class hits any keyword, return `'unknown'` with confidence 0.
 *
 * `matchedKeywords` is sorted alphabetically for stable output.
 */
export const classifyNarrative = (input: NarrativeInput): NarrativeClassification => {
  const corpus = `${input.name ?? ''} ${input.symbol ?? ''} ${input.description ?? ''}`;
  const tokens = new Set(tokenize(corpus));

  if (tokens.size === 0) {
    return { class: 'unknown', confidence: 0, matchedKeywords: [] };
  }

  let winnerClass: Exclude<NarrativeClass, 'unknown'> | null = null;
  let winnerHits = 0;
  let winnerMatched: readonly string[] = [];
  let runnerUpHits = 0;

  // Object.entries preserves insertion order for string keys → ties resolve
  // to the first-declared class, which acts as the documented tiebreaker.
  for (const [cls, keywords] of Object.entries(NARRATIVE_KEYWORDS) as ReadonlyArray<
    [Exclude<NarrativeClass, 'unknown'>, readonly string[]]
  >) {
    const { hits, matched } = countHits(tokens, keywords);
    if (hits > winnerHits) {
      runnerUpHits = winnerHits;
      winnerHits = hits;
      winnerClass = cls;
      winnerMatched = matched;
    } else if (hits > runnerUpHits) {
      runnerUpHits = hits;
    }
  }

  if (winnerClass === null || winnerHits === 0) {
    return { class: 'unknown', confidence: 0, matchedKeywords: [] };
  }

  const confidence = winnerHits / (winnerHits + runnerUpHits);
  return {
    class: winnerClass,
    confidence,
    matchedKeywords: [...winnerMatched].sort(),
  };
};
