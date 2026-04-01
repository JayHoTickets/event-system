/**
 * Complimentary limits configuration
 * Reads a global limit from environment variable COMPLIMENTARY_GLOBAL_LIMIT
 * If not set or not a positive integer, returns null (no global limit).
 */
const raw = process.env.COMPLIMENTARY_GLOBAL_LIMIT;
let GLOBAL_LIMIT = null;
if (raw) {
    const n = parseInt(String(raw), 10);
    if (!isNaN(n) && n > 0) GLOBAL_LIMIT = n;
}

export { GLOBAL_LIMIT };
