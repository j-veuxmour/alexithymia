export type ErrorContext = Readonly<Record<string, unknown>>;

export interface BaseErrorOptions {
  readonly cause?: unknown;
  readonly context?: ErrorContext;
}

/**
 * Root of the ALEXITHYMIA error hierarchy.
 *
 * Subclasses set a stable, machine-readable `code` and inherit JSON
 * serialization. `cause` follows the ECMAScript `Error.cause` convention.
 */
export abstract class BaseError extends Error {
  public readonly code: string;
  public readonly context: ErrorContext;
  public override readonly cause: unknown;

  protected constructor(code: string, message: string, options?: BaseErrorOptions) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.cause = options?.cause;
    this.context = options?.context ?? {};
    Object.setPrototypeOf(this, new.target.prototype);
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, new.target);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      cause:
        this.cause instanceof Error
          ? { name: this.cause.name, message: this.cause.message }
          : this.cause,
    };
  }
}
