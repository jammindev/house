export function redactPII(text: string): string {
    if (!text) return "";

    const emailRedacted = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL_REDACTED]");
    const phoneRedacted = emailRedacted.replace(
        /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
        "[PHONE_REDACTED]"
    );

    return phoneRedacted;
}
