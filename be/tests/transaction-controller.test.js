const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

const {
    createInternalTransfer,
    createTransaction,
    deleteTransaction,
    getTransactions,
    updateTransaction,
} = require("../dist/controllers/transaction.controller");
const {
    getBudgetSummary,
} = require("../dist/controllers/budget.controller");
const { updateWallet } = require("../dist/controllers/wallet.controller");
const Budget = require("../dist/models/Budget").default;
const Transaction = require("../dist/models/Transaction").default;
const User = require("../dist/models/User").default;
const Wallet = require("../dist/models/Wallet").default;

const USER_ID = "logic-audit-user";
const USER = {
    uid: USER_ID,
    email: "logic-audit@example.com",
    name: "Logic Audit",
};

const createResponse = () => ({
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(payload) {
        this.body = payload;
        return this;
    },
    set(field, value) {
        if (typeof field === "string") {
            this.headers[field] = value;
        }
        return this;
    },
    vary() {
        return this;
    },
});

const createRequest = ({
    body = {},
    params = {},
    query = {},
    user = USER,
    file,
} = {}) => ({
    body,
    params,
    query,
    user,
    file,
});

const createWallet = async ({
    name,
    balance = 0,
    initialBalance = balance,
    currency = "VND",
    hasTransactions = false,
} = {}) =>
    Wallet.create({
        userId: USER_ID,
        name: name || `Wallet ${Math.random().toString(16).slice(2, 8)}`,
        balance,
        initialBalance,
        currency,
        type: "cash",
        hasTransactions,
    });

const createBudget = async ({
    walletId,
    category = "Food",
    amount = 1_000,
    month = 4,
    year = 2026,
} = {}) =>
    Budget.create({
        userId: USER_ID,
        walletId,
        category,
        amount,
        month,
        year,
    });

const seedUser = async () => {
    await User.create({
        uid: USER_ID,
        email: USER.email,
        username: "logic-audit-user",
        displayName: USER.name,
        hasPassword: true,
        authProviders: ["password"],
        newUser: false,
    });
};

let replSet;

test.before(async () => {
    replSet = await MongoMemoryReplSet.create({
        replSet: { count: 1 },
    });

    await mongoose.connect(replSet.getUri(), {
        dbName: "expense-tracker-tests",
    });

    await User.createCollection();
    await Wallet.createCollection();
    await Budget.createCollection();
    await Transaction.createCollection();
    await User.syncIndexes();
    await Wallet.syncIndexes();
    await Budget.syncIndexes();
    await Transaction.syncIndexes();
});

test.after(async () => {
    await mongoose.disconnect();
    if (replSet) {
        await replSet.stop();
    }
});

test.beforeEach(async () => {
    await Promise.all(
        Object.values(mongoose.connection.collections).map((collection) =>
            collection.deleteMany({}),
        ),
    );
    await seedUser();
});

test("createTransaction rejects future dates and rolls back wallet changes", async () => {
    const wallet = await createWallet({ balance: 5_000 });
    const res = createResponse();

    await createTransaction(
        createRequest({
            body: {
                walletId: String(wallet._id),
                type: "EXPENSE",
                amount: 500,
                category: "Food",
                date: "2099-01-01T12:00:00.000Z",
            },
        }),
        res,
    );

    const refreshedWallet = await Wallet.findById(wallet._id);
    const transactionCount = await Transaction.countDocuments();

    assert.equal(res.statusCode, 400);
    assert.equal(
        res.body.message,
        "Future transactions must use SCHEDULED or PENDING status",
    );
    assert.equal(transactionCount, 0);
    assert.equal(refreshedWallet.balance, 5_000);
    assert.equal(refreshedWallet.hasTransactions, false);
});

test("createTransaction keeps future scheduled expenses out of wallet balance and cashflow summary", async () => {
    const wallet = await createWallet({ balance: 5_000 });
    const createRes = createResponse();

    await createTransaction(
        createRequest({
            body: {
                walletId: String(wallet._id),
                type: "EXPENSE",
                status: "SCHEDULED",
                amount: 800,
                category: "Bills",
                date: "2099-01-01T12:00:00.000Z",
            },
        }),
        createRes,
    );

    const [refreshedWallet, createdTransaction] = await Promise.all([
        Wallet.findById(wallet._id),
        Transaction.findOne({ userId: USER_ID }),
    ]);

    const summaryRes = createResponse();
    await getTransactions(
        createRequest({
            query: { page: 1, limit: 10 },
        }),
        summaryRes,
    );

    assert.equal(createRes.statusCode, 201);
    assert.equal(createdTransaction.status, "SCHEDULED");
    assert.equal(refreshedWallet.balance, 5_000);
    assert.equal(refreshedWallet.hasTransactions, true);
    assert.equal(summaryRes.body.data.summary.expense, 0);
    assert.equal(summaryRes.body.data.summary.income, 0);
});

test("createTransaction rejects linking an expense to a budget from another wallet", async () => {
    const sourceWallet = await createWallet({ balance: 5_000 });
    const anotherWallet = await createWallet({ balance: 3_000 });
    const budget = await createBudget({
        walletId: String(anotherWallet._id),
        category: "Education",
        amount: 2_000,
    });
    const res = createResponse();

    await createTransaction(
        createRequest({
            body: {
                walletId: String(sourceWallet._id),
                type: "EXPENSE",
                amount: 400,
                budgetId: String(budget._id),
                category: "Education",
                date: "2026-04-24T12:00:00.000Z",
            },
        }),
        res,
    );

    assert.equal(res.statusCode, 400);
    assert.equal(
        res.body.message,
        "Selected budget does not belong to the chosen wallet",
    );
    assert.equal(await Transaction.countDocuments(), 0);
});

test("budget summary groups spent and remaining amounts by wallet", async () => {
    const wallet = await createWallet({ name: "Cash", balance: 8_000 });
    const foodBudget = await createBudget({
        walletId: String(wallet._id),
        category: "Food",
        amount: 2_000,
    });
    await createBudget({
        walletId: String(wallet._id),
        category: "Education",
        amount: 1_500,
    });

    const createRes = createResponse();
    await createTransaction(
        createRequest({
            body: {
                walletId: String(wallet._id),
                type: "EXPENSE",
                amount: 700,
                budgetId: String(foodBudget._id),
                category: "Food",
                date: "2026-04-24T12:00:00.000Z",
            },
        }),
        createRes,
    );

    const summaryRes = createResponse();
    await getBudgetSummary(
        createRequest({
            query: { month: 4, year: 2026 },
        }),
        summaryRes,
    );

    assert.equal(summaryRes.statusCode, 200);
    assert.equal(summaryRes.body.totalBudget, 3_500);
    assert.equal(summaryRes.body.totalSpent, 700);
    assert.equal(summaryRes.body.walletSummaries.length, 1);
    assert.equal(summaryRes.body.walletSummaries[0].walletId, String(wallet._id));
    assert.equal(summaryRes.body.walletSummaries[0].totalRemaining, 2_800);
});

test("createTransaction rejects a budget linked to the wrong month even for scheduled expenses", async () => {
    const wallet = await createWallet({ balance: 6_000 });
    const budget = await createBudget({
        walletId: String(wallet._id),
        category: "Food",
        amount: 2_000,
        month: 4,
        year: 2026,
    });
    const res = createResponse();

    await createTransaction(
        createRequest({
            body: {
                walletId: String(wallet._id),
                type: "EXPENSE",
                status: "SCHEDULED",
                amount: 500,
                budgetId: String(budget._id),
                category: "Food",
                date: "2026-05-02T12:00:00.000Z",
            },
        }),
        res,
    );

    const refreshedWallet = await Wallet.findById(wallet._id);

    assert.equal(res.statusCode, 400);
    assert.equal(
        res.body.message,
        "Budget does not belong to the selected transaction month",
    );
    assert.equal(await Transaction.countDocuments(), 0);
    assert.equal(refreshedWallet.balance, 6_000);
});

test("createTransaction rejects oversized amounts", async () => {
    const wallet = await createWallet({ balance: 5_000 });
    const res = createResponse();

    await createTransaction(
        createRequest({
            body: {
                walletId: String(wallet._id),
                type: "INCOME",
                amount: Number.MAX_SAFE_INTEGER + 1,
                category: "Salary",
            },
        }),
        res,
    );

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, "Amount exceeds the supported limit");
    assert.equal(await Transaction.countDocuments(), 0);
});

test("createInternalTransfer writes both legs atomically and excludes them from cashflow summary", async () => {
    const sourceWallet = await createWallet({ name: "Source", balance: 5_000 });
    const destinationWallet = await createWallet({
        name: "Destination",
        balance: 1_000,
    });

    const transferRes = createResponse();
    await createInternalTransfer(
        createRequest({
            body: {
                fromWalletId: String(sourceWallet._id),
                toWalletId: String(destinationWallet._id),
                amount: 1_200,
                date: "2026-04-24T12:00:00.000Z",
                sourceNote: "Transfer to Destination",
                destinationNote: "Received from Source",
            },
        }),
        transferRes,
    );

    assert.equal(transferRes.statusCode, 201);
    assert.ok(transferRes.body.data.transferGroupId);

    const [updatedSource, updatedDestination, summaryRes] = await Promise.all([
        Wallet.findById(sourceWallet._id),
        Wallet.findById(destinationWallet._id),
        (async () => {
            const response = createResponse();
            await getTransactions(
                createRequest({
                    query: { page: 1, limit: 10 },
                }),
                response,
            );
            return response;
        })(),
    ]);

    const transactions = await Transaction.find().lean();
    assert.equal(transactions.length, 2);
    assert.equal(updatedSource.balance, 3_800);
    assert.equal(updatedDestination.balance, 2_200);
    assert.equal(updatedSource.hasTransactions, true);
    assert.equal(updatedDestination.hasTransactions, true);
    assert.equal(summaryRes.statusCode, 200);
    assert.equal(summaryRes.body.data.summary.income, 0);
    assert.equal(summaryRes.body.data.summary.expense, 0);
});

test("deleteTransaction removes both transfer legs and restores both wallet balances", async () => {
    const sourceWallet = await createWallet({ name: "Source", balance: 5_000 });
    const destinationWallet = await createWallet({
        name: "Destination",
        balance: 1_000,
    });

    const transferRes = createResponse();
    await createInternalTransfer(
        createRequest({
            body: {
                fromWalletId: String(sourceWallet._id),
                toWalletId: String(destinationWallet._id),
                amount: 700,
                date: "2026-04-24T12:00:00.000Z",
            },
        }),
        transferRes,
    );

    const oneLeg = await Transaction.findOne({ userId: USER_ID });
    const deleteRes = createResponse();
    await deleteTransaction(
        createRequest({
            params: { id: String(oneLeg._id) },
        }),
        deleteRes,
    );

    const [updatedSource, updatedDestination, remainingTransactions] =
        await Promise.all([
            Wallet.findById(sourceWallet._id),
            Wallet.findById(destinationWallet._id),
            Transaction.countDocuments(),
        ]);

    assert.equal(deleteRes.statusCode, 200);
    assert.equal(deleteRes.body.data.deletedCount, 2);
    assert.equal(remainingTransactions, 0);
    assert.equal(updatedSource.balance, 5_000);
    assert.equal(updatedDestination.balance, 1_000);
    assert.equal(updatedSource.hasTransactions, false);
    assert.equal(updatedDestination.hasTransactions, false);
});

test("deleteTransaction clears hasTransactions when the last normal transaction is removed", async () => {
    const wallet = await createWallet({ balance: 2_000 });

    const createRes = createResponse();
    await createTransaction(
        createRequest({
            body: {
                walletId: String(wallet._id),
                type: "EXPENSE",
                amount: 500,
                category: "Food",
                date: "2026-04-24T12:00:00.000Z",
            },
        }),
        createRes,
    );

    const createdTransaction = await Transaction.findOne({ userId: USER_ID });
    const deleteRes = createResponse();
    await deleteTransaction(
        createRequest({
            params: { id: String(createdTransaction._id) },
        }),
        deleteRes,
    );

    const refreshedWallet = await Wallet.findById(wallet._id);
    assert.equal(deleteRes.statusCode, 200);
    assert.equal(refreshedWallet.balance, 2_000);
    assert.equal(refreshedWallet.hasTransactions, false);
    assert.equal(await Transaction.countDocuments(), 0);
});

test("updateTransaction aborts cleanly when moving an expense to a wallet without enough balance", async () => {
    const sourceWallet = await createWallet({ name: "Source", balance: 1_000 });
    const lowBalanceWallet = await createWallet({
        name: "Low Balance",
        balance: 50,
    });

    const createRes = createResponse();
    await createTransaction(
        createRequest({
            body: {
                walletId: String(sourceWallet._id),
                type: "EXPENSE",
                amount: 100,
                category: "Food",
                date: "2026-04-24T12:00:00.000Z",
            },
        }),
        createRes,
    );

    const originalTransaction = await Transaction.findOne({ userId: USER_ID });
    const updateRes = createResponse();
    await updateTransaction(
        createRequest({
            params: { id: String(originalTransaction._id) },
            body: {
                walletId: String(lowBalanceWallet._id),
                amount: 200,
                type: "EXPENSE",
                category: "Food",
                date: "2026-04-24T12:00:00.000Z",
            },
        }),
        updateRes,
    );

    const [refreshedSource, refreshedLowBalance, unchangedTransaction] =
        await Promise.all([
            Wallet.findById(sourceWallet._id),
            Wallet.findById(lowBalanceWallet._id),
            Transaction.findById(originalTransaction._id),
        ]);

    assert.equal(updateRes.statusCode, 400);
    assert.equal(updateRes.body.message, "Insufficient wallet balance");
    assert.equal(refreshedSource.balance, 900);
    assert.equal(refreshedLowBalance.balance, 50);
    assert.equal(String(unchangedTransaction.walletId), String(sourceWallet._id));
    assert.equal(unchangedTransaction.amount, 100);
});

test("updateTransaction applies wallet impact only when a scheduled expense becomes completed", async () => {
    const wallet = await createWallet({ balance: 2_000 });
    const createRes = createResponse();

    await createTransaction(
        createRequest({
            body: {
                walletId: String(wallet._id),
                type: "EXPENSE",
                status: "SCHEDULED",
                amount: 450,
                category: "Bills",
                date: "2026-04-24T12:00:00.000Z",
            },
        }),
        createRes,
    );

    const scheduledTransaction = await Transaction.findOne({ userId: USER_ID });
    const walletAfterCreate = await Wallet.findById(wallet._id);

    const updateRes = createResponse();
    await updateTransaction(
        createRequest({
            params: { id: String(scheduledTransaction._id) },
            body: {
                status: "COMPLETED",
                type: "EXPENSE",
                amount: 450,
                category: "Bills",
                date: "2026-04-24T12:00:00.000Z",
            },
        }),
        updateRes,
    );

    const [refreshedWallet, refreshedTransaction] = await Promise.all([
        Wallet.findById(wallet._id),
        Transaction.findById(scheduledTransaction._id),
    ]);

    assert.equal(walletAfterCreate.balance, 2_000);
    assert.equal(updateRes.statusCode, 200);
    assert.equal(refreshedTransaction.status, "COMPLETED");
    assert.equal(refreshedWallet.balance, 1_550);
});

test("updateWallet rejects direct balance edits from the wallet form", async () => {
    const wallet = await createWallet({ balance: 1_000, initialBalance: 1_000 });
    const res = createResponse();

    await updateWallet[1](
        createRequest({
            params: { id: String(wallet._id) },
            body: {
                balance: 2_000,
            },
        }),
        res,
    );

    const refreshedWallet = await Wallet.findById(wallet._id);
    assert.equal(res.statusCode, 400);
    assert.equal(
        res.body.message,
        "Current wallet balance cannot be edited directly. Create a transaction or adjustment instead.",
    );
    assert.equal(refreshedWallet.balance, 1_000);
    assert.equal(refreshedWallet.initialBalance, 1_000);
});
