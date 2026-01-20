import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import {
    DatePicker,
    Input,
    InputNumber,
    Modal,
    Select,
    message,
    Spin,
} from "antd";
import { auth } from "../firebase/config";
import { goalApi } from "../services/api";
import { formatCurrency, formatDate } from "../utils/formatters";
import { useTheme } from "../contexts/ThemeContext";
import BarChart from "../components/charts/BarChart";
import AlertNotification from "../components/AlertNotification";

dayjs.locale("vi");

const moneyFormatter = (value: any) =>
    `${value ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const moneyParser = (value: any) =>
    value ? Number(String(value).replace(/[^0-9.-]+/g, "")) : 0;

interface Goal {
    _id: string;
    title: string;
    description?: string;
    targetAmount: number;
    currentAmount: number;
    category: string;
    deadline?: string;
    status: "active" | "completed" | "expired";
    createdAt: string;
}

const Goals_new: React.FC = () => {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [activeGoalId, setActiveGoalId] = useState<string | null>(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Goal | null>(null);
    const [formTitle, setFormTitle] = useState<string>("");
    const [formDescription, setFormDescription] = useState<string>("");
    const [formTargetAmount, setFormTargetAmount] = useState<number>(0);
    const [formCurrentAmount, setFormCurrentAmount] = useState<number>(0);
    const [formTargetDate, setFormTargetDate] = useState<string>(
        dayjs().toISOString(),
    );
    const [alertVisible, setAlertVisible] = useState(false);
    const [goalToDelete, setGoalToDelete] = useState<string | null>(null);
    const [formDeadline, setFormDeadline] = useState<string>("");
    const [formStatus, setFormStatus] = useState<
        "active" | "completed" | "expired"
    >("active");

    useEffect(() => {
        const fetchData = async () => {
            try {
                const firebaseUser = auth.currentUser;
                if (!firebaseUser) return;
                const token = await firebaseUser.getIdToken();
                const res = await goalApi.getGoals(token);
                const list = Array.isArray(res) ? res : [];
                setGoals(list);
                setActiveGoalId((prev) => prev || (list[0]?._id ?? null));
            } catch (e: any) {
                console.error(e);
                message.error(e?.message || "Không thể tải dữ liệu mục tiêu");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const getToken = async () => {
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) {
            message.error("Người dùng chưa được xác thực");
            return null;
        }
        return firebaseUser.getIdToken();
    };

    const resetForm = () => {
        setFormTitle("");
        setFormDescription("");
        setFormTargetAmount(0);
        setFormCurrentAmount(0);
        setFormTargetDate(dayjs().toISOString());
        setFormDeadline("");
        setFormStatus("active");
    };

    const openCreate = () => {
        setEditing(null);
        resetForm();
        setModalOpen(true);
    };

    const openEdit = (g: Goal) => {
        setEditing(g);
        setFormTitle(g.title);
        setFormDescription(g.description || "");
        setFormTargetAmount(Number(g.targetAmount) || 0);
        setFormCurrentAmount(Number(g.currentAmount) || 0);
        setFormTargetDate(dayjs().toISOString());
        setFormDeadline(g.deadline || "");
        setFormStatus(g.status);
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            if (!formTitle.trim()) {
                message.error("Tiêu đề không được để trống");
                return;
            }
            if (!Number.isFinite(formTargetAmount) || formTargetAmount <= 0) {
                message.error("Mục tiêu không hợp lệ");
                return;
            }
            if (!Number.isFinite(formCurrentAmount) || formCurrentAmount < 0) {
                message.error("Số tiền hiện tại không hợp lệ");
                return;
            }
            setSaving(true);
            const token = await getToken();
            if (!token) return;
            const payload = {
                title: formTitle.trim(),
                description: formDescription.trim() || undefined,
                targetAmount: formTargetAmount,
                currentAmount: formCurrentAmount,
                deadline: formDeadline
                    ? dayjs(formDeadline).toISOString()
                    : undefined,
                status: formStatus,
            };
            if (editing?._id) {
                await goalApi.updateGoal(editing._id, payload, token);
                message.success("Cập nhật mục tiêu thành công");
            } else {
                await goalApi.createGoal(payload, token);
                message.success("Tạo mục tiêu thành công");
            }
            setModalOpen(false);
            await fetchData();
        } catch (e: any) {
            console.error(e);
            message.error(e?.message || "Không thể lưu mục tiêu");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (g: Goal) => {
        setGoalToDelete(g._id);
        setAlertVisible(true);
    };

    const confirmDelete = async () => {
        if (!goalToDelete) return;

        try {
            setDeleting(true);
            const token = await getToken();
            if (!token) return;
            await goalApi.deleteGoal(goalToDelete, token);
            message.success("Đã xóa mục tiêu");
            setActiveGoalId((prev) => {
                if (prev !== goalToDelete) return prev;
                const rest = goals.filter((x) => x._id !== goalToDelete);
                return rest[0]?._id ?? null;
            });
            setAlertVisible(false);
            setGoalToDelete(null);
            await fetchData();
        } catch (e: any) {
            console.error(e);
            message.error(e?.message || "Không thể xóa mục tiêu");
        } finally {
            setDeleting(false);
        }
    };

    const cancelDelete = () => {
        setAlertVisible(false);
        setGoalToDelete(null);
    };

    const fetchData = async () => {
        try {
            const firebaseUser = auth.currentUser;
            if (!firebaseUser) return;
            const token = await firebaseUser.getIdToken();
            const res = await goalApi.getGoals(token);
            const list = Array.isArray(res) ? res : [];
            setGoals(list);
            setActiveGoalId((prev) => prev || (list[0]?._id ?? null));
        } catch (e: any) {
            console.error(e);
            message.error(e?.message || "Không thể tải dữ liệu mục tiêu");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const activeGoal = useMemo(
        () => goals.find((g) => g._id === activeGoalId) || null,
        [activeGoalId, goals],
    );

    const totals = useMemo(() => {
        const totalTarget = goals.reduce(
            (sum, g) => sum + (Number(g.targetAmount) || 0),
            0,
        );
        const totalCurrent = goals.reduce(
            (sum, g) => sum + (Number(g.currentAmount) || 0),
            0,
        );
        const activeCount = goals.filter((g) => g.status === "active").length;
        const completedCount = goals.filter(
            (g) => g.status === "completed",
        ).length;
        return { totalTarget, totalCurrent, activeCount, completedCount };
    }, [goals]);

    const goalProgressPercent = useMemo(() => {
        if (!activeGoal) return 0;
        const target = Number(activeGoal.targetAmount) || 0;
        const current = Number(activeGoal.currentAmount) || 0;
        if (target <= 0) return 0;
        return Math.min((current / target) * 100, 100);
    }, [activeGoal]);

    const statusPill = useMemo(() => {
        if (!activeGoal) return { label: "-", type: "up" as const };
        if (activeGoal.status === "completed")
            return { label: "Hoàn thành", type: "up" as const };
        if (activeGoal.status === "expired")
            return { label: "Hết hạn", type: "down" as const };
        return { label: "Đang thực hiện", type: "up" as const };
    }, [activeGoal]);

    const barData = useMemo(() => {
        if (!activeGoal) {
            return {
                labels: ["Current", "Target"],
                datasets: [
                    {
                        label: "Amount",
                        data: [0, 0],
                        backgroundColor: [
                            theme === "dark"
                                ? "rgba(56, 189, 248, 0.85)"
                                : "rgba(56, 189, 248, 0.92)",
                            theme === "dark"
                                ? "rgba(148, 163, 184, 0.35)"
                                : "rgba(148, 163, 184, 0.45)",
                        ],
                        borderRadius: 8,
                        maxBarThickness: 34,
                    },
                ],
            };
        }

        return {
            labels: ["Current", "Target"],
            datasets: [
                {
                    label: activeGoal.title,
                    data: [
                        Number(activeGoal.currentAmount) || 0,
                        Number(activeGoal.targetAmount) || 0,
                    ],
                    backgroundColor: [
                        "rgba(79, 70, 229, 0.92)",
                        theme === "dark"
                            ? "rgba(148, 163, 184, 0.35)"
                            : "rgba(148, 163, 184, 0.45)",
                    ],
                    borderRadius: 8,
                    maxBarThickness: 34,
                },
            ],
        };
    }, [activeGoal, theme]);

    const barOptions = useMemo(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context: any) => {
                            const value =
                                typeof context.parsed?.y === "number"
                                    ? context.parsed.y
                                    : 0;
                            return `${value.toLocaleString("vi-VN")} VND`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color:
                            theme === "dark"
                                ? "rgba(229, 231, 235, 0.72)"
                                : "#64748b",
                    },
                },
                y: {
                    grid: {
                        display: true,
                        color:
                            theme === "dark"
                                ? "rgba(148, 163, 184, 0.18)"
                                : "rgba(15, 23, 42, 0.08)",
                        borderDash: [2, 2],
                    },
                    ticks: {
                        color:
                            theme === "dark"
                                ? "rgba(229, 231, 235, 0.72)"
                                : "#64748b",
                        callback: (value: any) =>
                            `${Number(value).toLocaleString("vi-VN")}`,
                    },
                },
            },
        }),
        [theme],
    );

    if (loading) {
        return (
            <div style={{ textAlign: "center", padding: "50px" }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div className="ekash_page">
            <div className="ekash_page_header">
                <div>
                    <h2 className="ekash_title">Mục tiêu</h2>
                    <p className="ekash_subtitle">
                        Theo dõi và quản lý mục tiêu tiết kiệm
                    </p>
                </div>
            </div>

            <div className="ekash_grid_main">
                <div className="ekash_card">
                    <div className="ekash_card_header">
                        <p className="ekash_card_title">Danh sách mục tiêu</p>
                        <span className="ekash_card_hint">
                            {goals.length} mục tiêu
                        </span>
                    </div>

                    <div className="ekash_kpi_row">
                        <div className="kpi">
                            <div className="label">Đang thực hiện</div>
                            <div className="value">{totals.activeCount}</div>
                        </div>
                        <div className="kpi">
                            <div className="label">Hoàn thành</div>
                            <div className="value">{totals.completedCount}</div>
                        </div>
                    </div>

                    <div className="ekash_divider" />

                    <div className="ekash_list">
                        {goals.map((g) => (
                            <button
                                key={g._id}
                                type="button"
                                className={`ekash_list_row ${g._id === activeGoalId ? "is_active" : ""}`}
                                onClick={() => setActiveGoalId(g._id)}
                            >
                                <span className="left">
                                    <span
                                        className="dot"
                                        style={{
                                            backgroundColor:
                                                g.status === "completed"
                                                    ? "#14b8a6"
                                                    : g.status === "expired"
                                                      ? "#f43f5e"
                                                      : "#4f46e5",
                                        }}
                                    />
                                    <span className="name">{g.title}</span>
                                </span>
                                <span className="right">
                                    <span className="amt">
                                        {formatCurrency(
                                            Number(g.currentAmount) || 0,
                                        )}
                                    </span>
                                </span>
                            </button>
                        ))}
                        {goals.length === 0 ? (
                            <div className="ekash_empty">Chưa có mục tiêu</div>
                        ) : null}
                    </div>

                    <button
                        type="button"
                        className="ekash_add_budget"
                        onClick={openCreate}
                    >
                        Thêm mục tiêu mới
                    </button>
                </div>

                <div className="ekash_card">
                    <div className="ekash_card_header">
                        <p className="ekash_card_title">Chi tiết mục tiêu</p>
                        <span className="ekash_card_hint">
                            {activeGoal ? activeGoal.category : "-"}
                        </span>
                    </div>

                    {activeGoal ? (
                        <>
                            <div className="ekash_goal_header">
                                <div>
                                    <div className="ekash_goal_title">
                                        {activeGoal.title}
                                    </div>
                                    <div className="ekash_goal_sub">
                                        {activeGoal.description
                                            ? activeGoal.description
                                            : "-"}
                                    </div>
                                </div>
                                <div>
                                    <span
                                        className={`ekash_pill ${statusPill.type}`}
                                    >
                                        {statusPill.label}
                                    </span>
                                </div>
                            </div>

                            <div className="ekash_divider" />

                            <div className="ekash_kpi_row">
                                <div className="kpi">
                                    <div className="label">Hiện tại</div>
                                    <div className="value">
                                        {formatCurrency(
                                            Number(activeGoal.currentAmount) ||
                                                0,
                                        )}
                                    </div>
                                </div>
                                <div className="kpi">
                                    <div className="label">Mục tiêu</div>
                                    <div className="value">
                                        {formatCurrency(
                                            Number(activeGoal.targetAmount) ||
                                                0,
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="ekash_divider" />

                            <div className="ekash_budget_list">
                                <div className="ekash_budget_item">
                                    <div className="ekash_budget_row">
                                        <div className="left">
                                            <span
                                                className="circle"
                                                style={{
                                                    backgroundColor: "#4f46e5",
                                                }}
                                            />
                                            <span className="name">
                                                Progress
                                            </span>
                                        </div>
                                        <div className="right">
                                            {Math.round(goalProgressPercent)}/
                                            {100}
                                        </div>
                                    </div>
                                    <div className="ekash_progress">
                                        <span
                                            className="bar"
                                            style={{
                                                width: `${goalProgressPercent}%`,
                                                backgroundColor: "#4f46e5",
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="ekash_goal_meta">
                                <div className="row">
                                    <span className="label">Hạn chót</span>
                                    <span className="value">
                                        {activeGoal.deadline
                                            ? formatDate(activeGoal.deadline)
                                            : "-"}
                                    </span>
                                </div>
                                <div className="row">
                                    <span className="label">Ngày tạo</span>
                                    <span className="value">
                                        {activeGoal.createdAt
                                            ? formatDate(activeGoal.createdAt)
                                            : "-"}
                                    </span>
                                </div>
                            </div>

                            <div className="ekash_actions">
                                <button
                                    type="button"
                                    className="ekash_btn"
                                    onClick={() => openEdit(activeGoal)}
                                >
                                    Cập nhật
                                </button>
                                <button
                                    type="button"
                                    className="ekash_btn danger"
                                    onClick={() => handleDelete(activeGoal)}
                                    disabled={deleting}
                                >
                                    Xóa
                                </button>
                            </div>

                            <div
                                className="ekash_chart"
                                style={{ height: 220, marginTop: 12 }}
                            >
                                <div
                                    className="ekash_chart_bg"
                                    style={{ height: "100%" }}
                                >
                                    <BarChart
                                        data={barData}
                                        options={barOptions}
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="ekash_empty">
                            Chọn một mục tiêu để xem chi tiết
                        </div>
                    )}
                </div>
            </div>

            <Modal
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={handleSave}
                okText={editing ? "Cập nhật" : "Tạo"}
                cancelText="Hủy"
                confirmLoading={saving}
                title={editing ? "Cập nhật mục tiêu" : "Tạo mục tiêu"}
                width={520}
            >
                <div className="ekash_form">
                    <div className="ekash_form_row">
                        <div className="label">Tiêu đề</div>
                        <Input
                            value={formTitle}
                            onChange={(e) => setFormTitle(e.target.value)}
                            placeholder="Ví dụ: Mua xe mới"
                        />
                    </div>
                    <div className="ekash_form_row">
                        <div className="label">Mô tả</div>
                        <Input.TextArea
                            value={formDescription}
                            onChange={(e) => setFormDescription(e.target.value)}
                            placeholder="Không bắt buộc"
                            rows={2}
                        />
                    </div>
                    <div className="ekash_form_row">
                        <div className="label">Mục tiêu</div>
                        <InputNumber
                            value={formTargetAmount}
                            onChange={(v) =>
                                setFormTargetAmount(Number(v || 0))
                            }
                            style={{ width: "100%" }}
                            min={0}
                            formatter={moneyFormatter}
                            parser={moneyParser}
                        />
                    </div>
                    <div className="ekash_form_row">
                        <div className="label">Hiện tại</div>
                        <InputNumber
                            value={formCurrentAmount}
                            onChange={(v) =>
                                setFormCurrentAmount(Number(v || 0))
                            }
                            style={{ width: "100%" }}
                            min={0}
                            formatter={moneyFormatter}
                            parser={moneyParser}
                        />
                    </div>
                    <div className="ekash_form_row">
                        <div className="label">Hạn chót</div>
                        <DatePicker
                            value={formDeadline ? dayjs(formDeadline) : null}
                            onChange={(d) =>
                                setFormDeadline(
                                    d ? d.startOf("day").toISOString() : "",
                                )
                            }
                            style={{ width: "100%" }}
                            format="DD/MM/YYYY"
                            placeholder="Không bắt buộc"
                        />
                    </div>
                    <div className="ekash_form_row">
                        <div className="label">Trạng thái</div>
                        <Select
                            value={formStatus}
                            onChange={(v) => setFormStatus(v)}
                            style={{ width: "100%" }}
                            options={[
                                { value: "active", label: "Đang thực hiện" },
                                { value: "completed", label: "Hoàn thành" },
                                { value: "expired", label: "Hết hạn" },
                            ]}
                        />
                    </div>
                </div>
            </Modal>

            <AlertNotification
                visible={alertVisible}
                onConfirm={confirmDelete}
                onCancel={cancelDelete}
                title="Xóa mục tiêu"
                content="Bạn có chắc muốn xóa mục tiêu này không?"
                confirmText="Xóa"
                cancelText="Hủy"
                type="warning"
            />
        </div>
    );
};

export default Goals_new;
