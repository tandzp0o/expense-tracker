const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { getProfileStats } = require("../dist/controllers/user.controller");
const Budget = require("../dist/models/Budget").default;
const Goal = require("../dist/models/Goal").default;
const Transaction = require("../dist/models/Transaction").default;
const Wallet = require("../dist/models/Wallet").default;

const USER_ID = "profile-stats-user";

const createResponse = () => ({
    statusCode: 200,
    body: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(payload) {
        this.body = payload;
        return this;
    },
    set() {
        return this;
    },
});

const monthStart = (offset) => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + offset, 1);
};

// Midday on a given day of the month `offset` months from now.
const dayIn = (offset, day) => {
    const start = monthStart(offset);
    return new Date(start.getFullYear(), start.getMonth(), day, 12);
};

let server;

test.before(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri(), { dbName: "profile-stats-tests" });
});

test.after(async () => {
    await mongoose.disconnect();
    await server.stop();
});

test("profile stats sums each month the way the old month-by-month queries did", async () => {
    const wallet = await Wallet.create({
        userId: USER_ID,
        name: "Cash",
        type: "cash",
        balance: 1_000_000,
        initialBalance: 0,
        currency: "VND",
    });
    await Wallet.create({
        userId: USER_ID,
        name: "Old",
        type: "cash",
        balance: 999_999,
        initialBalance: 0,
        currency: "VND",
        isArchived: true,
    });

    const base = { userId: USER_ID, walletId: wallet._id };
    await Transaction.insertMany([
        // This month.
        { ...base, type: "INCOME", amount: 500, category: "Lương", date: dayIn(0, 1), status: "COMPLETED" },
        { ...base, type: "EXPENSE", amount: 120, category: "Ăn uống", date: dayIn(0, 2), status: "COMPLETED" },
        // Not counted: scheduled, a transfer leg, a goal move.
        { ...base, type: "EXPENSE", amount: 999, category: "Hóa đơn", date: dayIn(0, 4), status: "SCHEDULED" },
        { ...base, type: "EXPENSE", amount: 777, category: "Transfer", date: dayIn(0, 5), status: "COMPLETED" },
        { ...base, type: "GOAL_DEPOSIT", amount: 555, category: "Goal", date: dayIn(0, 6), status: "COMPLETED" },
        // Last month.
        { ...base, type: "INCOME", amount: 400, category: "Lương", date: dayIn(-1, 10), status: "COMPLETED" },
        { ...base, type: "EXPENSE", amount: 100, category: "Ăn uống", date: dayIn(-1, 28), status: "COMPLETED" },
        // Five months ago, the oldest month in the chart.
        { ...base, type: "EXPENSE", amount: 60, category: "Ăn uống", date: dayIn(-5, 1), status: "COMPLETED" },
        // Six months ago: outside the chart.
        { ...base, type: "INCOME", amount: 5_000, category: "Lương", date: dayIn(-6, 15), status: "COMPLETED" },
        // Another user's money never leaks in.
        { userId: "someone-else", walletId: wallet._id, type: "INCOME", amount: 8_888, category: "Lương", date: dayIn(0, 7), status: "COMPLETED" },
    ]);
    // A row from before the status field existed counts as completed. Written
    // straight to the collection, since the model would fill in the default.
    await Transaction.collection.insertOne({
        ...base,
        type: "EXPENSE",
        amount: 30,
        category: "Khác",
        date: dayIn(0, 3),
    });

    await Budget.create({ userId: USER_ID, category: "Ăn uống", amount: 1_000, month: 1, year: 2026 });
    await Goal.create({ userId: USER_ID, title: "Trip", category: "Du lịch", targetAmount: 100, currentAmount: 100, status: "completed" });
    await Goal.create({ userId: USER_ID, title: "Laptop", category: "Công nghệ", targetAmount: 100, currentAmount: 10, status: "active" });

    const res = createResponse();
    await getProfileStats({ user: { uid: USER_ID } }, res);

    assert.equal(res.statusCode, 200);
    const stats = res.body;

    assert.equal(stats.totalBalance, 1_000_000, "archived wallets are left out");
    assert.equal(stats.totalWallets, 1);
    assert.equal(stats.totalTransactions, 10);
    assert.equal(stats.totalBudgets, 1);
    assert.equal(stats.monthlyIncome, 500);
    assert.equal(stats.monthlyExpense, 150);
    assert.equal(stats.incomeGrowth, 25);
    assert.equal(stats.expenseGrowth, 50);
    assert.equal(stats.totalGoals, 2);
    assert.equal(stats.completedGoals, 1);
    assert.equal(stats.activeGoals, 1);

    assert.equal(stats.history.length, 6);
    assert.deepEqual(
        stats.history.map((point) => point.month),
        [-5, -4, -3, -2, -1, 0].map((offset) => `Th${monthStart(offset).getMonth() + 1}`),
    );
    assert.deepEqual(stats.history[0], { month: stats.history[0].month, balance: -60, income: 0, expense: 60 });
    assert.deepEqual(stats.history[1], { month: stats.history[1].month, balance: 0, income: 0, expense: 0 });
    assert.deepEqual(stats.history[4], { month: stats.history[4].month, balance: 300, income: 400, expense: 100 });
    assert.deepEqual(stats.history[5], { month: stats.history[5].month, balance: 350, income: 500, expense: 150 });
});
