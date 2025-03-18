# Usar una imagen base de Node.js
FROM node:alpine

# Establecer el directorio de trabajo en el contenedor
WORKDIR /usr/src/MeteoWeb

# Instalar FFmpeg para fluent-ffmpeg
RUN apk add --no-cache ffmpeg

# Copiar los archivos package.json y package-lock.json
COPY package*.json ./

# Instalar las dependencias de Node
RUN npm install

# Copiar el código fuente al contenedor
COPY . .

# Exponer el puerto en el que corre la aplicación
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["node", "src/server.js"]
