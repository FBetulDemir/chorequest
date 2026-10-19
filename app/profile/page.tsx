"use client";

import React, { useState } from "react";
import clsx from "clsx";
import { BarChart3, Bell, BellRing, CalendarRange, History, House, KeyRound, LogOut, Monitor, Moon, Sun, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import RequireAuth from "@/src/components/RequireAuth";
import { useAuth } from "@/src/components/AuthProvider";
import { useReadyHousehold } from "@/src/components/HouseholdProvider";
import { useFeedback } from "@/src/components/ui/Feedback";
import { Button } from "@/src/components/ui/Button";
import { Avatar, Card, ListRow, Segmented, SectionTitle, Switch } from "@/src/components/ui/Display";
import { ConfirmSheet, Sheet } from "@/src/components/ui/Sheet";
import { updateUserProfile } from "@/src/lib/profile";
import { AVATAR_EMOJIS } from "@/src/lib/choreCatalog";
import { useThemePreference, type ThemePreference } from "@/src/lib/theme";
import { friendlyError } from "@/src/lib/errors";
import { applyReminder, loadReminder, remindersSupported, type ReminderSettings } from "@/src/lib/reminders";
import { PUSH_CONFIGURED, disablePush, enablePush, savedPushToken } from "@/src/lib/push";
import { isNative } from "@/src/lib/native";
import { analyticsAvailable, hasAnalyticsConsent, setAnalyticsConsent } from "@/src/lib/analytics";
import { deleteAccount, isOnlyMember, signInMethod } from "@/src/lib/account";
import { isCancelled } from "@/src/lib/socialAuth";

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileInner />
    </RequireAuth>
  );
}

function ProfileInner() {
  const { user, signOut, resetPassword } = useAuth();
  const { uid, profile, household } = useReadyHousehold();
  const { toast } = useFeedback();
  const { preference, setPreference } = useThemePreference();

  const [editing, setEditing] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const name = profile?.name ?? "";
  const email = user?.email ?? profile?.email ?? "";

  async function sendReset() {
    if (!email) return;
    try {
      await resetPassword(email);
      toast(`Password reset link sent to ${email}`);
    } catch (e) {
      toast(friendlyError(e), { tone: "error" });
    }
  }

  async function doSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } catch (e) {
      toast(friendlyError(e), { tone: "error" });
      setSigningOut(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {/* Identity */}
      <Card className="flex flex-col items-center p-6 text-center">
        <Avatar uid={uid} name={name || "?"} emoji={profile?.avatar} size={84} />
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink">{name}</h1>
        <p className="text-sm text-muted">{email}</p>
        <Button size="sm" className="mt-4" onClick={() => setEditing(true)}>
          Edit profile
        </Button>
      </Card>

      {/* Appearance */}
      <section className="space-y-3">
        <SectionTitle>Appearance</SectionTitle>
        <Segmented<ThemePreference>
          label="Theme"
          value={preference}
          onChange={setPreference}
          options={[
            { value: "system", label: <span className="inline-flex items-center gap-1.5"><Monitor size={15} aria-hidden="true" /> System</span> },
            { value: "light", label: <span className="inline-flex items-center gap-1.5"><Sun size={15} aria-hidden="true" /> Light</span> },
            { value: "dark", label: <span className="inline-flex items-center gap-1.5"><Moon size={15} aria-hidden="true" /> Dark</span> },
          ]}
        />
      </section>

      <RemindersSection />

      {/* Shortcuts */}
      <section className="space-y-3">
        <SectionTitle>Your household</SectionTitle>
        <Card className="divide-y divide-line overflow-hidden">
          <ListRow href="/household" icon={<House size={18} />} title={household.name} description="Members, invite code and chores" />
          <ListRow href="/history" icon={<History size={18} />} title="Activity history" description="Everything that was completed or skipped" />
          <ListRow href="/score/history" icon={<CalendarRange size={18} />} title="Monthly scores" description="Every month's leaderboard" />
        </Card>
      </section>

      <PrivacySection />

      {/* Account */}
      <section className="space-y-3">
        <SectionTitle>Account</SectionTitle>
        <Card className="divide-y divide-line overflow-hidden">
          <ListRow icon={<KeyRound size={18} />} title="Change password" description="We'll email you a reset link" onClick={sendReset} />
          <ListRow icon={<LogOut size={18} />} title="Sign out" onClick={() => setConfirmSignOut(true)} danger right={<span />} />
          <ListRow
            icon={<Trash2 size={18} />}
            title="Delete account"
            description="Permanently remove your account and data"
            onClick={() => setDeleting(true)}
            danger
          />
        </Card>
      </section>

      <p className="pb-4 text-center text-xs text-faint">ChoreQuest 0.2 · Made with 💜</p>

      {deleting ? <DeleteAccountSheet onClose={() => setDeleting(false)} /> : null}

      {editing ? <EditProfileSheet uid={uid} name={name} avatar={profile?.avatar ?? null} onClose={() => setEditing(false)} /> : null}

      <ConfirmSheet
        open={confirmSignOut}
        title="Sign out?"
        message="You can sign back in any time with your email and password."
        confirmLabel="Sign out"
        busy={signingOut}
        onConfirm={doSignOut}
        onCancel={() => setConfirmSignOut(false)}
      />
    </div>
  );
}

function EditProfileSheet({
  uid,
  name: initialName,
  avatar: initialAvatar,
  onClose,
}: {
  uid: string;
  name: string;
  avatar: string | null;
  onClose: () => void;
}) {
  const { toast } = useFeedback();
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState<string | null>(initialAvatar);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await updateUserProfile(uid, { name: name.trim(), avatar });
      toast("Profile saved ✓");
      onClose();
    } catch (e) {
      setError(friendlyError(e, "Couldn't save your profile."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Edit profile"
      footer={
        <Button variant="primary" block onClick={save} loading={busy} disabled={!name.trim()}>
          Save
        </Button>
      }>
      <div className="space-y-5">
        <div className="flex justify-center">
          <Avatar uid={uid} name={name || "?"} emoji={avatar} size={72} />
        </div>
        <div>
          <label htmlFor="profile-name" className="mb-2 block text-sm font-bold text-ink">
            Your name
          </label>
          <input
            id="profile-name"
            className="cq-input"
            value={name}
            maxLength={30}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-ink">Avatar</legend>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
            <button
              type="button"
              onClick={() => setAvatar(null)}
              aria-pressed={avatar === null}
              className={clsx(
                "grid aspect-square place-items-center rounded-2xl border text-xs font-extrabold transition",
                avatar === null ? "border-brand bg-brand-soft text-brand-strong" : "border-line text-muted hover:border-brand",
              )}>
              Aa
            </button>
            {AVATAR_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setAvatar(e)}
                aria-label={`Use ${e} as avatar`}
                aria-pressed={avatar === e}
                className={clsx(
                  "grid aspect-square place-items-center rounded-2xl border text-2xl transition",
                  avatar === e ? "border-brand bg-brand-soft" : "border-line hover:border-brand",
                )}>
                {e}
              </button>
            ))}
          </div>
        </fieldset>
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      </div>
    </Sheet>
  );
}

function RemindersSection() {
  const { toast } = useFeedback();
  const { uid } = useReadyHousehold();
  const [pushOn, setPushOn] = useState(() => !!savedPushToken());
  const [pushBusy, setPushBusy] = useState(false);
  const pushAvailable = isNative() && PUSH_CONFIGURED;

  async function togglePush(next: boolean) {
    setPushBusy(true);
    try {
      if (!next) {
        await disablePush(uid);
        setPushOn(false);
        return;
      }
      const result = await enablePush(uid);
      setPushOn(result === "enabled");
      if (result === "enabled") toast("You'll hear when your household gets things done 🔔");
      else if (result === "denied") toast("Notifications are off for ChoreQuest. Turn them on in your phone's Settings.", { tone: "error" });
      else toast("Couldn't turn on notifications. Please try again.", { tone: "error" });
    } finally {
      setPushBusy(false);
    }
  }
  // Profile only renders in the browser (behind RequireAuth), so local storage is available
  const [settings, setSettings] = useState<ReminderSettings>(() => loadReminder());
  const supported = remindersSupported();

  async function update(next: ReminderSettings) {
    setSettings(next);
    try {
      const result = await applyReminder(next);
      if (result === "denied") {
        setSettings({ ...next, enabled: false });
        toast("Notifications are off for ChoreQuest. Turn them on in your phone's Settings.", { tone: "error" });
      } else if (result === "scheduled") {
        toast(`Daily reminder set for ${next.time} ⏰`);
      }
    } catch {
      toast("Couldn't set the reminder. Please try again.", { tone: "error" });
    }
  }

  return (
    <section className="space-y-3">
      <SectionTitle>Reminders</SectionTitle>
      <Card className="divide-y divide-line overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-strong" aria-hidden="true">
            <Bell size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-ink">Daily reminder</div>
            <div className="text-xs text-muted">
              {supported ? "A nudge to check today's chores" : "Available in the ChoreQuest app for iPhone and Android"}
            </div>
          </div>
          <Switch
            label="Daily reminder"
            checked={supported && settings.enabled}
            disabled={!supported}
            onChange={(enabled) => update({ ...settings, enabled })}
          />
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-strong" aria-hidden="true">
            <BellRing size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-ink">Household activity</div>
            <div className="text-xs text-muted">
              {pushAvailable
                ? "When someone completes a chore, and the weekly winner"
                : isNative()
                  ? "Coming soon"
                  : "Available in the ChoreQuest app for iPhone and Android"}
            </div>
          </div>
          <Switch label="Household activity notifications" checked={pushAvailable && pushOn} disabled={!pushAvailable || pushBusy} onChange={togglePush} />
        </div>
        {supported && settings.enabled ? (
          <label className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm font-bold text-ink">Remind me at</span>
            <input
              type="time"
              className="cq-input w-auto"
              value={settings.time}
              onChange={(e) => e.target.value && update({ ...settings, time: e.target.value })}
            />
          </label>
        ) : null}
      </Card>
    </section>
  );
}

function PrivacySection() {
  const [consent, setConsent] = useState(() => hasAnalyticsConsent());
  if (!analyticsAvailable()) return null;

  return (
    <section className="space-y-3">
      <SectionTitle>Privacy</SectionTitle>
      <Card className="flex items-center gap-3 px-4 py-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-strong" aria-hidden="true">
          <BarChart3 size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-ink">Share anonymous usage stats</div>
          <div className="text-xs text-muted">Helps us see which screens people use. Never your chores or names.</div>
        </div>
        <Switch
          label="Share anonymous usage stats"
          checked={consent}
          onChange={(on) => {
            setConsent(on);
            setAnalyticsConsent(on).catch(() => {});
          }}
        />
      </Card>
    </section>
  );
}

function DeleteAccountSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const { uid, household } = useReadyHousehold();
  const { toast } = useFeedback();
  const [password, setPassword] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;
  const method = signInMethod(user);
  const alone = isOnlyMember(household, uid);

  async function confirm() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount({ user, household, password });
      toast("Your account has been deleted. Take care! 👋");
      router.replace("/welcome");
    } catch (e) {
      if (!isCancelled(e)) setError(friendlyError(e, "Couldn't delete your account. Please try again."));
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Delete your account?"
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button block onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            block
            variant="danger"
            loading={busy}
            disabled={!understood || (method === "password" && !password)}
            onClick={confirm}>
            Delete forever
          </Button>
        </div>
      }>
      <div className="space-y-4 text-sm text-muted">
        <p>This permanently deletes your sign-in and profile. It can&apos;t be undone.</p>
        <p>
          {alone ? (
            <>
              You&apos;re the only member of <strong className="text-ink">{household.name}</strong>, so the household
              and all its chores and history will be deleted too.
            </>
          ) : (
            <>
              <strong className="text-ink">{household.name}</strong> keeps its chores and shared history for the other
              members.
            </>
          )}
        </p>

        {method === "password" ? (
          <div>
            <label htmlFor="delete-password" className="mb-1.5 block font-bold text-ink">
              Enter your password to confirm
            </label>
            <input
              id="delete-password"
              type="password"
              className="cq-input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        ) : (
          <p>You&apos;ll be asked to confirm with {method === "apple" ? "Apple" : "Google"}.</p>
        )}

        <label className="flex items-start gap-3 rounded-2xl bg-surface-2 p-3">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 accent-red-600"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
          />
          <span className="text-ink">I understand my account can&apos;t be recovered</span>
        </label>

        {error ? <p role="alert" className="text-red-600">{error}</p> : null}
      </div>
    </Sheet>
  );
}
