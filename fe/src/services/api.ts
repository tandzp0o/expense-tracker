import axios, { AxiosInstance } from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

// Create an authenticated API client with the provided token
const createApiClient = (token?: string): AxiosInstance => {
    return axios.create({
        baseURL: API_URL,
        headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
        },
    });
};

// Handle API errors consistently
const handleApiError = (error: any) => {
    if (error.response) {
        console.error("API Error:", error.response.data);
        throw new Error(
            error.response.data.message ||
                "Có lỗi xảy ra khi kết nối đến máy chủ"
        );
    } else if (error.request) {
        console.error("Network Error:", error.request);
        throw new Error(
            "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng của bạn."
        );
    } else {
        console.error("Error:", error.message);
        throw new Error("Đã xảy ra lỗi khi gửi yêu cầu");
    }
};

// --- Wallet API ---
export const walletApi = {
    // Get all wallets with total balance
    getWallets: async (token?: string) => {
        try {
            const apiClient = createApiClient(token);
            const response = await apiClient.get("/wallets");
            return response.data;
        } catch (error) {
            return handleApiError(error);
        }
    },
    // Create a new wallet
    createWallet: async (walletData: any, token?: string) => {
        try {
            const apiClient = createApiClient(token);
            const response = await apiClient.post("/wallets", walletData);
            return response.data;
        } catch (error) {
            return handleApiError(error);
        }
    },
    // Update an existing wallet
    updateWallet: async (id: string, walletData: any, token?: string) => {
        try {
            const apiClient = createApiClient(token);
            const response = await apiClient.put(`/wallets/${id}`, walletData);
            return response.data;
        } catch (error) {
            return handleApiError(error);
        }
    },
    // Delete a wallet
    deleteWallet: async (id: string, token?: string) => {
        try {
            const apiClient = createApiClient(token);
            const response = await apiClient.delete(`/wallets/${id}`);
            return response.data;
        } catch (error) {
            return handleApiError(error);
        }
    },
};

// --- Transaction API ---
export const transactionApi = {
    // Get transactions with filters
    getTransactions: async (
        params: {
            startDate?: string;
            endDate?: string;
            type?: "INCOME" | "EXPENSE";
            category?: string;
            walletId?: string;
            limit?: number;
            sort?: string;
            note?: string;
        },
        token?: string
    ) => {
        try {
            const apiClient = createApiClient(token);
            const response = await apiClient.get("/transactions", { params });
            return response.data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Create a new transaction
    createTransaction: async (transactionData: any, token?: string) => {
        try {
            const apiClient = createApiClient(token);
            const response = await apiClient.post(
                "/transactions",
                transactionData
            );
            return response.data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Update an existing transaction
    updateTransaction: async (
        id: string,
        transactionData: any,
        token?: string
    ) => {
        try {
            const apiClient = createApiClient(token);
            const response = await apiClient.put(
                `/transactions/${id}`,
                transactionData
            );
            return response.data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Delete a transaction
    deleteTransaction: async (id: string, token?: string) => {
        try {
            const apiClient = createApiClient(token);
            const response = await apiClient.delete(`/transactions/${id}`);
            return response.data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Get dashboard statistics
    getDashboardStats: async (month: number, year: number, token?: string) => {
        try {
            const startDate = new Date(year, month - 1, 1).toISOString();
            const endDate = new Date(year, month, 0).toISOString();

            const apiClient = createApiClient(token);
            const response = await apiClient.get("/transactions", {
                params: {
                    startDate,
                    endDate,
                },
            });

            // Lấy danh sách giao dịch
            const transactions = response.data?.data?.transactions || [];

            // Định nghĩa interface cho giao dịch
            interface Transaction {
                type: string;
                amount: number | string;
            }

            // Định nghĩa interface cho kết quả thống kê
            interface TransactionStats {
                totalIncome: number;
                totalExpense: number;
            }

            // Tính tổng thu nhập và chi tiêu
            const { totalIncome, totalExpense } = transactions.reduce(
                (acc: TransactionStats, transaction: Transaction) => {
                    if (transaction.type === "INCOME") {
                        acc.totalIncome += Number(transaction.amount) || 0;
                    } else if (transaction.type === "EXPENSE") {
                        acc.totalExpense += Number(transaction.amount) || 0;
                    }
                    return acc;
                },
                { totalIncome: 0, totalExpense: 0 }
            );

            // Trả về dữ liệu đã được tính toán
            return {
                totalIncome,
                totalExpense,
                transactions,
                ...response.data?.data,
            };
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Get expenses by category
    getExpenseByCategory: async (
        month: number,
        year: number,
        token?: string
    ) => {
        try {
            const startDate = new Date(year, month - 1, 1).toISOString();
            const endDate = new Date(year, month, 0).toISOString();

            const apiClient = createApiClient(token);
            const response = await apiClient.get("/transactions", {
                params: {
                    startDate,
                    endDate,
                    type: "EXPENSE",
                },
            });

            // Group by category
            const categories = (response.data?.data?.transactions || []).reduce(
                (acc: any, t: any) => {
                    if (!acc[t.category]) {
                        acc[t.category] = 0;
                    }
                    acc[t.category] += t.amount;
                    return acc;
                },
                {}
            );

            return {
                data: Object.entries(categories).map(([name, total]) => ({
                    name,
                    total,
                    _id: name.toLowerCase().replace(/\s+/g, "-"),
                })),
            };
        } catch (error) {
            return handleApiError(error);
        }
    },
};

export default {
    wallet: walletApi,
    transaction: transactionApi,
};