/**
 * Shapes shared by every route. Domain-specific request and response types
 * live next to their domain (`./task`, `./developer`, `./skill`).
 */

/** Body of every non-2xx response: `{ error, details }` at the error's status. */
export type ErrorResponse = { error: string; details?: unknown };
