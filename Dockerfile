# Dockerfile pour My Truck API - Railway Production
FROM node:18-alpine

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./
COPY prisma ./prisma/

# Installer les dépendances
RUN npm ci --only=production

# Générer Prisma Client
RUN npx prisma generate

# Copier le code source
COPY . .

# Construire l'application
RUN npm run build

# Exposer le port
EXPOSE $PORT

# Variables d'environnement par défaut
ENV NODE_ENV=production

# Commande de démarrage
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]