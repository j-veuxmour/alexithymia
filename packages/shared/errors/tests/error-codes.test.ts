import { describe, expect, it } from 'vitest';
import {
  BusinessRuleError,
  InvalidStateError,
  NotFoundError,
  PreconditionError,
  ValidationError,
} from '../src/domain-errors.js';
import {
  CancelledError,
  ConfigError,
  EncodingError,
  ExternalServiceError,
  IOError,
  RetryExhaustedError,
  TimeoutError,
} from '../src/infra-errors.js';

describe('error codes are stable', () => {
  const cases: ReadonlyArray<[new (m: string) => { code: string; name: string }, string, string]> =
    [
      [ValidationError, 'VALIDATION_ERROR', 'ValidationError'],
      [NotFoundError, 'NOT_FOUND', 'NotFoundError'],
      [InvalidStateError, 'INVALID_STATE', 'InvalidStateError'],
      [BusinessRuleError, 'BUSINESS_RULE_VIOLATION', 'BusinessRuleError'],
      [PreconditionError, 'PRECONDITION_FAILED', 'PreconditionError'],
      [IOError, 'IO_ERROR', 'IOError'],
      [TimeoutError, 'TIMEOUT', 'TimeoutError'],
      [ExternalServiceError, 'EXTERNAL_SERVICE_ERROR', 'ExternalServiceError'],
      [EncodingError, 'ENCODING_ERROR', 'EncodingError'],
      [ConfigError, 'CONFIG_ERROR', 'ConfigError'],
      [RetryExhaustedError, 'RETRY_EXHAUSTED', 'RetryExhaustedError'],
      [CancelledError, 'CANCELLED', 'CancelledError'],
    ];

  for (const [Ctor, code, name] of cases) {
    it(`${name} has code ${code}`, () => {
      const e = new Ctor('msg');
      expect(e.code).toBe(code);
      expect(e.name).toBe(name);
    });
  }
});
