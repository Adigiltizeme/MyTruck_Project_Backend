-- CreateEnum
CREATE TYPE "TrackingEventType" AS ENUM ('PICKUP_STARTED', 'PICKUP_COMPLETED', 'IN_TRANSIT', 'DELIVERY_ATTEMPTED', 'DELIVERY_COMPLETED', 'EXCEPTION', 'POSITION_UPDATE');

-- AlterTable
ALTER TABLE "commandes" ADD COLUMN     "actualDelivery" TIMESTAMP(3),
ADD COLUMN     "estimatedDelivery" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "status_history" (
    "id" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "oldStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "reason" TEXT,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_events" (
    "id" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "eventType" "TrackingEventType" NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commandes_statutLivraison_dateLivraison_idx" ON "commandes"("statutLivraison", "dateLivraison");

-- CreateIndex
CREATE INDEX "commandes_magasinId_statutCommande_idx" ON "commandes"("magasinId", "statutCommande");

-- CreateIndex
CREATE INDEX "commandes_clientId_idx" ON "commandes"("clientId");

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "commandes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "commandes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
