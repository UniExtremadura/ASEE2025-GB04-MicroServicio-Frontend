#!/bin/sh

# Ubicación donde Nginx sirve los archivos
ROOT_DIR=/usr/share/nginx/html

# Generar el archivo env-config.js dinámicamente al arrancar el contenedor
echo "window._env_ = {" > $ROOT_DIR/env-config.js
echo "  USUARIOS_URL: \"$USUARIOS_URL\"," >> $ROOT_DIR/env-config.js
echo "  CONTENIDO_URL: \"$CONTENIDO_URL\"," >> $ROOT_DIR/env-config.js
echo "  ESTADISTICAS_URL: \"$ESTADISTICAS_URL\"" >> $ROOT_DIR/env-config.js
echo "};" >> $ROOT_DIR/env-config.js

# Iniciar Nginx
exec nginx -g "daemon off;"