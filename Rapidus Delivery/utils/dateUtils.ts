/**
 * Utility functions for handling Brasília timezone (UTC-3) dates and times.
 */

/**
 * Returns a YYYY-MM-DD date string for the given date in Brasília time.
 */
export const getBrasiliaDateString = (date = new Date()) => {
    return new Intl.DateTimeFormat('fr-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
};

/**
 * Returns the ISO string for the start of the day (00:00:00) in Brasília time.
 */
export const getBrasiliaStartOfDay = (dateStr: string) => {
    // dateStr is expected to be YYYY-MM-DD
    return new Date(`${dateStr}T00:00:00-03:00`).toISOString();
};

/**
 * Returns the ISO string for the end of the day (23:59:59) in Brasília time.
 */
export const getBrasiliaEndOfDay = (dateStr: string) => {
    // dateStr is expected to be YYYY-MM-DD
    return new Date(`${dateStr}T23:59:59-03:00`).toISOString();
};

/**
 * Converts a date to a Brasília date string for comparison.
 */
export const toBrasiliaDateString = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('fr-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(d);
};
