# Pagos, portal del cliente y administración

Estado al empezar (2026-09-18): el código de cobro existía, pero **no se podía
comprar**. Este documento dice qué se encontró, qué se decidió y por qué.

## 1. Lo que se encontró

| # | Hallazgo | Gravedad |
|---|---|---|
| 1 | Las tarjetas de precios enlazan a `/checkout.html`, que **no existe** (404 en producción) | Nadie puede comprar |
| 2 | "Renovar" en el portal solo cambia de pestaña: no hay forma de pagar | Nadie puede renovar |
| 3 | Solo se aceptaba tarjeta tokenizada. **PSE no funcionaba**, y es el medio realista para un colegio de $12.000.000 (Efecty tiene tope de $8.000.000 y muchas tarjetas, cupos menores) | El plan Escuela no se podía pagar |
| 4 | Si un pago PSE fallaba, el correo ya tenía cuenta y volver a comprar daba 409, sin otra salida | Cliente bloqueado |
| 5 | Una renovación aprobada por webhook empezaba hoy, no al acabar la anterior: se perdían los días restantes | Dinero cobrado por días que no se dan |
| 6 | El portal ordenaba por estado y una licencia **pendiente** tapaba a la **activa** | El cliente ve que "no tiene plan" |
| 7 | `GET /api/pagos/licencia/:id` era público, con identificadores secuenciales, y **devolvía el código de acceso** de las licencias activas | Fuga de códigos |
| 8 | El webhook no validaba la firma de Mercado Pago | Defensa en profundidad ausente |
| 9 | Los precios salían de variables de entorno: cambiar una tarjeta exigía redesplegar, y el sembrado completo pisaba cualquier cambio | El administrador no puede cambiarlos |
| 10 | Borrar una licencia borraba en cascada sus pagos | Se pierden registros contables |
| 11 | No existía panel de administración, ni facturas, ni cotizaciones | Pedido explícito |

## 2. La decisión que manda: Checkout Pro

Se cambia de *Checkout API* (formulario propio con la tarjeta tokenizada) a
**Checkout Pro**: el servidor crea una *preferencia* con el precio que él decide
y el comprador paga en la página de Mercado Pago.

- **Tarjetas, PSE y Efecty con una sola integración.** Cada medio en Checkout API
  es un flujo distinto (PSE exige banco, tipo de persona, redirección y regreso).
  Construirlos y mantenerlos a mano es exactamente donde se rompen los pagos.
- **3-D Secure, cuotas y validación de documento** los resuelve Mercado Pago.
- **No toca el CSP.** El formulario incrustado exige abrir `script-src`,
  `frame-src` y `connect-src` a varios dominios de Mercado Pago, y el CSP es la
  fuente de fallos silenciosos que más ha costado en este proyecto.
- **La misma pieza sirve para cobrar una cotización** con un enlace.

El precio sigue siendo del servidor: la preferencia se crea en el backend con el
valor del plan leído de la base.

## 3. Reglas que no se negocian

1. **El monto lo decide el servidor**, leyendo el plan o la cotización de la base.
2. **El estado de un pago nunca se toma del aviso**: el webhook solo trae un
   identificador, y el pago se vuelve a pedir a Mercado Pago con nuestro token.
   Por eso un aviso falsificado no puede activar nada.
3. **Aplicar un pago es idempotente**: el mismo pago aplicado dos veces (webhook,
   regreso del comprador, conciliación manual) no duplica la vigencia.
4. **Los documentos contables no se borran**: una factura se anula con motivo, y
   los pagos sobreviven a la licencia.
5. **La numeración de facturas y cotizaciones no tiene huecos**: el consecutivo se
   toma dentro de la misma transacción que crea el documento.
6. **El documento guarda una foto** del emisor y del cliente: si mañana cambia el
   NIT en el perfil, la factura de ayer no cambia.

## 4. Qué se construye

- **Checkout** (`/checkout.html`): cuenta, datos de facturación, institución
  (plan Escuela) y aceptación de términos → preferencia → Mercado Pago → portal.
- **Webhook** con firma, los tres formatos de aviso, y conciliación por
  `external_reference` para cuando el aviso no llega.
- **Portal del cliente**: licencia vigente bien elegida, renovar o completar un
  pago, historial de pagos de todas sus licencias, facturas, cotizaciones y datos
  de facturación.
- **Panel de administración** (`/app/admin`): precios y tarjetas del home,
  pagos (con conciliación y registro de transferencias), facturas, cotizaciones
  con enlace de pago, activación de licencias y datos de la empresa emisora.
- **Documentos imprimibles** con enlace público no adivinable: una cotización se
  puede mandar a compras del colegio, que no tiene cuenta, y pagarla desde ahí.

## 5. Lo que no se resuelve aquí (y hay que decir)

- **Facturación electrónica DIAN.** CodeNest School es una empresa con sede en
  los Estados Unidos y factura conforme a esa jurisdicción (decisión del
  2026-09-18). Lo que se emite es un comprobante comercial con numeración propia,
  y el portal, el pie de cada factura y el checkout lo dicen con el mismo texto
  (`components/facturacion/aviso.ts`). Si algún día hubiera que expedir factura
  electrónica colombiana, se conecta un proveedor autorizado (Siigo, Alegra…).
- **IVA.** Queda como porcentaje por documento, con 0 % por defecto. Si aplica y
  cuánto lo decide el contador, no el código.
- **Correo.** No hay proveedor de correo: los documentos se ven en el portal y el
  administrador copia el enlace.
- **Las licencias no bloquean el uso.** Hoy nada en la plataforma comprueba una
  licencia; exigirla dejaría fuera al colegio que ya la usa. Es una decisión de
  negocio, no de este cambio.

## 6. Lo que solo se vio probando con la cuenta real

Las pruebas automáticas usan un doble de Mercado Pago. Estas cuatro cosas solo
aparecieron con las credenciales reales y un navegador:

| Hallazgo | Qué se hizo |
|---|---|
| **La cuenta de Mercado Pago es compartida** con otros negocios (Untis, UntiCloud, Veyon Control). El aviso de pagos y la búsqueda ven los pagos de todos | Nuestras referencias llevan prefijo propio (`cns-lic-12`, `cns-cot-3`) y **no** se aceptan números sueltos: un pago de otro negocio con referencia "12345" podría haber activado la licencia 12345. Hay prueba que lo exige |
| En la página de pago, el vendedor aparece como **"UntiCloud"** (el nombre de negocio de la cuenta) | No se arregla en código. En el extracto de la tarjeta sale `CODENEST` (`statement_descriptor`). Ver sección 7 |
| Mercado Pago muestra "Hubo un error accediendo a esta página" a un Chrome **headless** | Es su detección de robots, no un fallo nuestro: la misma URL con un navegador normal muestra el pago con tarjeta, PSE, Transferencia Bancolombia y Efecty. Para verificar hay que simular un navegador normal |
| Mercado Pago **descarta** las URL de regreso que no son públicas (`http://127.0.0.1`) | En local la preferencia se crea sin regreso automático; en producción van con `https://codenestschool.com` |

## 7. El webhook en una cuenta compartida

La URL del aviso es `https://codenestschool.com/api/pagos/webhook`, y **ya va
dentro de cada preferencia** (`notification_url`). No hace falta registrarla en
el panel de Mercado Pago para que funcione.

**No reemplazar la URL de webhook del panel de Mercado Pago** si Untis, UntiCloud
o Veyon la usan: la aplicación tiene una sola, y cambiarla les cortaría sus
avisos de pago. Si el panel ya tiene un webhook configurado, basta con copiar su
**clave secreta** a `MP_WEBHOOK_SECRET` para que los avisos se validen con firma.
Sin la clave, los avisos se procesan igual (el estado se pide siempre a Mercado
Pago), pero sin esa capa extra.

Lo limpio a medio plazo es una **cuenta de Mercado Pago propia para CodeNest**:
el nombre correcto en la página de pago, su propio webhook, y la contabilidad
separada de los otros negocios.
