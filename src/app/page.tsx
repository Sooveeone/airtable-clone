import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

export default async function HomePage() {
  const { userId } = await auth();

  // Redirect if user is NOT authenticated
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <h1>Welcome to your Airtable Clone Dashboard!</h1>
      <UserButton />
    </div>
  );
}
