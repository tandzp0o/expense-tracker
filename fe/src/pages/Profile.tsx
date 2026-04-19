import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    CalendarDays,
    Mail,
    MapPin,
    PencilLine,
    Phone,
    Upload,
} from "lucide-react";
import { auth } from "../firebase/config";
import { API_URL, transactionApi, userApi } from "../services/api";
import { formatCurrency, formatDate } from "../utils/formatters";
import { useToast } from "../contexts/ToastContext";
import { useLocale } from "../contexts/LocaleContext";
import { useTheme } from "../contexts/ThemeContext";
import { hexToRgba } from "../lib/utils";
import { PageHeader } from "../components/app/page-header";
import { MetricCard } from "../components/app/metric-card";
import { Avatar } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Spinner } from "../components/ui/spinner";
import { Textarea } from "../components/ui/textarea";
import LineChart from "../components/charts/LineChart";

interface UserProfile {
    displayName: string;
    email: string;
    phone?: string;
    bio?: string;
    avatar?: string;
    address?: string;
    createdAt?: string;
    totalBalance: number;
    totalIncome: number;
    totalExpense: number;
    goalsCompleted: number;
    goalsActive: number;
}

interface ProfileStats {
    totalBalance: number;
    monthlyIncome: number;
    monthlyExpense: number;
    growth: number;
    history: Array<{
        month: string;
        balance: number;
        income: number;
        expense: number;
    }>;
}

const Profile: React.FC = () => {
    const { toast } = useToast();
    const { isVietnamese } = useLocale();
    const { appearance } = useTheme();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [stats, setStats] = useState<ProfileStats | null>(null);
    const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formValues, setFormValues] = useState({
        displayName: "",
        phone: "",
        address: "",
        bio: "",
    });

    const loadProfile = useCallback(async () => {
        setLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) {
                return;
            }
            const token = await user.getIdToken();
            const [profileData, statsData, transactionResponse] = await Promise.all([
                userApi.getProfile(token),
                userApi.getProfileStats(token),
                transactionApi.getTransactions({ limit: 5, page: 1 }, token),
            ]);

            const fullProfile: UserProfile = {
                displayName:
                    profileData.displayName ||
                    user.displayName ||
                    (isVietnamese
                        ? "Thành viên FinTrack"
                        : "FinTrack member"),
                email: profileData.email || user.email || "",
                phone: profileData.phone || "",
                bio: profileData.bio || "",
                avatar: profileData.avatar || user.photoURL || undefined,
                address: profileData.address || "",
                createdAt: profileData.createdAt || "",
                totalBalance: profileData.totalBalance || 0,
                totalIncome: profileData.totalIncome || 0,
                totalExpense: profileData.totalExpense || 0,
                goalsCompleted: profileData.goalsCompleted || 0,
                goalsActive: profileData.goalsActive || 0,
            };

            setProfile(fullProfile);
            setStats(statsData);
            setRecentTransactions(transactionResponse?.data?.transactions || []);
            setFormValues({
                displayName: fullProfile.displayName,
                phone: fullProfile.phone || "",
                address: fullProfile.address || "",
                bio: fullProfile.bio || "",
            });
        } catch (error: any) {
            toast({
                title: isVietnamese
                    ? "Không thể tải hồ sơ"
                    : "Could not load profile",
                description:
                    error.message ||
                    (isVietnamese ? "Vui lòng thử lại." : "Please retry."),
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [isVietnamese, toast]);

    useEffect(() => {
        void loadProfile();
    }, [loadProfile]);

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                return;
            }
            await userApi.updateProfile(formValues, token);
            toast({
                title: isVietnamese ? "Đã cập nhật hồ sơ" : "Profile updated",
                variant: "success",
            });
            setIsEditing(false);
            await loadProfile();
        } catch (error: any) {
            toast({
                title: isVietnamese ? "Cập nhật thất bại" : "Update failed",
                description:
                    error.message ||
                    (isVietnamese
                        ? "Không thể cập nhật hồ sơ."
                        : "Profile could not be updated."),
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarUpload = async (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        setSaving(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                return;
            }
            const formData = new FormData();
            formData.append("avatar", file);
            await userApi.uploadAvatar(formData, token);
            toast({
                title: isVietnamese
                    ? "Đã cập nhật ảnh đại diện"
                    : "Avatar updated",
                variant: "success",
            });
            await loadProfile();
        } catch (error: any) {
            toast({
                title: isVietnamese ? "Tải ảnh thất bại" : "Upload failed",
                description:
                    error.message ||
                    (isVietnamese
                        ? "Không thể tải ảnh đại diện."
                        : "Avatar could not be uploaded."),
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const chartData = useMemo(
        () => ({
            labels: stats?.history?.map((item) => item.month) || [],
            datasets: [
                {
                    label: isVietnamese ? "Số dư" : "Balance",
                    data: stats?.history?.map((item) => item.balance) || [],
                    borderColor: appearance.primaryColor,
                    backgroundColor: hexToRgba(appearance.primaryColor, 0.14),
                    fill: true,
                    tension: 0.35,
                },
            ],
        }),
        [appearance.primaryColor, isVietnamese, stats?.history],
    );

    if (loading || !profile) {
        return (
            <div className="flex min-h-[420px] items-center justify-center">
                <Spinner className="h-8 w-8" />
            </div>
        );
    }

    const copy = isVietnamese
        ? {
              title: "Hồ sơ cá nhân",
              description:
                  "Quản lý thông tin tài khoản, thống kê hồ sơ và các giao dịch gần đây.",
              memberSince: "Tham gia từ",
              uploading: "Đang tải ảnh...",
              changeAvatar: "Đổi ảnh đại diện",
              email: "Email",
              phone: "Số điện thoại",
              address: "Địa chỉ",
              notSet: "Chưa cập nhật",
              cancelEditing: "Hủy chỉnh sửa",
              editProfile: "Chỉnh sửa hồ sơ",
              totalBalance: "Tổng tài sản",
              monthlyIncome: "Thu nhập tháng này",
              monthlyExpense: "Chi tiêu tháng này",
              completedGoals: "Mục tiêu hoàn thành",
              vsPreviousMonth: "so với tháng trước",
              currentMonthIncome: "Thu nhập của tháng hiện tại",
              currentMonthExpense: "Chi tiêu của tháng hiện tại",
              activeGoals: (count: number) => `${count} mục tiêu đang hoạt động`,
              editSection: "Chỉnh sửa hồ sơ",
              editSectionDesc:
                  "Chỉ hiển thị các trường mà API hồ sơ hiện hỗ trợ cập nhật.",
              displayName: "Tên hiển thị",
              bio: "Giới thiệu",
              saveProfile: "Lưu hồ sơ",
              saving: "Đang lưu...",
              balanceHistory: "Lịch sử số dư",
              balanceHistoryDesc:
                  "Biểu đồ 6 tháng lấy từ endpoint thống kê hồ sơ.",
              recentTransactions: "Giao dịch gần đây",
              recentTransactionsDesc:
                  "5 giao dịch mới nhất được tải riêng cho màn hồ sơ.",
              noRecentTransactions: "Chưa có giao dịch gần đây.",
          }
        : {
              title: "Profile",
              description:
                  "Manage account information, profile stats and recent transactions.",
              memberSince: "Member since",
              uploading: "Uploading...",
              changeAvatar: "Change avatar",
              email: "Email",
              phone: "Phone",
              address: "Address",
              notSet: "Not set",
              cancelEditing: "Cancel editing",
              editProfile: "Edit profile",
              totalBalance: "Total balance",
              monthlyIncome: "Monthly income",
              monthlyExpense: "Monthly expense",
              completedGoals: "Completed goals",
              vsPreviousMonth: "vs previous month",
              currentMonthIncome: "Current month income",
              currentMonthExpense: "Current month expense",
              activeGoals: (count: number) => `${count} active goal(s)`,
              editSection: "Edit profile",
              editSectionDesc:
                  "Only fields supported by the profile API are shown here.",
              displayName: "Display name",
              bio: "Bio",
              saveProfile: "Save profile",
              saving: "Saving...",
              balanceHistory: "Balance history",
              balanceHistoryDesc:
                  "Six month chart loaded from the profile stats endpoint.",
              recentTransactions: "Recent transactions",
              recentTransactionsDesc:
                  "Latest five transactions loaded specifically for the profile screen.",
              noRecentTransactions: "No recent transactions.",
          };

    return (
        <div className="space-y-6">
            <PageHeader
                description={copy.description}
                title={copy.title}
            />

            <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
                <Card className="overflow-hidden">
                    <div className="h-28 bg-[linear-gradient(135deg,var(--app-primary-soft-strong),rgba(15,23,42,0.85))]" />
                    <CardContent className="-mt-12 space-y-6 p-6">
                        <div className="flex items-end gap-4">
                            <Avatar
                                alt={profile.displayName}
                                className="h-24 w-24 border-4 border-card text-xl"
                                fallback={profile.displayName}
                                src={
                                    profile.avatar?.startsWith("/")
                                        ? `${API_URL}${profile.avatar}`
                                        : profile.avatar
                                }
                            />
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--app-radius-md)] border border-border bg-card px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted/60">
                                <Upload className="h-4 w-4" />
                                <span>
                                    {saving ? copy.uploading : copy.changeAvatar}
                                </span>
                                <input
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleAvatarUpload}
                                    type="file"
                                />
                            </label>
                        </div>

                        <div>
                            <h2 className="text-2xl font-semibold">{profile.displayName}</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {copy.memberSince}{" "}
                                {profile.createdAt
                                    ? new Date(profile.createdAt).toLocaleDateString(
                                          isVietnamese ? "vi-VN" : "en-US",
                                          {
                                              month: "long",
                                              year: "numeric",
                                          },
                                      )
                                    : isVietnamese
                                      ? "gần đây"
                                      : "recently"}
                            </p>
                        </div>

                        <div className="space-y-4 border-t border-border pt-4 text-sm">
                            <div className="flex items-start gap-3">
                                <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="font-medium">{copy.email}</p>
                                    <p className="text-muted-foreground">{profile.email}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="font-medium">{copy.phone}</p>
                                    <p className="text-muted-foreground">
                                        {profile.phone || copy.notSet}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="font-medium">{copy.address}</p>
                                    <p className="text-muted-foreground">
                                        {profile.address || copy.notSet}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <Button
                            className="w-full"
                            onClick={() => setIsEditing((current) => !current)}
                            variant={isEditing ? "outline" : "default"}
                        >
                            <PencilLine className="h-4 w-4" />
                            {isEditing ? copy.cancelEditing : copy.editProfile}
                        </Button>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <MetricCard
                            icon={CalendarDays}
                            subtitle={`${stats?.growth || 0}% ${copy.vsPreviousMonth}`}
                            title={copy.totalBalance}
                            value={formatCurrency(stats?.totalBalance || profile.totalBalance)}
                        />
                        <MetricCard
                            icon={CalendarDays}
                            subtitle={copy.currentMonthIncome}
                            title={copy.monthlyIncome}
                            value={formatCurrency(stats?.monthlyIncome || 0)}
                        />
                        <MetricCard
                            icon={CalendarDays}
                            subtitle={copy.currentMonthExpense}
                            title={copy.monthlyExpense}
                            value={formatCurrency(stats?.monthlyExpense || 0)}
                        />
                        <MetricCard
                            icon={CalendarDays}
                            subtitle={copy.activeGoals(profile.goalsActive)}
                            title={copy.completedGoals}
                            value={String(profile.goalsCompleted)}
                        />
                    </div>

                    {isEditing ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>{copy.editSection}</CardTitle>
                                <CardDescription>
                                    {copy.editSectionDesc}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="mb-2 block text-sm font-medium">
                                            {copy.displayName}
                                        </label>
                                        <Input
                                            onChange={(event) =>
                                                setFormValues((current) => ({
                                                    ...current,
                                                    displayName: event.target.value,
                                                }))
                                            }
                                            value={formValues.displayName}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-medium">
                                            {copy.phone}
                                        </label>
                                        <Input
                                            onChange={(event) =>
                                                setFormValues((current) => ({
                                                    ...current,
                                                    phone: event.target.value,
                                                }))
                                            }
                                            value={formValues.phone}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        {copy.address}
                                    </label>
                                    <Input
                                        onChange={(event) =>
                                            setFormValues((current) => ({
                                                ...current,
                                                address: event.target.value,
                                            }))
                                        }
                                        value={formValues.address}
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        {copy.bio}
                                    </label>
                                    <Textarea
                                        onChange={(event) =>
                                            setFormValues((current) => ({
                                                ...current,
                                                bio: event.target.value,
                                            }))
                                        }
                                        value={formValues.bio}
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <Button disabled={saving} onClick={handleSaveProfile}>
                                        {saving ? copy.saving : copy.saveProfile}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            <Card>
                                <CardHeader>
                                    <CardTitle>{copy.balanceHistory}</CardTitle>
                                    <CardDescription>
                                        {copy.balanceHistoryDesc}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-[300px]">
                                        <LineChart
                                            data={chartData}
                                            options={{
                                                maintainAspectRatio: false,
                                                plugins: {
                                                    legend: {
                                                        display: false,
                                                    },
                                                },
                                            }}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>{copy.recentTransactions}</CardTitle>
                                    <CardDescription>
                                        {copy.recentTransactionsDesc}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {recentTransactions.length > 0 ? (
                                        <div className="space-y-3">
                                            {recentTransactions.map((transaction) => (
                                                <div
                                                    key={transaction._id}
                                                    className="flex items-center justify-between rounded-[var(--app-radius-lg)] border border-border px-4 py-3"
                                                >
                                                    <div>
                                                        <p className="font-medium">
                                                            {transaction.note || transaction.category}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {formatDate(transaction.date)}
                                                        </p>
                                                    </div>
                                                    <span
                                                        className={
                                                            transaction.type === "INCOME"
                                                                ? "font-semibold text-emerald-600"
                                                                : "font-semibold text-rose-600"
                                                        }
                                                    >
                                                        {transaction.type === "INCOME" ? "+" : "-"}
                                                        {formatCurrency(Number(transaction.amount))}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            {copy.noRecentTransactions}
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Profile;
