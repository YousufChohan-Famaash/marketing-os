/**
 * Monotonic client-side sequence for ordering the transcript.
 *
 * Messages and scope chips are stamped with `seq` the moment they enter the
 * store, so they render in true arrival order regardless of the server-provided
 * `timestamp` (which isn't guaranteed monotonic against client-stamped lead
 * bubbles). Display time still uses `timestamp`; ordering uses `seq`.
 */

let counter = 0;

export function nextSeq(): number {
  counter += 1;
  return counter;
}
