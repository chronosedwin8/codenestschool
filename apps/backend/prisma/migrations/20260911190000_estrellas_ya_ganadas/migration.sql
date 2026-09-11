-- Quien ya habia jugado antes de que existiera la tienda se quedo con cero
-- estrellas para gastar.
--
-- `estrellas_disponibles` nacio con valor por omision 0, asi que un nino con
-- treinta estrellas ganadas entraba a la tienda sin poder comprar nada y sin
-- entender por que: las estrellas son suyas y las gano jugando. Se le entrega su
-- saldo una sola vez, igualandolo a lo que lleva ganado.
--
-- Solo toca a quien no ha gastado todavia (disponibles = 0), asi que no puede
-- devolver estrellas ya gastadas.
UPDATE "usuarios"
SET "estrellas_disponibles" = "estrellas_totales"
WHERE "estrellas_disponibles" = 0
  AND "estrellas_totales" > 0;
