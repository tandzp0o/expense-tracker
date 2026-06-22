# Model Structure Overview

This document summarizes all backend models under `be/src/models`.

## User (`User.ts`)

- Collection: `User`
- Purpose: stores profile, auth state, and user-level financial aggregate/cache fields.

Fields:
- `uid`: `string`, required, unique
- `email`: `string`, required, unique
- `username`: `string`, unique, sparse, trimmed, lowercase
- `displayName`: `string`, optional
- `phone`: `string`, optional
- `bio`: `string`, optional
- `avatar`: `string`, optional
- `address`: `string`, optional
- `hasPassword`: `boolean`, default `false`
- `authProviders`: `("google" | "password")[]`, default `[]`
- `totalBalance`: `number`, default `0`
- `totalIncome`: `number`, default `0`
- `totalExpense`: `number`, default `0`
- `goalsCompleted`: `number`, default `0`
- `goalsActive`: `number`, default `0`
- `newUser`: `boolean`, default `true`
- `transactionCacheVersion`: `number`, default `0`
- `transactionsUpdatedAt`: `Date`, default `Date.now`
- `createdAt`: `Date` (from `timestamps: true`)
- `updatedAt`: `Date` (from `timestamps: true`)

Indexes/constraints:
- Unique: `uid`, `email`, `username` (sparse)

## Wallet (`Wallet.ts`)

- Collection: `Wallet`
- Purpose: stores money containers (cash/bank/e-wallet) for a user.

Fields:
- `userId`: `string`, required, indexed
- `type`: `"cash" | "bank" | "ewallet"`, default `"cash"`
- `currency`: `string`, default `"VND"`
- `icon`: `string`, optional
- `color`: `string`, optional
- `isArchived`: `boolean`, default `false`
- `hasTransactions`: `boolean`, default `false`
- `name`: `string`, required
- `accountNumber`: `string`, optional
- `description`: `string`, optional
- `balance`: `number`, required, default `0`
- `initialBalance`: `number`, required, default `0`
- `imageUrl`: `string`, optional
- `createdAt`: `Date`, default `Date.now`
- `updatedAt`: `Date`, default `Date.now`

Indexes/constraints:
- Index: `userId`

## Transaction (`Transaction.ts`)

- Collection: `Transaction`
- Purpose: stores all financial records (income, expense, transfer, goal movements, adjustments).

Enums:
- `TransactionType`: `INCOME | EXPENSE | GOAL_DEPOSIT | GOAL_WITHDRAW | ADJUSTMENT`
- `TransactionStatus`: `SCHEDULED | PENDING | COMPLETED | FAILED | CANCELLED`

Fields:
- `userId`: `string`, required, indexed
- `walletId`: `ObjectId` (ref `Wallet`), required
- `transferPeerWalletId`: `ObjectId` (ref `Wallet`), optional
- `transferGroupId`: `string`, optional, indexed
- `budgetId`: `ObjectId` (ref `Budget`), optional
- `goalId`: `ObjectId` (ref `Goal`), optional
- `type`: `TransactionType`, required
- `status`: `TransactionStatus`, required, default `COMPLETED`, indexed
- `amount`: `number`, required, min `0`
- `isSystemGenerated`: `boolean`, default `false`
- `isDeletable`: `boolean`, default `true`
- `category`: `string`, required
- `date`: `Date`, required, default `Date.now`
- `note`: `string`, optional
- `createdAt`: `Date`, default `Date.now`

Indexes/constraints:
- Index: `{ userId: 1, date: -1, createdAt: -1 }`
- Index: `{ userId: 1, walletId: 1, date: -1, createdAt: -1 }`
- Index: `{ userId: 1, transferGroupId: 1 }`
- Index: `{ userId: 1, type: 1, date: -1, createdAt: -1 }`
- Index: `{ userId: 1, status: 1, date: -1, createdAt: -1 }`
- Index: `{ userId: 1, category: 1, date: -1, createdAt: -1 }`

## Budget (`Budget.ts`)

- Collection: `Budget`
- Purpose: category budget by wallet and month/year.

Fields:
- `userId`: `string`, required, indexed
- `walletId`: `ObjectId` (ref `Wallet`), required, indexed
- `category`: `string`, required
- `amount`: `number`, required, min `0`
- `month`: `number`, required, min `1`, max `12`, indexed
- `year`: `number`, required, indexed
- `note`: `string`, optional
- `color`: `string`, optional
- `createdAt`: `Date`, default `Date.now`
- `updatedAt`: `Date`, default `Date.now`, updated in pre-save hook

Indexes/constraints:
- Unique compound index: `{ userId, walletId, category, month, year }`

## Goal (`Goal.ts`)

- Collection: `Goal`
- Purpose: savings targets and progress tracking.

Fields:
- `userId`: `string`, required
- `title`: `string`, required
- `description`: `string`, optional
- `targetAmount`: `number`, required
- `currentAmount`: `number`, default `0`
- `category`: `string`, required
- `deadline`: `Date`, optional
- `status`: `"active" | "completed" | "expired"`, default `"active"`
- `imageUrl`: `string`, optional
- `createdAt`: `Date`, default `Date.now`
- `updatedAt`: `Date`, default `Date.now`, updated in pre-save hook

Indexes/constraints:
- No explicit custom index in current schema

## Dish (`Dish.ts`)

- Collection: `Dish`
- Purpose: suggested/saved dishes with preferences and price hints.

Fields:
- `userId`: `string`, required
- `name`: `string`, required
- `price`: `number | null`, optional
- `description`: `string`, optional
- `imageUrls`: `string[]`, optional array
- `preferences`: `string[]`, optional array
- `address`: `string`, optional
- `createdAt`: `Date`, default `Date.now`

Indexes/constraints:
- No explicit custom index in current schema

## Relationship Map (Logical)

- `User (uid)` owns many:
- `Wallet` via `Wallet.userId`
- `Transaction` via `Transaction.userId`
- `Budget` via `Budget.userId`
- `Goal` via `Goal.userId`
- `Dish` via `Dish.userId`

- `Wallet` has many:
- `Transaction` via `Transaction.walletId`
- `Budget` via `Budget.walletId`

- `Goal` is optionally linked from `Transaction.goalId`
- `Budget` is optionally linked from `Transaction.budgetId`
- Internal transfer can be represented by:
- `Transaction.transferGroupId`
- `Transaction.transferPeerWalletId`
