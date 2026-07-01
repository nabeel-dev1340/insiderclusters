// Auth constants with NO imports — safe to use from `proxy.ts`, which must not
// pull in the DB layer (`pg`) or other server-only modules.

export const SESSION_COOKIE = "ic_session";
