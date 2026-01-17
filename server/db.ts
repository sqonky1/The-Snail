import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, profiles, snails, friendships, InsertSnail } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Game-specific queries

export async function getOrCreateProfile(userId: number, initialCoords?: { lat: number; lng: number }) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get profile: database not available");
    return undefined;
  }

  const result = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);

  if (result.length > 0) {
    return result[0];
  }

  // Create new profile with initial coordinates
  if (!initialCoords) {
    throw new Error("Initial coordinates required for new profile");
  }

  const insertResult = await db.insert(profiles).values({
    userId,
    salt: 0,
    homeCoords: JSON.stringify(initialCoords),
  });

  const newProfile = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return newProfile[0];
}

export async function updateProfileSalt(userId: number, saltChange: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update salt: database not available");
    return;
  }

  await db.execute(sql`UPDATE profiles SET salt = salt + ${saltChange} WHERE user_id = ${userId}`);
}

export async function getActiveSnailsForUser(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get snails: database not available");
    return [];
  }

  return await db.select().from(snails).where(
    sql`(sender_id = ${userId} OR receiver_id = ${userId}) AND status = 'active'`
  );
}

export async function createSnail(data: InsertSnail) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create snail: database not available");
    return undefined;
  }

  const result = await db.insert(snails).values(data);
  const insertId = Number(result[0].insertId);
  const newSnail = await db.select().from(snails).where(eq(snails.id, insertId)).limit(1);
  return newSnail[0];
}

export async function captureSnail(snailId: number, capturedBy: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot capture snail: database not available");
    return;
  }

  await db.update(snails).set({
    status: "captured",
    capturedBy,
    capturedAt: new Date(),
  }).where(eq(snails.id, snailId));
}

export async function breachSnail(snailId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot breach snail: database not available");
    return;
  }

  await db.update(snails).set({
    status: "breached",
  }).where(eq(snails.id, snailId));
}

export async function getFriendsForUser(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get friends: database not available");
    return [];
  }

  const result = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
  }).from(friendships)
    .innerJoin(users, eq(friendships.friendId, users.id))
    .where(eq(friendships.userId, userId));

  return result;
}

export async function addFriend(userId: number, friendId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot add friend: database not available");
    return;
  }

  await db.insert(friendships).values({
    userId,
    friendId,
  });
}
