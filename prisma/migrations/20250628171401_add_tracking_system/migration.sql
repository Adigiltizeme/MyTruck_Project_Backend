-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "lastSync" TIMESTAMP(3) NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'db_to_airtable',
    "status" TEXT NOT NULL DEFAULT 'success',
    "errorLog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sync_logs_tableName_key" ON "sync_logs"("tableName");
