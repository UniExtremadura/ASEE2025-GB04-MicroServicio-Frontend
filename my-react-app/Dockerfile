# ETAPA 1: Construcción con Node.js
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ETAPA 2: Servidor de producción con Nginx
FROM nginx:stable-alpine
WORKDIR /usr/share/nginx/html

# Copiamos el contenido de la carpeta 'dist' generada por Vite
COPY --from=build /app/dist .

# Copiamos el script de entrada y damos permisos
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

# Al arrancar, ejecutamos el inyector de variables y Nginx
ENTRYPOINT ["/entrypoint.sh"]