import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { Contact } from "~/lib/contacts";
import type { Db } from "../client.server";
import { contact } from "../schema";

export function contactsFor(db: Db, userId: string, applicationId: string) {
  return db
    .select()
    .from(contact)
    .where(and(eq(contact.userId, userId), eq(contact.applicationId, applicationId)))
    .orderBy(asc(contact.createdAt), asc(contact.name));
}

export function contactCounts(db: Db, userId: string) {
  return db
    .select({ applicationId: contact.applicationId, count: sql<number>`count(*)` })
    .from(contact)
    .where(eq(contact.userId, userId))
    .groupBy(contact.applicationId);
}

export function saveContacts(db: Db, userId: string, applicationId: string, contacts: Contact[], source: string) {
  const createdAt = new Date().toISOString();
  return db
    .insert(contact)
    .values(
      contacts.map(({ name, profileUrl, degree, headline, note }) => ({
        id: crypto.randomUUID(),
        userId,
        applicationId,
        name,
        profileUrl,
        degree,
        headline,
        note,
        source,
        createdAt,
      })),
    )
    .onConflictDoUpdate({
      target: [contact.applicationId, contact.profileUrl],
      targetWhere: sql`${contact.profileUrl} <> ''`,
      set: {
        name: sql`excluded.name`,
        degree: sql`excluded.degree`,
        headline: sql`excluded.headline`,
        note: sql`excluded.note`,
      },
    });
}

export interface FoundPerson {
  leadId: string;
  name: string;
  title: string;
}

export function saveFoundPeople(db: Db, userId: string, applicationId: string, people: FoundPerson[]) {
  const createdAt = new Date().toISOString();
  return db
    .insert(contact)
    .values(people.map(({ leadId, name, title }) => ({ id: crypto.randomUUID(), userId, applicationId, leadId, name, headline: title, source: "search", createdAt })))
    .onConflictDoNothing();
}

export function clearUnusedSearchResults(db: Db, userId: string, applicationId: string) {
  return db
    .delete(contact)
    .where(and(eq(contact.userId, userId), eq(contact.applicationId, applicationId), eq(contact.source, "search"), isNull(contact.email)));
}

export function setContactEmail(db: Db, userId: string, contactId: string, email: string | null, emailStatus: string, emailSource: string) {
  return db
    .update(contact)
    .set({ email, emailStatus, emailSource, emailCheckedAt: new Date().toISOString() })
    .where(and(eq(contact.id, contactId), eq(contact.userId, userId)));
}
