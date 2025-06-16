-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'DIRECTION', 'MAGASIN', 'CHAUFFEUR', 'INTERLOCUTEUR');

-- CreateEnum
CREATE TYPE "PhotoType" AS ENUM ('ARTICLE', 'ENLEVEMENT', 'LIVRAISON');

-- CreateEnum
CREATE TYPE "CommentaireType" AS ENUM ('GENERAL', 'ENLEVEMENT', 'LIVRAISON');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "telephone" TEXT,
    "role" "UserRole" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Actif',
    "magasinId" TEXT,
    "airtableId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magasins" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "telephone" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Actif',
    "categories" TEXT[],
    "airtableId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "magasins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chauffeurs" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Actif',
    "longitude" DOUBLE PRECISION,
    "latitude" DOUBLE PRECISION,
    "notes" INTEGER,
    "airtableId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "chauffeurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "telephone" TEXT,
    "telephoneSecondaire" TEXT,
    "adresseLigne1" TEXT NOT NULL,
    "codePostal" TEXT,
    "ville" TEXT,
    "batiment" TEXT,
    "etage" TEXT,
    "interphone" TEXT,
    "ascenseur" BOOLEAN NOT NULL DEFAULT false,
    "typeAdresse" TEXT,
    "airtableId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commandes" (
    "id" TEXT NOT NULL,
    "numeroCommande" TEXT NOT NULL,
    "dateCommande" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateLivraison" TIMESTAMP(3) NOT NULL,
    "creneauLivraison" TEXT,
    "statutCommande" TEXT NOT NULL DEFAULT 'En attente',
    "statutLivraison" TEXT NOT NULL DEFAULT 'EN ATTENTE',
    "tarifHT" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reserveTransport" BOOLEAN NOT NULL DEFAULT false,
    "categorieVehicule" TEXT,
    "optionEquipier" INTEGER NOT NULL DEFAULT 0,
    "clientId" TEXT NOT NULL,
    "magasinId" TEXT NOT NULL,
    "prenomVendeur" TEXT,
    "remarques" TEXT,
    "airtableId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "commandes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chauffeur_sur_commande" (
    "id" TEXT NOT NULL,
    "chauffeurId" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chauffeur_sur_commande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "nombre" INTEGER NOT NULL,
    "details" TEXT,
    "categories" TEXT[],
    "commandeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT,
    "size" INTEGER,
    "type" "PhotoType" NOT NULL,
    "commandeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commentaires" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "CommentaireType" NOT NULL,
    "commandeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commentaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rapports_enlevement" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "chauffeurId" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rapports_enlevement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rapports_livraison" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "chauffeurId" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rapports_livraison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factures" (
    "id" TEXT NOT NULL,
    "numeroFacture" SERIAL NOT NULL,
    "dateFacture" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" TEXT NOT NULL DEFAULT 'En attente',
    "magasinId" TEXT NOT NULL,
    "commandeId" TEXT,
    "airtableId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "factures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devis" (
    "id" TEXT NOT NULL,
    "numeroDevis" SERIAL NOT NULL,
    "dateDevis" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" TEXT NOT NULL DEFAULT 'Validé',
    "magasinId" TEXT NOT NULL,
    "commandeId" TEXT,
    "airtableId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cessions_inter_magasin" (
    "id" TEXT NOT NULL,
    "numeroCession" TEXT NOT NULL,
    "dateCession" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateLivraison" TIMESTAMP(3) NOT NULL,
    "creneauLivraison" TEXT,
    "statutCession" TEXT NOT NULL DEFAULT 'En attente',
    "statutLivraison" TEXT NOT NULL DEFAULT 'EN ATTENTE',
    "categorieVehicule" TEXT,
    "optionEquipier" INTEGER NOT NULL DEFAULT 0,
    "tarifHT" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reserveTransport" BOOLEAN NOT NULL DEFAULT false,
    "nombreArticles" INTEGER NOT NULL DEFAULT 0,
    "categoriesArticles" TEXT[],
    "detailsArticles" TEXT,
    "remarques" TEXT,
    "magasinOrigineId" TEXT NOT NULL,
    "magasinDestinationId" TEXT NOT NULL,
    "airtableId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "cessions_inter_magasin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_airtableId_key" ON "users"("airtableId");

-- CreateIndex
CREATE UNIQUE INDEX "magasins_airtableId_key" ON "magasins"("airtableId");

-- CreateIndex
CREATE UNIQUE INDEX "chauffeurs_airtableId_key" ON "chauffeurs"("airtableId");

-- CreateIndex
CREATE UNIQUE INDEX "clients_airtableId_key" ON "clients"("airtableId");

-- CreateIndex
CREATE UNIQUE INDEX "commandes_numeroCommande_key" ON "commandes"("numeroCommande");

-- CreateIndex
CREATE UNIQUE INDEX "commandes_airtableId_key" ON "commandes"("airtableId");

-- CreateIndex
CREATE UNIQUE INDEX "chauffeur_sur_commande_chauffeurId_commandeId_key" ON "chauffeur_sur_commande"("chauffeurId", "commandeId");

-- CreateIndex
CREATE UNIQUE INDEX "factures_numeroFacture_key" ON "factures"("numeroFacture");

-- CreateIndex
CREATE UNIQUE INDEX "factures_airtableId_key" ON "factures"("airtableId");

-- CreateIndex
CREATE UNIQUE INDEX "devis_numeroDevis_key" ON "devis"("numeroDevis");

-- CreateIndex
CREATE UNIQUE INDEX "devis_airtableId_key" ON "devis"("airtableId");

-- CreateIndex
CREATE UNIQUE INDEX "cessions_inter_magasin_numeroCession_key" ON "cessions_inter_magasin"("numeroCession");

-- CreateIndex
CREATE UNIQUE INDEX "cessions_inter_magasin_airtableId_key" ON "cessions_inter_magasin"("airtableId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_magasinId_fkey" FOREIGN KEY ("magasinId") REFERENCES "magasins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_magasinId_fkey" FOREIGN KEY ("magasinId") REFERENCES "magasins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chauffeur_sur_commande" ADD CONSTRAINT "chauffeur_sur_commande_chauffeurId_fkey" FOREIGN KEY ("chauffeurId") REFERENCES "chauffeurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chauffeur_sur_commande" ADD CONSTRAINT "chauffeur_sur_commande_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "commandes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "commandes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "commandes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commentaires" ADD CONSTRAINT "commentaires_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "commandes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapports_enlevement" ADD CONSTRAINT "rapports_enlevement_chauffeurId_fkey" FOREIGN KEY ("chauffeurId") REFERENCES "chauffeurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapports_enlevement" ADD CONSTRAINT "rapports_enlevement_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "commandes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapports_livraison" ADD CONSTRAINT "rapports_livraison_chauffeurId_fkey" FOREIGN KEY ("chauffeurId") REFERENCES "chauffeurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapports_livraison" ADD CONSTRAINT "rapports_livraison_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "commandes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_magasinId_fkey" FOREIGN KEY ("magasinId") REFERENCES "magasins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "commandes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis" ADD CONSTRAINT "devis_magasinId_fkey" FOREIGN KEY ("magasinId") REFERENCES "magasins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis" ADD CONSTRAINT "devis_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "commandes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cessions_inter_magasin" ADD CONSTRAINT "cessions_inter_magasin_magasinOrigineId_fkey" FOREIGN KEY ("magasinOrigineId") REFERENCES "magasins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cessions_inter_magasin" ADD CONSTRAINT "cessions_inter_magasin_magasinDestinationId_fkey" FOREIGN KEY ("magasinDestinationId") REFERENCES "magasins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
