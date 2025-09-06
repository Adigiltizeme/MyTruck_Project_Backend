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

# Copier les fichiers de configuration explicitement
COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY nest-cli.json ./

# Copier le code source explicitement
COPY src ./src
COPY scripts ./scripts

# Debug: vérifier la copie
RUN head -5 tsconfig.json
RUN ls -la src/
RUN ls -la src/modules/

# Générer Prisma Client après avoir tout le contexte
RUN npx prisma generate

# Construire l'application
RUN nest build

# Debug: vérifier ce qui a été généré
RUN ls -la dist/
RUN find dist/ -type f -name "*.js" | head -10
RUN ls -la dist/src/ || echo "No dist/src directory"

# Nettoyer les dépendances de développement après le build
RUN npm prune --production --legacy-peer-deps

# Exposer le port
EXPOSE $PORT

# Commande de démarrage
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]