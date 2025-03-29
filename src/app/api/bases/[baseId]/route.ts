import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";

export async function GET(
  req: Request,
  { params }: { params: { baseId: string } },
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the app user from DB (by clerkId)
    const user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get the base with its tables, columns, and rows
    const base = await db.base.findUnique({
      where: {
        id: params.baseId,
        userId: user.id, // Ensure the base belongs to this user
      },
      include: {
        tables: {
          include: {
            columns: true,
            rows: true,
          },
        },
      },
    });

    if (!base) {
      return NextResponse.json({ error: "Base not found" }, { status: 404 });
    }

    return NextResponse.json(base);
  } catch (error) {
    console.error("Error fetching base:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { baseId: string } },
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { clerkId: userId },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const base = await db.base.findFirst({
    where: {
      id: params.baseId,
      userId: user.id,
    },
  });

  if (!base) {
    return NextResponse.json({ error: "Base not found" }, { status: 404 });
  }

  await db.base.delete({
    where: {
      id: base.id,
    },
  });

  return NextResponse.json({ success: true });
}
