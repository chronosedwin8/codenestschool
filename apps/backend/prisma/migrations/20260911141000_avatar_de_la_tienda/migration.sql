-- El avatar pasa a guardar CLAVES de la tienda.
--
-- Antes traia {"fuzzColor":"azul"}, que no es ni una clave ni un color: era un
-- nombre que no existia en ningun sitio. Solo cambia el valor por omision; las
-- cuentas ya creadas las lee un lector tolerante en `tienda.service.ts`, asi que
-- no hace falta tocar sus filas.
ALTER TABLE "usuarios" ALTER COLUMN "avatar_config" SET DEFAULT '{"color":null,"sombrero":null,"gafas":null,"disfraz":null,"accesorio":null,"poderes":[],"pocion":null}';
