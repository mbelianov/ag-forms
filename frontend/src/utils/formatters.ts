/**
 * Date and number formatting utilities shared across all pages.
 * TASK-025: Extracted from inline formatDate functions that were duplicated in 6+ places.
 * TASK-027: Uses date-fns for all date operations.
 */

import { format, parseISO, isValid } from 'date-fns';

/**
 * Format an ISO date string as a long date.
 * e.g. "June 12, 2026"
 */
export function formatDate(iso: string): string {
  try {
    const d = parseISO(iso);
    if (!isValid(d)) return iso;
    return format(d, 'MMMM d, yyyy');
  } catch {
    return iso;
  }
}

/**
 * Format an ISO date string as a short date.
 * e.g. "Jun 12, 2026"
 */
export function formatDateShort(iso: string): string {
  try {
    const d = parseISO(iso);
    if (!isValid(d)) return iso;
    return format(d, 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

/**
 * Format an ISO datetime string with time.
 * e.g. "June 12, 2026 at 10:30 AM"
 */
export function formatDateTime(iso: string): string {
  try {
    const d = parseISO(iso);
    if (!isValid(d)) return iso;
    return format(d, "MMMM d, yyyy, hh:mm a");
  } catch {
    return iso;
  }
}

/**
 * Format a YYYY-MM-DD date string for display.
 * Unlike the above functions this handles plain date strings that are NOT ISO
 * timestamps (no timezone offset applied).
 * e.g. "2026-06-12" → "Jun 12, 2026"
 */
export function formatPlainDate(yyyymmdd: string): string {
  if (!yyyymmdd) return '';
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  if (!y || !m || !d) return yyyymmdd;
  // Construct date in local time to avoid UTC offset shifting the day
  const date = new Date(y, m - 1, d);
  return format(date, 'MMM d, yyyy');
}

// Made with Bob
