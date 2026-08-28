// Merge fields. Pure text substitution, shared by the sending engine and
// by the editor that shows people which fields exist — so the hint in the
// app can never drift from what actually gets replaced.

/** Values a lesson's subject and body can be written against. */
export interface MergeValues {
  /** the recipient's first name — "there" when we don't have one */
  firstName?: string;
  name?: string;
  client?: string;
  sender?: string;
}

/**
 * Fill {{first_name}} and friends. Unknown fields are left standing so a
 * typo shows up in the test send instead of silently vanishing from a
 * real one.
 */
export function personalize(text: string, v: MergeValues): string {
  const table: Record<string, string | undefined> = {
    first_name: v.firstName || "there",
    firstname: v.firstName || "there",
    name: v.name,
    client: v.client,
    sender: v.sender,
  };
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, key: string) => {
    const value = table[key.toLowerCase()];
    return value === undefined ? whole : value;
  });
}

/** The merge fields, for the hint shown next to an email in the app. */
export const MERGE_FIELDS = [
  { token: "{{first_name}}", means: "the recipient's first name" },
  { token: "{{name}}", means: "their full name" },
  { token: "{{client}}", means: "their organisation" },
  { token: "{{sender}}", means: "who the email is from" },
];
