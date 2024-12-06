# Dockerfile

ARG NODE_VERSION=20.17.0

FROM node:${NODE_VERSION}-alpine

# Use production node environment by default.
ENV NODE_ENV production

# Instalar redis-cli en el contenedor
RUN apk add --no-cache redis

WORKDIR /usr/src/app

# Descargar dependencias
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# Copiar el código fuente desde la subcarpeta src
COPY src/ ./src/

# Asegurarse de que package.json y package-lock.json se copien correctamente
COPY package.json package-lock.json ./

EXPOSE 3000

CMD ["node", "src/index.js"]