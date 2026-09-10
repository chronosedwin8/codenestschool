#!/bin/sh
# Arranque del contenedor de CodeNest School.
#
# Las migraciones se aplican aqui, antes de levantar el servidor, y con
# `migrate deploy`: nunca `migrate dev` ni `db push`. Los dos ultimos pueden
# reconstruir una tabla, y tres de las tablas de este proyecto estan
# particionadas por rango; recrearlas sin particiones es una perdida de datos
# silenciosa que no se nota hasta que la base va lenta meses despues.
#
# Si la migracion falla, el contenedor NO arranca. Un servidor en pie contra un
# esquema viejo devuelve errores raros en sitios que no tienen nada que ver.
set -e

echo "[arranque] aplicando migraciones..."
node ./node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma

echo "[arranque] listo, levantando el servidor"
exec "$@"
