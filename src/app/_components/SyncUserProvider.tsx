"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { api } from "~/trpc/react";

export const SyncUserProvider = () => {
  const { user, isSignedIn } = useUser();
  const syncUser = api.users.sync.useMutation();

  useEffect(() => {
    if (isSignedIn && user) {
      syncUser.mutate({
        clerkId: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? "",
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
      });
    }
  }, [isSignedIn, user]);

  return null;
};
