-- El requisito de la tienda pasa de "ese mundo" a "cuantos mundos".
--
-- Atado a un mundo concreto, el sombrero pirata (mundo 7) era inalcanzable para
-- un nino de diez anos, que empieza en el mundo 21 y nunca va a jugar los mundos
-- de los pequenos. Contando mundos terminados, el mismo requisito significa lo
-- mismo para los tres grupos de edad. Los valores los vuelve a poner el seed.
ALTER TABLE "items_tienda" RENAME COLUMN "requiere_mundo" TO "mundos_necesarios";
