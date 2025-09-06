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

# Installer @nestjs/cli globalement pour la build
RUN npm install -g @nestjs/cli

# Copier le code source
COPY . .

# Générer Prisma Client après avoir tout le contexte
RUN npx prisma generate

# Debug: vérifier la configuration TypeScript
RUN ls -la tsconfig*.json

# Construire l'application avec verbose output
RUN nest build --verbose

# Vérifier le contenu complet du dossier dist après build
RUN find dist/ -type f | head -20
RUN ls -la dist/src/ || echo "No dist/src directory"

# Nettoyer les dépendances de développement après le build
RUN npm prune --production --legacy-peer-deps

# Exposer le port
EXPOSE $PORT

# Commande de démarrage
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]