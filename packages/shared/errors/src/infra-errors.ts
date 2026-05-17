import { BaseError, type BaseErrorOptions } from './base-error.js';

/** Generic I/O failure (filesystem, network socket). */
export class IOError extends BaseError {
  constructor(message: string, options?: BaseErrorOptions) {
    super('IO_ERROR', message, options);
  }
}

/** An operation exceeded its allowed wall-clock budget. */
export class TimeoutError extends BaseError {
  constructor(message: string, options?: BaseErrorOptions) {
    super('TIMEOUT', message, options);
  }
}

/** A downstream service (RPC, REST API, exchange) returned an error or was unreachable. */
export class ExternalServiceError extends BaseError {
  constructor(message: string, options?: BaseErrorOptions) {
    super('EXTERNAL_SERVICE_ERROR', message, options);
  }
}

/** Serialization, encoding, or decoding failure (base58, JSON, msgpack). */
export class EncodingError extends BaseError {
  constructor(message: string, options?: BaseErrorOptions) {
    super('ENCODING_ERROR', message, options);
  }
}

/** Configuration is missing, malformed, or invalid. */
export class ConfigError extends BaseError {
  constructor(message: string, options?: BaseErrorOptions) {
    super('CONFIG_ERROR', message, options);
  }
}

/** Retry budget was exhausted before the operation succeeded. */
export class RetryExhaustedError extends BaseError {
  constructor(message: string, options?: BaseErrorOptions) {
    super('RETRY_EXHAUSTED', message, options);
  }
}

/** The operation was cancelled (typically via AbortSignal). */
export class CancelledError extends BaseError {
  constructor(message: string, options?: BaseErrorOptions) {
    super('CANCELLED', message, options);
  }
}
