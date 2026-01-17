import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Game routers
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const { getOrCreateProfile } = await import("./db");
      return await getOrCreateProfile(ctx.user.id);
    }),
    initialize: protectedProcedure
      .input(z.object({ lat: z.number(), lng: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getOrCreateProfile } = await import("./db");
        return await getOrCreateProfile(ctx.user.id, input);
      }),
    updateSalt: protectedProcedure
      .input(z.object({ change: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { updateProfileSalt } = await import("./db");
        await updateProfileSalt(ctx.user.id, input.change);
        return { success: true };
      }),
  }),

  snails: router({
    getActive: protectedProcedure.query(async ({ ctx }) => {
      const { getActiveSnailsForUser } = await import("./db");
      return await getActiveSnailsForUser(ctx.user.id);
    }),
    deploy: protectedProcedure
      .input(
        z.object({
          receiverId: z.number(),
          encodedPolyline: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { createSnail } = await import("./db");
        return await createSnail({
          senderId: ctx.user.id,
          receiverId: input.receiverId,
          encodedPolyline: input.encodedPolyline,
          startTime: new Date(),
          status: "active",
        });
      }),
    capture: protectedProcedure
      .input(z.object({ snailId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { captureSnail, updateProfileSalt } = await import("./db");
        await captureSnail(input.snailId, ctx.user.id);
        await updateProfileSalt(ctx.user.id, 10); // Award 10 salt
        return { success: true, saltAwarded: 10 };
      }),
    breach: protectedProcedure
      .input(z.object({ snailId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { breachSnail } = await import("./db");
        await breachSnail(input.snailId);
        return { success: true };
      }),
  }),

  friends: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getFriendsForUser } = await import("./db");
      return await getFriendsForUser(ctx.user.id);
    }),
    add: protectedProcedure
      .input(z.object({ friendId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { addFriend } = await import("./db");
        await addFriend(ctx.user.id, input.friendId);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
