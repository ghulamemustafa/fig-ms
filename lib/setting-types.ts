// Client-safe (no server-only imports): which settings hold "true"/"false"
// instead of a number, so both the API validation and the Settings UI agree.
export const BOOLEAN_SETTING_KEYS: ReadonlySet<string> = new Set(["requirePayoutApproval"]);
