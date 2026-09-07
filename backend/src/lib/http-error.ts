/**
 * An error that already knows which HTTP status it should become. Throw one
 * from any layer; the error handler in `app.ts` turns it into the response, so
 * a validator or service can reject a request without holding a `res`.
 *
 * Anything else that reaches the handler is an unexpected failure and becomes
 * a 500 — so never throw this for a bug.
 */
export class HttpError extends Error {
  readonly status: number;
  /** Machine-readable context for the client, e.g. Zod's flattened issues. */
  readonly details?: unknown;

  constructor(args: { message: string; status: number; details?: unknown; cause?: unknown }) {
    super(args.message, { cause: args.cause });
    this.name = "HttpError";
    this.status = args.status;
    this.details = args.details;
  }
}
