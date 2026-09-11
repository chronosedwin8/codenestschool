-- Mundos abiertos con un Pase del Nido.
--
-- Lista y no un tope: un pase abre un mundo concreto y el desbloqueo por avance
-- sigue su curso aparte. Sin columna, el pase de la tienda no tendria donde
-- guardarse y seria un articulo que no hace nada.
ALTER TABLE "usuarios" ADD COLUMN "mundos_extra" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
