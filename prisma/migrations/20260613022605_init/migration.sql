-- CreateTable
CREATE TABLE "ConnectedAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiryDate" DATETIME NOT NULL,
    "lastSyncAt" DATETIME,
    "lastHistoryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billingCycle" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "nextRenewalDate" DATETIME,
    "lastDetectedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "category" TEXT,
    "notes" TEXT,
    "sourceAccountId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "ConnectedAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParsedEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL,
    "parseMethod" TEXT NOT NULL DEFAULT 'RULE',
    "confidence" REAL NOT NULL DEFAULT 0,
    "rawSnippet" TEXT,
    "subscriptionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ParsedEmail_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ConnectedAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ParsedEmail_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "renewalDateSnapshot" DATETIME NOT NULL,
    CONSTRAINT "ReminderLog_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "parsingMode" TEXT NOT NULL DEFAULT 'HYBRID',
    "reminderDaysBefore" TEXT NOT NULL DEFAULT '3,1',
    "reminderChannels" TEXT NOT NULL DEFAULT 'PUSH,EMAIL',
    "reminderFromAccountId" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedAccount_email_key" ON "ConnectedAccount"("email");

-- CreateIndex
CREATE INDEX "Subscription_sourceAccountId_name_idx" ON "Subscription"("sourceAccountId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ParsedEmail_gmailMessageId_key" ON "ParsedEmail"("gmailMessageId");

-- CreateIndex
CREATE INDEX "ReminderLog_subscriptionId_channel_renewalDateSnapshot_idx" ON "ReminderLog"("subscriptionId", "channel", "renewalDateSnapshot");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
