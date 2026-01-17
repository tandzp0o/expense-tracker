import axios, { AxiosInstance } from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Create an authenticated API client with the provided token
const createApiClient = (token?: string): AxiosInstance => {
    return axios.create({
        baseURL: API_URL + "/api",
        headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
        },
    });
};

// Create an authenticated API client for multipart/form-data
const createMultipartApiClient = (token?: string): AxiosInstance => {
    return axios.create({
        baseURL: API_URL + "/api",
        headers: {
            // Let the browser set the Content-Type to multipart/form-data
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
                "Có lỗi xảy ra khi kết nối đến máy chủ",
        );
    } else if (error.request) {
        console.error("Network Error:", error.request);
        throw new Error(
            "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng của bạn.",
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
        token?: string,
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
                transactionData,
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
        token?: string,
    ) => {
        try {
            const apiClient = createApiClient(token);
            const response = await apiClient.put(
                `/transactions/${id}`,
                transactionData,
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
                { totalIncome: 0, totalExpense: 0 },
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

    // Get statement report
    getStatementReport: async (params: any, token: any) => {
        const apiClient = createApiClient(token);
        const response = await apiClient.get("/transactions/statement-report", {
            params: {
                ...params,
                // Thêm các tham số cần thiết khác nếu có
            },
        });
        return response.data;
    },

    // Get expenses by category
    getExpenseByCategory: async (
        month: number,
        year: number,
        token?: string,
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
                {},
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

export const dishApi = {
    // Create a new dish
    createDish: async (dishData: FormData, token?: string) => {
        try {
            const apiClient = createMultipartApiClient(token);
            const response = await apiClient.post("/dishes", dishData);
            return response.data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Get dishes with optional filter
    getDishes: async (preferences?: string, token?: string) => {
        try {
            const apiClient = createApiClient(token);
            const response = await apiClient.get("/dishes", {
                params: { preferences },
            });
            return response.data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Get random dish
    getRandomDish: async (preferences?: string, token?: string) => {
        try {
            const apiClient = createApiClient(token);
            const response = await apiClient.get("/dishes/random", {
                params: { preferences },
            });
            return response.data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Update a dish
    updateDish: async (id: string, dishData: FormData, token?: string) => {
        try {
            const apiClient = createMultipartApiClient(token);
            const response = await apiClient.put(`/dishes/${id}`, dishData);
            return response.data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Delete a dish
    deleteDish: async (id: string, token?: string) => {
        try {
            const apiClient = createApiClient(token);
            const response = await apiClient.delete(`/dishes/${id}`);
            return response.data;
        } catch (error) {
            return handleApiError(error);
        }
    },
};

// --- Goal API ---
export const goalApi = {
    // Get all goals for the current user
    getGoals: async (token?: string) => {
        try {
            const apiClient = createApiClient(token);
            const response = await apiClient.get("/goals");
            return response.data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Create a new goal
    createGoal: async (goalData: any, token?: string) => {
        try {
            const apiClient = createApiClient(token);
            const response = await apiClient.post("/goals", goalData);
            return response.data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Update an existing goal
    updateGoal: async (id: string, goalData: any, token?: string) => {
        try {
            const apiClient = createApiClient(token);
            const response = await apiClient.put(`/goals/${id}`, goalData);
            return response.data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Delete a goal
    deleteGoal: async (id: string, token?: string) => {
        try {
            const apiClient = createApiClient(token);
            const response = await apiClient.delete(`/goals/${id}`);
            return response.data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Get goal statistics
    getGoalStats: async (token?: string) => {
        try {
            const apiClient = createApiClient(token);
            const response = await apiClient.get("/goals/stats");
            return response.data;
        } catch (error) {
            return handleApiError(error);
        }
    },
};

// --- User API ---
export const userApi = {
    // Get user profile
    getProfile: async (token?: string) => {
        try {
            const apiClient = createApiClient(token);
            const response = await apiClient.get("/users/profile");
            return response.data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Update user profile
    updateProfile: async (profileData: any, token?: string) => {
        try {
            const apiClient = createApiClient(token);
            const response = await apiClient.put("/users/profile", profileData);
            return response.data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Get user profile statistics
    getProfileStats: async (token?: string) => {
        try {
            const apiClient = createApiClient(token);
            const response = await apiClient.get("/users/profile/stats");
            return response.data;
        } catch (error) {
            return handleApiError(error);
        }
    },

    // Upload user avatar
    uploadAvatar: async (imageData: FormData, token?: string) => {
        try {
            const apiClient = createMultipartApiClient(token);
            const response = await apiClient.post(
                "/users/profile/avatar",
                imageData,
            );
            return response.data;
        } catch (error) {
            return handleApiError(error);
        }
    },
};

const api = {
    wallet: walletApi,
    transaction: transactionApi,
    dish: dishApi,
    goal: goalApi,
    user: userApi,
};

export default api;
