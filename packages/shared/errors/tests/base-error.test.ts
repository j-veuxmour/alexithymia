import { describe, expect, it } from 'vitest';
import { BaseError } from '../src/base-error.js';
import { ValidationError } from '../src/domain-errors.js';

class TestError extends BaseError {
  constructor(message: string, options?: { cause?: unknown; context?: Record<string, unknown> }) {
    super('TEST_ERROR', message, options);
  }
}

describe('BaseError', () => {
  it('sets name, code, message, and empty context by default', () => {
    const e = new TestError('boom');
    expect(e.name).toBe('TestError');
    expect(e.code).toBe('TEST_ERROR');
    expect(e.message).toBe('boom');
    expect(e.context).toEqual({});
  });

  it('preserves cause and context', () => {
    const cause = new Error('original');
    const e = new TestError('wrapped', { cause, context: { positionId: 'p1' } });
    expect(e.cause).toBe(cause);
    expect(e.context).toEqual({ positionId: 'p1' });
  });

  it('is an instance of Error and its subclass', () => {
    const e = new TestError('x');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(BaseError);
    expect(e).toBeInstanceOf(TestError);
  });

  it('serializes via toJSON', () => {
    const cause = new Error('underlying');
    const e = new TestError('msg', { cause, context: { a: 1 } });
    const json = e.toJSON();
    expect(json).toMatchObject({
      name: 'TestError',
      code: 'TEST_ERROR',
      message: 'msg',
      context: { a: 1 },
      cause: { name: 'Error', message: 'underlying' },
    });
  });

  it('captures a stack trace', () => {
    const e = new TestError('s');
    expect(typeof e.stack).toBe('string');
    expect(e.stack).toContain('TestError');
  });

  it('domain error subclasses set their own code', () => {
    const e = new ValidationError('bad input');
    expect(e.code).toBe('VALIDATION_ERROR');
    expect(e.name).toBe('ValidationError');
  });
});
