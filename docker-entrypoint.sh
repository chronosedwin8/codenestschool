#!/bin/sh
# Arranque del contenedor de CodeNest School.
#
# Dos cosas antes de levantar el servidor: migrar y, si la base esta vacia,
# sembrar el curriculo.
#
# Las migraciones se aplican con `migrate deploy`, nunca `migrate dev` ni
# `db push`. Los dos ultimos pueden reconstruir una tabla, y tres de las tablas
# de este proyecto estan particionadas por rango; recrearlas sin particiones es
# una perdida de datos silenciosa que no se nota hasta meses despues.
#
# Si algo de esto falla, el contenedor NO arranca. Un servidor en pie contra un
# esquema viejo, o sin curriculo, devuelve errores raros en sitios que no tienen
# nada que ver con la causa.
set -e

echo "[arranque] aplicando migraciones..."
node ./node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma

# El sembrado solo corre si no hay mundos. Es idempotente (todo son upserts),
# pero recorrer seiscientas actividades en cada reinicio son casi dos minutos de
# arranque que no hacen falta.
echo "[arranque] comprobando el curriculo..."
if node ./seed.mjs --solo-si-vacio; then
  echo "[arranque] curriculo listo"
else
  echo "[arranque] el sembrado fallo" >&2
  exit 1
fi

# La cuenta de administrador, si el entorno la pide. Nunca sobrescribe una que
# ya exista, asi que estas variables se pueden borrar una vez creada.
if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  echo "[arranque] comprobando la cuenta de administrador..."
  node ./seed.mjs --asegurar-admin
fi

echo "[arranque] levantando el servidor"
exec "$@"
