"use client";

import { useState } from "react";

import { useAuth } from "@/app/components/auth-provider";
import { EditProfileModal } from "@/app/components/edit-profile-modal";
import { getUserInitial, getUserLabel } from "@/lib/auth/access";

export function ProfileCard() {
  const { user, status } = useAuth();
  const [open, setOpen] = useState(false);

  const isReady = status === "authenticated" && user;

  return (
    <section className="profile-card surface-card">
      <div className="profile-card-row">
        <div className="profile-card-avatar" aria-hidden="true">
          {getUserInitial(user)}
        </div>
        <div className="profile-card-meta">
          <h2>{isReady ? getUserLabel(user) : "Loading..."}</h2>
          <p className="profile-card-email">
            {user?.email ?? " "}
            {user && !user.emailVerified ? (
              <span className="profile-card-pill">Unverified</span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          className="primary-pill"
          onClick={() => setOpen(true)}
          disabled={!isReady}
        >
          Edit profile
        </button>
      </div>

      <EditProfileModal open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
