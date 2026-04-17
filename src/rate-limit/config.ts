/** User-facing copy when the free tier is exhausted (keep in sync with widget fallback). */
export function rateLimitMessage(contactEmail: string): string {
  return (
    `Eagles Assistant: You've reached the limit for this bot. ` +
    `Please contact ${contactEmail} for more uses.`
  );
}
