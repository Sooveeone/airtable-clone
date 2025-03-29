"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { api } from "~/trpc/react";

export const SyncUserProvider = () => {
  const { user, isSignedIn } = useUser();
  const syncUser = api.users.sync.useMutation();
  const hasSyncedRef = useRef(false); // ← prevents re-syncing

  useEffect(() => {
    if (!hasSyncedRef.current && isSignedIn && user) {
      syncUser.mutate({
        clerkId: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? "",
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
      });
      hasSyncedRef.current = true;
    }
  }, [isSignedIn, user, syncUser]);

  return null;
};
