import React, { useEffect, useRef, useState } from "react";
import { Camera, LogOut, Pencil } from "lucide-react";
import { userApi } from "services/api";
import { useAuth } from "contexts/AuthContext";
import { useToast } from "contexts/ToastContext";
import {
  Button,
  FieldLabel,
  HeroStat,
  HeroStrip,
  Money,
  PageHeader,
  Section,
  SkeletonRows,
  TextInput,
} from "../components/primitives";
import { Panel } from "../components/overlays";
import { Avatar } from "../layout/LedgerLayout";
import { useLedger } from "../LedgerContext";
import { useT } from "../lib/i18n";
import { getIdToken } from "../lib/session";
import { toAmount, type ProfileStats } from "../lib/types";

interface Profile {
  displayName?: string;
  username?: string;
  email?: string;
  phone?: string;
  address?: string;
  bio?: string;
  avatar?: string;
  createdAt?: string;
  authProviders?: string[];
}

const DetailRow: React.FC<{ label: string; value?: React.ReactNode; empty: string }> = ({
  label,
  value,
  empty,
}) => (
  <div className="grid grid-cols-1 gap-1 border-b border-ledger-line py-3.5 last:border-b-0 sm:grid-cols-[180px_1fr] sm:gap-6">
    <dt className="text-[13px] text-ledger-muted">{label}</dt>
    <dd className={value ? "text-[14.5px] text-ledger-ink" : "text-[14.5px] text-ledger-muted"}>
      {value || empty}
    </dd>
  </div>
);

/** Who the user is, in plain rows; editing opens beside the page. */
const ProfilePage: React.FC = () => {
  const t = useT();
  const { toast } = useToast();
  const { currentUser, logout } = useAuth();
  const { dataVersion } = useLedger();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ displayName: "", phone: "", address: "", bio: "" });

  const load = async () => {
    const token = await getIdToken();
    const [profileResult, statsResult] = await Promise.allSettled([
      userApi.getProfile(token),
      userApi.getProfileStats(token),
    ]);
    if (profileResult.status === "fulfilled") {
      const value = profileResult.value;
      setProfile(value?.data ?? value);
    }
    if (statsResult.status === "fulfilled") {
      setStats(statsResult.value);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await load();
      } catch (error: any) {
        if (active) {
          toast({ title: t("Không tải được hồ sơ", "Could not load your profile"), description: error.message, variant: "destructive" });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
    // `load` only closes over stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion, t, toast]);

  const name = profile?.displayName || currentUser?.displayName || currentUser?.username || "";
  const avatar = profile?.avatar || currentUser?.avatar || currentUser?.photoURL;
  const providers = profile?.authProviders || currentUser?.authProviders || [];
  const joined = profile?.createdAt ? new Date(profile.createdAt) : null;

  const openEdit = () => {
    setForm({
      displayName: profile?.displayName || name,
      phone: profile?.phone || "",
      address: profile?.address || "",
      bio: profile?.bio || "",
    });
    setEditOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await userApi.updateProfile(
        {
          displayName: form.displayName.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          bio: form.bio.trim(),
        },
        await getIdToken(),
      );
      toast({ title: t("Đã lưu hồ sơ", "Profile saved"), variant: "success" });
      setEditOpen(false);
      await load();
    } catch (error: any) {
      toast({ title: t("Chưa lưu được", "Could not save"), description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      await userApi.uploadAvatar(formData, await getIdToken());
      toast({ title: t("Đã đổi ảnh đại diện", "Photo updated"), variant: "success" });
      await load();
    } catch (error: any) {
      toast({ title: t("Chưa tải được ảnh", "Could not upload the photo"), description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const heroStats: HeroStat[] = [
    { label: t("Thu tháng này", "In this month"), value: <Money amount={toAmount(stats?.monthlyIncome)} signed tone="in" /> },
    { label: t("Chi tháng này", "Out this month"), value: <Money amount={toAmount(stats?.monthlyExpense)} /> },
  ];

  return (
    <div>
      <PageHeader
        actions={
          <Button icon={Pencil} onClick={openEdit} variant="outline">
            {t("Sửa hồ sơ", "Edit profile")}
          </Button>
        }
        title={t("Hồ sơ", "Profile")}
      />

      <section className="flex flex-col gap-5 border-b border-ledger-line py-7 sm:flex-row sm:items-center">
        <div className="relative w-fit">
          <Avatar name={name} size={84} src={avatar} />
          <button
            aria-label={t("Đổi ảnh đại diện", "Change photo")}
            className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-ledger-paper bg-ledger-accent text-ledger-accent-ink disabled:opacity-60"
            disabled={saving}
            onClick={() => fileRef.current?.click()}
            type="button"
          >
            <Camera className="h-4 w-4" />
          </button>
          <input
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void uploadAvatar(file);
              }
              event.target.value = "";
            }}
            ref={fileRef}
            type="file"
          />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-[24px] font-semibold tracking-[-0.02em] text-ledger-ink">
            {name || t("Chưa đặt tên", "No name yet")}
          </h2>
          <p className="mt-0.5 truncate text-[14px] text-ledger-ink-2">
            {[profile?.email || currentUser?.email, profile?.username || currentUser?.username ? `@${profile?.username || currentUser?.username}` : ""]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {joined && !Number.isNaN(joined.getTime()) ? (
            <p className="mt-1 text-[13px] text-ledger-muted">
              {t(
                `Dùng TonFin từ tháng ${joined.getMonth() + 1}/${joined.getFullYear()}`,
                `On TonFin since ${joined.getMonth() + 1}/${joined.getFullYear()}`,
              )}
            </p>
          ) : null}
        </div>
      </section>

      <HeroStrip
        label={t("Tổng số dư các ví", "Across your wallets")}
        stats={heroStats}
        value={loading ? <span className="text-ledger-line-strong">—</span> : <Money amount={toAmount(stats?.totalBalance)} tone={toAmount(stats?.totalBalance) < 0 ? "out" : "neutral"} />}
      />

      <Section title={t("Thông tin", "Details")}>
        {loading ? (
          <SkeletonRows rows={4} />
        ) : (
          <dl>
            <DetailRow empty={t("Chưa thêm", "Not added")} label={t("Số điện thoại", "Phone")} value={profile?.phone} />
            <DetailRow empty={t("Chưa thêm", "Not added")} label={t("Địa chỉ", "Address")} value={profile?.address} />
            <DetailRow empty={t("Chưa thêm", "Not added")} label={t("Giới thiệu", "About")} value={profile?.bio} />
            <DetailRow
              empty="—"
              label={t("Đăng nhập bằng", "Signs in with")}
              value={providers
                .map((provider) =>
                  provider === "google" ? "Google" : provider === "password" ? t("Email và mật khẩu", "Email and password") : provider,
                )
                .join(", ")}
            />
          </dl>
        )}
      </Section>

      <div className="py-6">
        <Button icon={LogOut} onClick={() => void logout()} variant="ghost">
          <span className="text-ledger-out">{t("Đăng xuất", "Sign out")}</span>
        </Button>
      </div>

      <Panel
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditOpen(false)} variant="ghost">{t("Huỷ", "Cancel")}</Button>
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? t("Đang lưu...", "Saving...") : t("Lưu hồ sơ", "Save profile")}
            </Button>
          </div>
        }
        onClose={() => setEditOpen(false)}
        open={editOpen}
        title={t("Sửa hồ sơ", "Edit profile")}
      >
        <div className="flex flex-col gap-5">
          <div>
            <FieldLabel htmlFor="profile-name">{t("Tên hiển thị", "Display name")}</FieldLabel>
            <TextInput
              id="profile-name"
              maxLength={80}
              onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
              value={form.displayName}
            />
          </div>
          <div>
            <FieldLabel htmlFor="profile-phone" hint={t("không bắt buộc", "optional")}>{t("Số điện thoại", "Phone")}</FieldLabel>
            <TextInput
              id="profile-phone"
              inputMode="tel"
              maxLength={20}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              value={form.phone}
            />
          </div>
          <div>
            <FieldLabel htmlFor="profile-address" hint={t("không bắt buộc", "optional")}>{t("Địa chỉ", "Address")}</FieldLabel>
            <TextInput
              id="profile-address"
              maxLength={200}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              value={form.address}
            />
          </div>
          <div>
            <FieldLabel htmlFor="profile-bio" hint={t("không bắt buộc", "optional")}>{t("Giới thiệu", "About")}</FieldLabel>
            <textarea
              className="min-h-[96px] w-full rounded-[10px] border border-ledger-line bg-ledger-paper px-3.5 py-2.5 text-[14px] text-ledger-ink outline-none placeholder:text-ledger-muted focus:border-ledger-accent"
              id="profile-bio"
              maxLength={500}
              onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
              value={form.bio}
            />
          </div>
        </div>
      </Panel>
    </div>
  );
};

export default ProfilePage;
