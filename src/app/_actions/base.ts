"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "~/server/db";
import { revalidatePath } from "next/cache";
import type { Base } from "~/app/_types/base";

export async function createBase(name: string) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  if (!name.trim()) {
    throw new Error("Base name is required");
  }

  try {
    // Create a new base in the database
    const base = await db.base.create({
      data: {
        name,
        userId,
      },
    });

    // Revalidate the homepage to show the new base
    revalidatePath("/");

    return { success: true, base };
  } catch (error) {
    console.error("Error creating base:", error);
    throw new Error("Failed to create base");
  }
}

export async function getBases(): Promise<Base[]> {
  const { userId } = await auth();

  if (!userId) return [];

  const user = await db.user.findUnique({
    where: { clerkId: userId },
  });

  if (!user) return [];

  const bases = await db.base.findMany({
    where: { userId: user.id },
  });

  return bases as Base[];
}
