# Postor SDK · API de licitaciones en México para JavaScript y TypeScript

Cliente oficial de la **API de membresía de [Postor](https://postor.com.mx)**. Integra búsquedas de licitaciones, documentos, análisis de bases, requisitos y proyectos de contratación pública mexicana en tus aplicaciones y agentes de IA.

[Guía de la API](https://postor.com.mx/api-miembros) · [Crear cuenta](https://app.postor.com.mx/registro) · [Membresías y precios](https://postor.com.mx/precios) · [English](./README.en.md) · [Instrucciones para IA](./AI.md)

## Antes de empezar

1. [Regístrate en Postor](https://app.postor.com.mx/registro).
2. [Elige y contrata una suscripción de pago](https://postor.com.mx/precios): Radar, Análisis, Mesa o Mesa Plus. La membresía debe estar activa para usar la API.
3. En [Configuración → API de membresía](https://app.postor.com.mx/configuracion?section=api-miembros), crea una llave. Empieza con **Consultar** y concede otros permisos sólo si tu integración los necesita.
4. Guarda la llave en el gestor de secretos de tu servidor como `POSTOR_API_KEY`. Sólo se muestra una vez.

**Sólo puedes usar las funciones que desbloquea tu membresía.** La API conserva tu empresa, rol, permisos y cuotas. No añade análisis ni otras funciones a Radar. Panel, MCP y API comparten las cuotas de la membresía. No hay cargos por excedentes: al agotar una cuota, la acción se rechaza. La prueba gratuita no habilita esta API.

| Membresía | Ejemplos de operaciones disponibles |
| --- | --- |
| Radar | Buscar expedientes, consultar documentos y gestionar los Perfiles de IA dentro de sus límites |
| Análisis | Lo anterior, más análisis, requisitos, junta de aclaraciones, Red, proyectos, tareas y carpetas |
| Mesa / Mesa Plus | Lo anterior, más inteligencia de mercado, con las capacidades y cuotas del plan |

El [catálogo de operaciones](./catalog.json) especifica permisos y planes por operación. El SDK publica un conjunto definido de operaciones; no representa todas las pantallas del panel. Las colecciones ComprasMX, estatales, CFE y PEMEX tienen cobertura distinta. Consulta [fuentes y alcance](https://postor.com.mx/cobertura); Postor no es un portal gubernamental.

## Instalación y primera consulta

Requiere Node.js 20.19 o posterior. También usa las APIs web estándar disponibles en Bun y entornos de servidor compatibles. Sin dependencias de ejecución. TypeScript incluye tipos de entrada y sobres de respuesta generados del contrato; el contenido variable del expediente se representa como JSON.

```sh
npm install postor-sdk
```

```js
import { Postor } from 'postor-sdk';

const postor = new Postor({ apiKey: process.env.POSTOR_API_KEY });
const cuenta = await postor.call('get_account_status', {});
console.log(cuenta.membership);

const resultado = await postor.call('search_licitaciones', {
  query: { search: 'material de curación', status: 'vigente', limit: 10 }
});
console.log(resultado.data);
```

No incluyas la llave en el navegador, una aplicación móvil, variables `NEXT_PUBLIC_*`, repositorios ni prompts. En Next.js llama al SDK desde una ruta o acción de servidor con autenticación propia. El SDK rechaza su uso desde el navegador y no sigue redirecciones con tu llave. Una URL de servidor alternativa recibe tu credencial: configúrala sólo si es de confianza.

## Operaciones, respuestas y paginación

`postor.call(nombre, argumentos, { signal })` devuelve el campo `data` del sobre HTTP. Para consultas de expedientes, ese resultado contiene `data`, `truncatedFields` y, cuando corresponde, `notice`, `panelUrl` o `searchContext`. El `data` interior conserva la estructura del recurso, incluidos sus metadatos de paginación. `get_account_status` devuelve directamente la membresía y los permisos concedidos; las descargas añaden sus enlaces temporales.

Consulta el esquema de cada operación en [catalog.json](./catalog.json) y [openapi.json](./openapi.json). Los argumentos se agrupan en `params`, `query` y `body`. No se aceptan campos desconocidos. Usa los IDs devueltos por Postor; no intercambies UUID, ID numérico y número de procedimiento.

Las búsquedas y listas usan la paginación de su esquema (`page`, `limit` u `offset`). Los documentos indican `nextOffset` y `nextExtractedOffset`: continúa hasta que sean `null`. No asumas que la primera página contiene todo. Si `truncatedFields` contiene elementos, acota la consulta o reduce la página; un campo omitido no significa ausencia de datos. Las respuestas minimizan credenciales, identificadores oficiales y metadatos internos, y tienen presupuesto de tamaño. La API no es una descarga masiva íntegra de documentos.

## Escrituras y trabajos de análisis

Concede **Crear y editar** a la llave. Cada acción necesita una `requestKey` de 8–80 caracteres que tú guardas; Postor conserva su resultado durante 24 horas. No generes una nueva clave al reintentar la misma acción.

```js
// Genera y guarda esta clave UNA vez por acción de negocio, antes de enviarla.
const requestKey = crypto.randomUUID();
const proyecto = await postor.call('create_project', {
  body: { name: 'Licitaciones de mantenimiento' },
  requestKey
});
```

Modificar recursos existentes, cancelar trabajos o eliminar carpetas requiere `confirmed: true` cuando el esquema lo indique. Un agente debe obtener autorización del usuario antes de enviarlo. La eliminación y cancelación requiere además el permiso **Eliminar y cancelar**. Reutilizar una `requestKey` con otros argumentos produce `409 IDEMPOTENCY_CONFLICT`.

```js
// Análisis o superior; guarda requestKey antes de la primera solicitud.
await postor.call('start_licitacion_analysis', {
  params: { uuid: uuidObtenidoDePostor }, requestKey: claveGuardada
});
const estado = await postor.call('get_licitacion_analysis', {
  params: { uuid: uuidObtenidoDePostor }
});
```

Un HTTP 200 al iniciar un análisis confirma la respuesta a la solicitud, no un informe terminado. Consulta el estado con pausas; no repitas la operación de inicio. Un timeout, fallo de red o `ACTION_STATE_UNKNOWN` puede ocurrir después de que la acción se haya ejecutado: consulta el recurso antes de decidir un reintento. Después de 24 horas, reutilizar una clave puede ejecutar una acción de nuevo. El SDK **nunca reintenta automáticamente**.

## Errores y límites

```js
import { PostorError } from 'postor-sdk';

try {
  await postor.call('list_projects', {});
} catch (error) {
  if (error instanceof PostorError) {
    console.error(error.code, error.status, error.requestId);
    // error.retryAfter: segundos, cuando el servidor los indica.
    // error.recovery: acción recomendada; no es permiso para repetir escrituras.
  } else throw error;
}
```

| HTTP | Significado |
| --- | --- |
| 400 | Argumentos inválidos, campos desconocidos o datos restringidos |
| 401 | Llave ausente, inválida, vencida o revocada |
| 402 | Membresía inactiva |
| 403 | Función, rol o permiso no autorizado; origen de navegador rechazado |
| 404 | Operación o recurso no disponible para esta empresa |
| 409 | Conflicto, límite de llaves o resultado incierto de una escritura |
| 413 / 415 | Cuerpo mayor a 64 KiB / tipo distinto de JSON |
| 429 | Límite temporal o cuota de membresía agotada |
| 503 | Servicio no disponible |

El límite es **60 solicitudes por minuto por usuario y empresa**, compartido entre llaves y MCP. `RATE_LIMITED` permite esperar y volver a consultar; `LIMIT_REACHED` requiere revisar la cuota y su restablecimiento. Esperar un minuto no repone una cuota mensual. La creación de llaves permite cinco solicitudes por minuto y hasta diez llaves activas por usuario y empresa. Las llaves vencen a los 30 días por defecto y como máximo a los 90; puedes revocarlas en el panel. Cambiar tu contraseña, perder acceso a la empresa o suspender la membresía impide utilizarlas.

El timeout predeterminado es 30 segundos, configurable de 1 a 300000 ms. Puedes pasar `signal` para cancelar. `TIMEOUT`, `ABORTED` y `NETWORK_ERROR` tienen `status: 0`; las escrituras pueden haber llegado al servidor.

## HTTP sin el SDK

```sh
curl 'https://api.postor.com.mx/api/member/v1/operations/get_account_status' \
  -H "Authorization: Bearer $POSTOR_API_KEY" \
  -H 'Content-Type: application/json' \
  --data '{}'
```

Todas las operaciones de v1 usan POST, también las consultas, para mantener filtros y argumentos en JSON. El catálogo es público en `GET /api/member/v1/catalog`; el contrato está en `GET /api/member/v1/openapi.json`. Las respuestas autenticadas llevan `Cache-Control: no-store` y `X-Request-ID`.

## Agentes de IA y contribuciones

Entrega [AI.md](./AI.md), el [catálogo](./catalog.json) y el [OpenAPI](./openapi.json) al agente. Incluyen registro, membresía, manejo de secretos, límites, confirmaciones, paginación y tratamiento de documentos como datos no confiables.

Reporta errores del SDK en [GitHub Issues](https://github.com/Global-Tech-Operations/postor-js/issues), sin llaves ni datos privados. Para asuntos de cuenta, escribe a [hola@postor.com.mx](mailto:hola@postor.com.mx). Ejecuta `npm test` antes de proponer cambios. Los contratos generados se mantienen desde la definición del servidor.

Licencia MIT para el SDK. El acceso y uso del servicio y sus datos se rigen por los [términos de Postor](https://postor.com.mx/terminos). [Postor](https://postor.com.mx) · inteligencia de contratación pública mexicana.
