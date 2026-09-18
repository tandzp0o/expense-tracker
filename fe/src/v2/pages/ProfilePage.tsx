import React, { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  AtSign,
  Camera,
  IdCard,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  NotebookText,
  Pencil,
  Phone,
  ShieldCheck,
  Wallet as WalletIcon,
} from "lucide-react";
import { userApi } from "services/api";
import { useAuth } from "contexts/AuthContext";
import { useLocale } from "contexts/LocaleContext";
import { useToast } from "contexts/ToastContext";
import { cn } from "lib/utils";
import {
  Button,
  Card,
  CardHeader,
  FieldLabel,
  IconBadge,
  Money,
  PageHeader,
  SkeletonRows,
  TextInput,
  TextLink,
  type HeroStat,
} from "../components/primitives";
import { Panel } from "../components/overlays";
import { Avatar } from "../layout/LedgerLayout";
import { useLedger } from "../LedgerContext";
import { currentMonth, formatMoney } from "../lib/format";
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

/**
 * The rail's avatar, with the initial sized to the circle: the shared one
 * keeps a 13px letter, which gets lost in a large circle.
 */
const ScaledAvatar: React.FC<{ src?: string | null; name: string; size: number }> = ({
  src,
  name,
  size,
}) =>
  src ? (
    <Avatar name={name} size={size} src={src} />
  ) : (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-ledger-accent-wash font-semibold text-ledger-accent"
      style={{ height: size, width: size, fontSize: Math.round(size * 0.38) }}
    >
      {(name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );

/**
 * The month's figures as tiles beside the identity card, the same tiles the
 * hero strip uses elsewhere. On a phone they fold into one card of rows.
 */
const StatTiles: React.FC<{ stats: HeroStat[]; className?: string }> = ({ stats, className }) => (
  <dl
    className={cn(
      "min-w-0 divide-y divide-ledger-line overflow-hidden rounded-[18px] border border-ledger-line bg-ledger-paper shadow-card",
      "sm:grid sm:grid-cols-3 sm:gap-4 sm:divide-y-0 sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent sm:shadow-none xl:gap-5",
      className,
    )}
  >
    {stats.map((stat) => (
      <div
        className="flex min-w-0 items-center justify-between gap-3 px-4 py-3.5 sm:flex-col sm:items-start sm:justify-center sm:rounded-[18px] sm:border sm:border-ledger-line sm:bg-ledger-paper sm:p-5 sm:shadow-card xl:p-6"
        key={stat.label}
      >
        <dt className="flex min-w-0 items-center gap-2.5">
          {stat.icon ? (
            <IconBadge className="hidden sm:inline-flex" icon={stat.icon} tone={stat.tone || "neutral"} />
          ) : null}
          <span className="text-[13.5px] font-medium text-ledger-ink-2">{stat.label}</span>
        </dt>
        <dd className="min-w-0 text-right sm:mt-3 sm:text-left">
          <div className="text-[15px] font-semibold sm:text-[20px] 2xl:text-[22px]">{stat.value}</div>
          {stat.hint ? (
            <div className="mt-0.5 hidden text-[12.5px] text-ledger-muted sm:block">{stat.hint}</div>
          ) : null}
        </dd>
      </div>
    ))}
  </dl>
);

/** One labelled fact with its icon; an empty one offers to fill it in. */
const DetailField: React.FC<{
  icon: LucideIcon;
  label: string;
  value?: React.ReactNode;
  empty: React.ReactNode;
  className?: string;
}> = ({ icon, label, value, empty, className }) => (
  <div className={cn("flex min-w-0 items-start gap-3", className)}>
    <IconBadge icon={icon} tone="neutral" />
    <div className="min-w-0 flex-1">
      <dt className="text-[13px] text-ledger-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-[15px] text-ledger-ink">
        {value || <span className="text-[14px] text-ledger-muted">{empty}</span>}
      </dd>
    </div>
  </div>
);

/** Who the user is, on cards; editing opens beside the page. */
const ProfilePage: React.FC = () => {
  const t = useT();
  const { toast } = useToast();
  const { currentUser, logout } = useAuth();
  const { timezoneOffsetMinutes } = useLocale();
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
  const email = profile?.email || currentUser?.email || "";
  const username = profile?.username || currentUser?.username || "";
  const avatar = profile?.avatar || currentUser?.avatar || currentUser?.photoURL;
  const providers = profile?.authProviders || currentUser?.authProviders || [];
  const joined = profile?.createdAt ? new Date(profile.createdAt) : null;
  const joinedValid = joined && !Number.isNaN(joined.getTime());

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

  // Last month in full, as context for this month so far, like the overview.
  const { month } = currentMonth(timezoneOffsetMinutes);
  const previousMonth = month === 1 ? 12 : month - 1;
  const history = stats?.history || [];
  const lastMonth = history.length >= 2 ? history[history.length - 2] : null;
  const totalBalance = toAmount(stats?.totalBalance);
  const dash = <span className="text-ledger-line-strong">—</span>;

  const heroStats: HeroStat[] = [
    {
      label: t("Tổng số dư", "Total balance"),
      icon: WalletIcon,
      tone: "accent",
      value: loading ? dash : <Money amount={totalBalance} tone={totalBalance < 0 ? "out" : "neutral"} />,
      hint: t("Mọi ví đang dùng", "Every wallet in use"),
    },
    {
      label: t("Thu tháng này", "In this month"),
      icon: ArrowDownLeft,
      tone: "in",
      value: loading ? dash : <Money amount={toAmount(stats?.monthlyIncome)} signed tone="in" />,
      hint: lastMonth
        ? t(
            `Tháng ${previousMonth}: ${formatMoney(toAmount(lastMonth.income))}`,
            `Last month: ${formatMoney(toAmount(lastMonth.income))}`,
          )
        : undefined,
    },
    {
      label: t("Chi tháng này", "Out this month"),
      icon: ArrowUpRight,
      tone: "out",
      value: loading ? dash : <Money amount={toAmount(stats?.monthlyExpense)} />,
      hint: lastMonth
        ? t(
            `Tháng ${previousMonth}: ${formatMoney(toAmount(lastMonth.expense))}`,
            `Last month: ${formatMoney(toAmount(lastMonth.expense))}`,
          )
        : undefined,
    },
  ];

  const providerLabel = (provider: string) =>
    provider === "google"
      ? "Google"
      : provider === "password"
        ? t("Email và mật khẩu", "Email and password")
        : provider;

  const addLink = (
    <>
      {t("Chưa thêm", "Not added")} ·{" "}
      <TextLink onClick={openEdit}>{t("Thêm", "Add")}</TextLink>
    </>
  );

  const signOutButton = (
    <button
      className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-ledger-line-strong bg-ledger-paper px-4 text-[14px] font-medium text-ledger-out transition-colors hover:bg-ledger-out-wash"
      onClick={() => void logout()}
      type="button"
    >
      <LogOut className="h-4 w-4" />
      {t("Đăng xuất", "Sign out")}
    </button>
  );

  return (
    <div>
      <PageHeader
        actions={
          <Button icon={Pencil} onClick={openEdit} variant="outline">
            {t("Sửa hồ sơ", "Edit profile")}
          </Button>
        }
        subtitle={t("Thông tin cá nhân và tài khoản TonFin của bạn", "Your details and your TonFin account")}
        title={t("Hồ sơ", "Profile")}
      />

      {/* Who you are, with this month's figures beside it: the same 5/7
          split as the hero strip on the other pages. */}
      <section className="grid gap-3 sm:gap-4 xl:grid-cols-12 xl:gap-5">
        <Card className="flex flex-col justify-center xl:col-span-5">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="relative shrink-0">
              <ScaledAvatar name={name} size={80} src={avatar} />
              <button
                aria-label={t("Đổi ảnh đại diện", "Change photo")}
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-ledger-paper bg-ledger-accent text-ledger-accent-ink transition hover:brightness-110 disabled:opacity-60"
                disabled={saving}
                onClick={() => fileRef.current?.click()}
                title={t("Đổi ảnh đại diện", "Change photo")}
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
              <h2 className="break-words text-[20px] font-semibold leading-tight tracking-[-0.02em] text-ledger-ink sm:text-[22px]">
                {name || t("Chưa đặt tên", "No name yet")}
              </h2>
              {email ? (
                <p className="mt-1 break-all text-[14px] text-ledger-ink-2">{email}</p>
              ) : null}
              {joinedValid && joined ? (
                <p className="mt-1 text-[13px] text-ledger-muted">
                  {t(
                    `Dùng TonFin từ tháng ${joined.getMonth() + 1}/${joined.getFullYear()}`,
                    `On TonFin since ${joined.getMonth() + 1}/${joined.getFullYear()}`,
                  )}
                </p>
              ) : null}
            </div>
          </div>
        </Card>

        <StatTiles className="xl:col-span-7" stats={heroStats} />
      </section>

      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 xl:mt-5 xl:grid-cols-12 xl:gap-5">
        <Card className="flex flex-col xl:col-span-8">
          <CardHeader
            action={<TextLink onClick={openEdit}>{t("Sửa", "Edit")}</TextLink>}
            icon={IdCard}
            subtitle={t("Chỉ bạn nhìn thấy những thông tin này", "Only you can see these")}
            title={t("Thông tin cá nhân", "Personal details")}
          />
          {loading ? (
            <SkeletonRows rows={3} />
          ) : (
            // The introduction block takes whatever height the row leaves, so
            // the card never ends in a band of nothing beside a taller one.
            <dl className="flex flex-1 flex-col">
              <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
                <DetailField
                  empty={addLink}
                  icon={Phone}
                  label={t("Số điện thoại", "Phone")}
                  value={profile?.phone ? <span className="ledger-num">{profile.phone}</span> : undefined}
                />
                <DetailField
                  empty={addLink}
                  icon={MapPin}
                  label={t("Địa chỉ", "Address")}
                  value={profile?.address}
                />
              </div>
              {/* The one free-text field gets a block of its own, so a long
                  introduction reads as a paragraph and an empty one invites
                  writing it. */}
              <div className="mt-5 flex flex-1 items-start gap-3">
                <IconBadge icon={NotebookText} tone="neutral" />
                <div className="flex min-w-0 flex-1 flex-col self-stretch">
                  <dt className="text-[13px] text-ledger-muted">{t("Giới thiệu", "About")}</dt>
                  <dd className="mt-1.5 flex flex-1 flex-col">
                    {profile?.bio ? (
                      <p className="flex-1 whitespace-pre-line break-words rounded-[12px] bg-ledger-canvas px-4 py-3 text-[14.5px] leading-relaxed text-ledger-ink">
                        {profile.bio}
                      </p>
                    ) : (
                      <button
                        className="flex min-h-[72px] w-full flex-1 items-center justify-center gap-2 rounded-[12px] border border-dashed border-ledger-line-strong px-4 text-[13.5px] text-ledger-ink-2 transition-colors hover:border-ledger-accent hover:text-ledger-accent"
                        onClick={openEdit}
                        type="button"
                      >
                        <Pencil className="h-4 w-4" />
                        {t("Viết vài dòng giới thiệu về bạn", "Write a line or two about yourself")}
                      </button>
                    )}
                  </dd>
                </div>
              </div>
            </dl>
          )}
        </Card>

        <Card className="flex flex-col xl:col-span-4">
          <CardHeader
            icon={ShieldCheck}
            subtitle={t("Cách bạn vào TonFin", "How you get into TonFin")}
            title={t("Đăng nhập", "Sign-in")}
          />
          <dl className="space-y-4">
            <DetailField empty="—" icon={Mail} label="Email" value={email} />
            {username ? (
              <DetailField
                empty="—"
                icon={AtSign}
                label={t("Tên đăng nhập", "Username")}
                value={`@${username}`}
              />
            ) : null}
            <DetailField
              empty="—"
              icon={KeyRound}
              label={t("Đăng nhập bằng", "Signs in with")}
              value={
                providers.length ? (
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {providers.map((provider) => (
                      <span
                        className="rounded-full bg-ledger-canvas px-2.5 py-1 text-[13px] font-medium text-ledger-ink-2"
                        key={provider}
                      >
                        {providerLabel(provider)}
                      </span>
                    ))}
                  </span>
                ) : undefined
              }
            />
          </dl>
          {/* Pinned to the bottom when the row stretches the card. */}
          <div className="mt-auto pt-5">
            <div className="border-t border-ledger-line pt-5">{signOutButton}</div>
          </div>
        </Card>
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
          {/* The photo uploads on its own, like the camera button on the
              page; it is here too so nobody hunts for it. */}
          <div className="flex items-center gap-3.5 rounded-[14px] bg-ledger-canvas px-4 py-3">
            <ScaledAvatar name={form.displayName || name} size={44} src={avatar} />
            <div className="min-w-0 flex-1">
              <p className="break-words text-[14.5px] font-medium text-ledger-ink">
                {form.displayName.trim() || name || t("Chưa đặt tên", "No name yet")}
              </p>
              <p className="text-[12.5px] text-ledger-muted">
                {t("Ảnh được lưu ngay khi chọn", "Saved as soon as you pick it")}
              </p>
            </div>
            <Button
              disabled={saving}
              icon={Camera}
              onClick={() => fileRef.current?.click()}
              size="sm"
              variant="outline"
            >
              {t("Đổi ảnh", "Change")}
            </Button>
          </div>
          <div>
            <FieldLabel htmlFor="profile-name">{t("Tên hiển thị", "Display name")}</FieldLabel>
            <TextInput
              id="profile-name"
              maxLength={80}
              onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
              value={form.displayName}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
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
          </div>
          <div>
            <FieldLabel htmlFor="profile-bio" hint={t("không bắt buộc", "optional")}>{t("Giới thiệu", "About")}</FieldLabel>
            <textarea
              className="min-h-[112px] w-full rounded-[10px] border border-ledger-line bg-ledger-paper px-3.5 py-2.5 text-[14px] text-ledger-ink outline-none placeholder:text-ledger-muted focus:border-ledger-accent"
              id="profile-bio"
              maxLength={500}
              onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
              value={form.bio}
            />
            <p className="mt-1.5 text-right text-[12px] text-ledger-muted">
              <span className="ledger-num">{form.bio.length}/500</span>
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
};

export default ProfilePage;
