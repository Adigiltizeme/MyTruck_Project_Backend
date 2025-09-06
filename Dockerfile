# Dockerfile pour My Truck API - Railway Production
FROM node:18-alpine

# Installer des dépendances système
RUN apk add --no-cache openssl libc6-compat

# Définir le répertoire de travail
WORKDIR /app

# Variables d'environnement
ENV NODE_ENV=production

# Créer fichier .npmrc pour forcer legacy-peer-deps
RUN echo "legacy-peer-deps=true" > .npmrc

# Copier les fichiers de dépendances
COPY package*.json ./
COPY prisma ./prisma/

# Installer TOUTES les dépendances avec npm install (plus flexible que npm ci)
RUN npm install --legacy-peer-deps

# Copier le code source
COPY . .

# Générer Prisma Client après avoir tout le contexte
RUN npx prisma generate

# Construire l'application
RUN npm run build

# Nettoyer les dépendances de développement
RUN npm prune --production --force

# Exposer le port
EXPOSE $PORT

# Vérifier que le build existe
RUN ls -la dist/

# Commande de démarrage
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]