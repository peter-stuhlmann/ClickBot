const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids from URLs or forms are checked before they reach Postgres, which rejects non-UUIDs loudly. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
