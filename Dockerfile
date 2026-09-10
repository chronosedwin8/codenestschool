# Imagen de produccion de CodeNest School.
#
# Un solo proceso sirve las tres cosas: el sitio publico en /, el juego en /app y
# la API en /api. No hace falta un servidor web delante para eso.
#
# DOS DECISIONES QUE EXPLICAN LA FORMA DE ESTE ARCHIVO.
#
# 1. El servidor se empaqueta con esbuild en un solo archivo. El monorepo expone
#    `@codenest/shared` como TypeScript en crudo para que Vite, vitest y tsx lo
#    resuelvan sin alias, y eso esta bien en desarrollo pero Node no puede
#    importar un `.ts` en produccion. Empaquetar lo resuelve sin tocar como
#    trabaja nadie en local.
#
# 2. Se construye y se ejecuta sobre la MISMA imagen base. Prisma genera motores
#    compilados para la plataforma concreta y bcrypt es codigo nativo: mezclar
#    Alpine y Debian entre las dos etapas produce un contenedor que arranca y
#    falla en la primera consulta.
#
# El audio pesa unos 110 MB (1.991 locuciones, 12 efectos y 30 pistas de musica)
# y va dentro de la imagen a proposito: es contenido del juego, cambia con el
# codigo y no tener que gestionar un almacen aparte vale mas que esos megas.

# ─────────────────────────────── Construccion ────────────────────────────────
FROM node:24-slim AS build

WORKDIR /repo

# openssl lo necesita Prisma para elegir su motor.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Primero solo los manifiestos: mientras no cambien, la capa de dependencias se
# reaprovecha y una compilacion normal no vuelve a descargar nada.
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
COPY packages/shared/package.json packages/shared/
COPY packages/content/package.json packages/content/
COPY scripts/package.json scripts/

# El `postinstall` del backend llama a `prisma generate`, que necesita el esquema.
COPY apps/backend/prisma apps/backend/prisma

RUN npm ci

COPY . .

# El juego, el paquete compartido y el servidor empaquetado.
RUN npm run build --workspace=@codenest/frontend \
  && npm run build:server --workspace=@codenest/backend

# ─────────────────────────────── Ejecucion ───────────────────────────────────
FROM node:24-slim AS runtime

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl curl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3001 \
    TZ=America/Bogota \
    DIR_APP=/app/publico/app \
    DIR_HOMEPAGE=/app/publico/inicio

# Solo lo que hace falta para ejecutar. El servidor va empaquetado, asi que de
# `node_modules` unicamente sobreviven las dependencias que quedaron fuera del
# paquete por ser nativas, y la linea de ordenes de Prisma para migrar.
COPY --chown=node:node --from=build /repo/apps/backend/build/server.mjs ./server.mjs
COPY --chown=node:node --from=build /repo/apps/backend/prisma ./prisma
COPY --chown=node:node --from=build /repo/apps/frontend/dist ./publico/app
COPY --chown=node:node --from=build /repo/apps/homepage ./publico/inicio
COPY --chown=node:node --from=build /repo/node_modules/@prisma ./node_modules/@prisma
COPY --chown=node:node --from=build /repo/node_modules/.prisma ./node_modules/.prisma
COPY --chown=node:node --from=build /repo/node_modules/prisma ./node_modules/prisma
COPY --chown=node:node --from=build /repo/node_modules/bcrypt ./node_modules/bcrypt
COPY --chown=node:node --from=build /repo/node_modules/node-addon-api ./node_modules/node-addon-api
COPY --chown=node:node --from=build /repo/node_modules/node-gyp-build ./node_modules/node-gyp-build

COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/entrypoint.sh
# No se ejecuta como root: la imagen de Node ya trae el usuario `node`.
USER node

EXPOSE 3001

# Coolify y el proxy necesitan saber si el proceso esta vivo de verdad, no solo
# si el puerto acepta conexiones.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3001/health || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.mjs"]
