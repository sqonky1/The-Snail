import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("profile procedures", () => {
  it("should initialize profile with coordinates", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const profile = await caller.profile.initialize({
      lat: 1.3521,
      lng: 103.8198,
    });

    expect(profile).toBeDefined();
    expect(profile?.userId).toBe(ctx.user!.id);
    expect(profile?.salt).toBe(0);
    expect(profile?.homeCoords).toBeDefined();
  });

  it("should get or create profile", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const profile = await caller.profile.get();

    expect(profile).toBeDefined();
  });
});

describe("snails procedures", () => {
  it("should get active snails for user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const snails = await caller.snails.getActive();

    expect(Array.isArray(snails)).toBe(true);
  });
});

describe("friends procedures", () => {
  it("should list friends for user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const friends = await caller.friends.list();

    expect(Array.isArray(friends)).toBe(true);
  });
});
