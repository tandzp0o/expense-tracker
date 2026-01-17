// Bar Chart Configuration for Transaction Analysis
export const barChartData = {
    labels: [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ],
    datasets: [
        {
            label: "Chi tiêu",
            data: [400, 300, 200, 278, 189, 239, 349, 200, 220, 250, 210, 190],
            backgroundColor: "#f5222d",
            borderRadius: 5,
            maxBarThickness: 22,
        },
        {
            label: "Thu nhập",
            data: [
                2400, 1398, 9800, 3908, 4800, 3800, 4300, 2300, 2200, 1250,
                2210, 2290,
            ],
            backgroundColor: "#52c41a",
            borderRadius: 5,
            maxBarThickness: 22,
        },
    ],
};

export const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: "top" as const,
            labels: {
                color: "#9ca3af",
            },
        },
        tooltip: {
            callbacks: {
                label: (context: any) => {
                    const label = context.dataset?.label
                        ? `${context.dataset.label}: `
                        : "";
                    const value =
                        typeof context.parsed?.y === "number"
                            ? context.parsed.y
                            : 0;
                    return `${label}${value.toLocaleString("vi-VN")} VND`;
                },
            },
        },
    },
    scales: {
        x: {
            grid: {
                display: false,
            },
            ticks: {
                color: "#9ca3af",
            },
        },
        y: {
            grid: {
                display: true,
                color: "#e5e7eb",
                borderDash: [2, 2],
            },
            ticks: {
                color: "#9ca3af",
                callback: (value: any) =>
                    `${Number(value).toLocaleString("vi-VN")}`,
            },
            title: {
                display: true,
                text: "Số tiền (VND)",
                color: "#9ca3af",
            },
        },
    },
};

// Line Chart Configuration for Trend Analysis
export const lineChartData = {
    labels: [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ],
    datasets: [
        {
            label: "Số dư ví",
            data: [10, 41, 35, 51, 49, 62, 69, 91, 148, 200, 250, 300],
            borderColor: "#1890ff",
            backgroundColor: "rgba(24, 144, 255, 0.15)",
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 3,
        },
    ],
};

export const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: false,
        },
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
            grid: {
                display: false,
            },
            ticks: {
                color: "#9ca3af",
            },
        },
        y: {
            grid: {
                display: true,
                color: "#e5e7eb",
                borderDash: [2, 2],
            },
            ticks: {
                color: "#9ca3af",
                callback: (value: any) =>
                    `${Number(value).toLocaleString("vi-VN")}`,
            },
            title: {
                display: true,
                text: "Số dư (VND)",
                color: "#9ca3af",
            },
        },
    },
};

// Pie Chart Configuration for Category Breakdown
export const pieChartData = {
    labels: ["Ăn uống", "Mua sắm", "Hóa đơn", "Giải trí", "Y tế"],
    datasets: [
        {
            label: "Chi tiêu",
            data: [300000, 150000, 100000, 50000, 75000],
            backgroundColor: [
                "#1890ff",
                "#52c41a",
                "#faad14",
                "#f5222d",
                "#722ed1",
            ],
            borderWidth: 0,
        },
    ],
};

export const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: "bottom" as const,
            labels: {
                color: "#9ca3af",
            },
        },
        tooltip: {
            callbacks: {
                label: (context: any) => {
                    const label = context.label ? `${context.label}: ` : "";
                    const value =
                        typeof context.parsed === "number" ? context.parsed : 0;
                    return `${label}${value.toLocaleString("vi-VN")} VND`;
                },
            },
        },
    },
};

// Area Chart Configuration for Balance Trend
export const areaChartData = {
    labels: [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ],
    datasets: [
        {
            label: "Số dư",
            data: [10, 41, 35, 51, 49, 62, 69, 91, 148, 200, 250, 300],
            borderColor: "#1890ff",
            backgroundColor: "rgba(24, 144, 255, 0.2)",
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 2,
        },
    ],
};

export const areaChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: false,
        },
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
            grid: {
                display: false,
            },
            ticks: {
                color: "#9ca3af",
            },
        },
        y: {
            grid: {
                display: true,
                color: "#e5e7eb",
                borderDash: [2, 2],
            },
            ticks: {
                color: "#9ca3af",
                callback: (value: any) =>
                    `${Number(value).toLocaleString("vi-VN")}`,
            },
            title: {
                display: true,
                text: "Số dư (VND)",
                color: "#9ca3af",
            },
        },
    },
};
