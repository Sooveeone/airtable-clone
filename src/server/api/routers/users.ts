import { z } from "zod";
import { db } from "@/server/db";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

const generateUniqueUsername = async (): Promise<string> => {
  let username = "";
  let isUnique = false;

  while (!isUnique) {
    username = `user_${Math.floor(Math.random() * 10000)}`;
    const existing = await db.user.findUnique({ where: { username } });
    if (!existing) isUnique = true;
  }

  return username;
};

export const usersRouter = createTRPCRouter({
  sync: publicProcedure
    .input(
      z.object({
        clerkId: z.string(),
        email: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const existingUser = await db.user.findUnique({
        where: { clerkId: input.clerkId },
      });

      if (existingUser) return existingUser;

      const newUser = await db.user.create({
        data: {
          clerkId: input.clerkId,
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          username: await generateUniqueUsername(),
        },
      });

      return newUser;
    }),
});
