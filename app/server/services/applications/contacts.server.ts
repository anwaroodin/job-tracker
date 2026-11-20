import type { Contact } from "~/lib/contacts";
import type { Db } from "../../db/client.server";
import { contactsFor, saveContacts } from "../../db/queries/contacts.server";

export type ContactSource = "linkedin" | "people" | "search";

export async function addContacts(db: Db, userId: string, applicationId: string, contacts: Contact[], source: ContactSource) {
  if (contacts.length) await saveContacts(db, userId, applicationId, contacts, source);
}

export async function withContactsJson<T extends { id: string }>(db: Db, userId: string, application: T | null) {
  if (!application) return null;
  const contacts = await contactsFor(db, userId, application.id);
  return { ...application, contactsJson: JSON.stringify(contacts.map(({ name, profileUrl }) => ({ name, profileUrl }))) };
}
