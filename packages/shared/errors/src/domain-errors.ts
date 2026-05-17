import { BaseError, type BaseErrorOptions } from './base-error.js';

/**
 * Input failed validation (shape, range, format).
 * Carries the offending value via `context` when relevant.
 */
export class ValidationError extends BaseError {
  constructor(message: string, options?: BaseErrorOptions) {
    super('VALIDATION_ERROR', message, options);
  }
}

/** Lookup missed — the requested entity does not exist. */
export class NotFoundError extends BaseError {
  constructor(message: string, options?: BaseErrorOptions) {
    super('NOT_FOUND', message, options);
  }
}

/** An operation was attempted that is illegal for the current entity state. */
export class InvalidStateError extends BaseError {
  constructor(message: string, options?: BaseErrorOptions) {
    super('INVALID_STATE', message, options);
  }
}

/** A domain invariant or policy was violated. */
export class BusinessRuleError extends BaseError {
  constructor(message: string, options?: BaseErrorOptions) {
    super('BUSINESS_RULE_VIOLATION', message, options);
  }
}

/** A required precondition was not met before invocation. */
export class PreconditionError extends BaseError {
  constructor(message: string, options?: BaseErrorOptions) {
    super('PRECONDITION_FAILED', message, options);
  }
}
