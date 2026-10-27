
import { getDb } from "./index";

export async function getName(): Promise<string | null> {
const db=await getDb();
const row=await db.getFirstAsync<{ display_name: string | null }>(
"SELECT display_name FROM settings WHERE id = 1",
);
const name=row?.display_name?.trim();
return name ? name : null;
}

export async function setName(name: string): Promise<string | null> {
const db=await getDb();
const clean=name.trim().slice(0, 40);
await db.runAsync(
"UPDATE settings SET display_name = ?, updated_at = ? WHERE id = 1",
clean || null,
new Date().toISOString(),
);
return clean || null;
}
