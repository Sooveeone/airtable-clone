import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { clerkId: userId }, // ✅ always lookup by clerkId
    });

    if (!user) {
      return NextResponse.json([], { status: 200 }); // No user, no bases
    }

    const bases = await db.base.findMany({
      where: {
        userId: user.id,
      },
    });

    return NextResponse.json(bases);
  } catch (error) {
    console.error("Error fetching bases:", error);
    return NextResponse.json(
      { error: "Failed to fetch bases" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { clerkId: userId }, // ✅ correct user lookup
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const base = await db.base.create({
      data: {
        name,
        userId: user.id,
      },
    });

    return NextResponse.json(base);
  } catch (error) {
    console.error("Error creating base:", error);
    return NextResponse.json(
      { error: "Failed to create base" },
      { status: 500 },
    );
  }
}
