import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const books = sqliteTable("books", {
  owner: text("owner").primaryKey(),
  revision: integer("revision").notNull(),
  body: text("body").notNull(),
});
