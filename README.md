# Miguel C++ Lab

Un laboratorio para escribir C++ de verdad y que un profesor lo revise. Dos vistas:

- **`/`** — el alumno escribe en un editor con resaltado y autocompletado del lenguaje,
  compila con g++ **real**, ejecuta el programa en una **terminal interactiva** (si el
  programa lee de `std::cin`, se escribe ahí mismo) y entrega.
- **`/profesor`** — el profesor ve la cola de entregas, lee el código con numeración y
  resaltado, deja **notas ancladas a líneas concretas**, ejecuta él mismo el programa,
  marca el estado y publica la revisión.
- **`/api/...`** — lo mismo en JSON, para consultarlo desde herramientas externas.

Sin cursos, sin teoría, sin ejercicios predefinidos, sin pistas y sin IA que complete el
código: el ejercicio lo plantea el profesor fuera de la aplicación, y la consola muestra
exactamente lo que respondió g++, sin interpretarlo.

## Cómo funciona la terminal

El servicio de ejecución (Compiler Explorer) es de un solo disparo: no hay un proceso
vivo esperando al otro lado. Aun así la terminal se comporta como una de verdad, y no
por adivinación:

1. Antes de compilar se antepone al fuente un prólogo que **envuelve el buffer de
   `std::cin`**. Cuando el programa pide un carácter y no queda entrada, el prólogo
   imprime una marca. Esa marca es el instante exacto en el que un programa real se
   quedaría esperando a que teclees.
2. La terminal muestra la salida **hasta** esa marca y se queda esperando. Cuando
   escribes una línea, el programa se vuelve a ejecutar con toda la entrada acumulada y
   sólo se pinta el trozo nuevo. Como la entrada nueva contiene a la anterior, la salida
   sólo puede crecer.
3. `Ctrl+D` cierra la entrada (EOF de verdad: se ve la ejecución completa) y `Ctrl+C`
   corta la sesión.
4. Si un programa no imprime lo mismo dos veces con la misma entrada (`rand`, `time`,
   memoria sin inicializar), la terminal lo dice y repinta la ejecución completa en vez
   de fingir continuidad.

El mismo prólogo pone `std::cout` sin búfer —así un programa que muere por una señal no
pierde lo que había impreso— y sobrevive a `ios::sync_with_stdio(false)`, que reinstala el
buffer de `cin` y dejaría el detector desconectado. La marca lleva un token aleatorio en
cada ejecución, para que el código del alumno no pueda falsificarla.

Dos honestidades más:

- Los programas que leen con `scanf`, `getchar` o `fgets` no pasan por `std::cin`: no hay
  sesión interactiva posible, y la app lo dice y ejecuta en lote, en vez de fingirla.
- Como el prólogo incluye `<iostream>`, un programa al que le falte ese `#include`
  compilaría aquí y no con g++ a secas. Por eso se compila **también** el código tal cual
  lo escribió el alumno, y si ese falla, mandan sus errores. Los números de línea y el
  fragmento con el `^~~~` que imprime g++ se reubican para que citen las líneas del editor.

## Atajos

| Atajo | Acción |
| --- | --- |
| `Ctrl/⌘ + Enter` | Compilar y ejecutar |
| `Ctrl/⌘ + Shift + Enter` | Entregar |
| ``Ctrl + ` `` | Abrir y cerrar el panel inferior |
| `Ctrl/⌘ + F` | Buscar en el código |
| `Ctrl/⌘ + /` | Comentar la línea |
| `Tab` / `Esc` | Indentar / salir del editor |
| `Enter`, `Ctrl+D`, `Ctrl+C` (en la terminal) | Enviar línea, cerrar entrada, cortar |

## Stack

| Pieza | Elección |
| --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript |
| Editor | CodeMirror 6 (`@uiw/react-codemirror`) con `@codemirror/lang-cpp` |
| Base de datos | Supabase PostgreSQL — tablas `cpp_lab_*` |
| Compilador | Compiler Explorer (godbolt.org), GCC 13.2 con `-std=c++17` |
| Hosting | Vercel, rama de producción `main` |

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run build      # build de producción
npm run start      # sirve el build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

En el repositorio no hay ninguna clave. La aplicación necesita dos variables, que en
Vercel se definen en *Project → Settings → Environment Variables* y en local en
`.env.local` (ver `.env.example`):

| Variable | Qué es |
| --- | --- |
| `SUPABASE_URL` | URL del proyecto de Supabase. |
| `SUPABASE_PUBLISHABLE_KEY` | *Publishable key* del proyecto (rol `anon`, permisos acotados). |

Opcionales: `CPP_COMPILER_ID`, `CPP_COMPILER_ARGS`, `CPP_COMPILER_LABEL`.
`GET /api/health` dice si cada variable **existe**, nunca su valor.

## La contraseña del profesor

No hay contraseñas en el código ni en el repositorio, y tampoco hace falta crear
variables de entorno:

1. La primera vez, `/profesor` pide **definir** la contraseña.
2. Se guarda como hash bcrypt en `cpp_lab_secrets`, tabla sin permisos para ningún rol
   de la API.
3. Mínimo 10 caracteres; se guarda con bcrypt (coste 11).
4. El alta sólo funciona mientras haya una **ventana de alta** abierta, para que nadie
   pueda adelantarse. Se abre desde el SQL Editor de Supabase:

   ```sql
   select cpp_lab_open_setup_window(30);  -- 30 minutos
   ```

Para cambiarla más tarde, con la contraseña actual:

```bash
curl -X POST https://miguel-cpp-lab.vercel.app/api/professor/rotate \
  -H "Authorization: Bearer <CONTRASEÑA ACTUAL>" \
  -H "Content-Type: application/json" \
  -d '{"newKey":"<CONTRASEÑA NUEVA>"}'
```

## Seguridad

- Todo el acceso a datos ocurre en el servidor. El navegador nunca ve claves de Supabase.
- El rol anónimo sólo tiene `SELECT` e `INSERT` sobre `cpp_lab_submissions`: **una
  entrega enviada no se puede modificar ni borrar** desde la API pública.
- Una entrega nace siempre `pendiente` y sin notas (lo fuerza la policy de `INSERT`).
- La revisión pasa por `cpp_lab_review_submission(...)`, `SECURITY DEFINER`, que exige la
  contraseña y valida cada nota contra el código real de la entrega.
- El rol anónimo sólo puede rellenar `title`, `code`, `stdin` y `compiler_output`: no
  puede forjar `id`, `created_at` ni el estado de una entrega.
- `cpp_lab_secrets` y `cpp_lab_setup_window` no tienen permisos para `anon` ni
  `authenticated`.
- Hay un límite de peticiones por minuto en `/api/run`, en la creación de entregas y en
  los endpoints de contraseña. Es en memoria del proceso: frena bucles accidentales y
  scripts curiosos, no a un atacante decidido.
- **Las lecturas son públicas a propósito**: `GET /api/submissions` y `/latest` no piden
  clave, que es justo lo que permite a un agente externo consultar la última entrega. El
  código de los ejercicios se considera no confidencial; si algún día deja de serlo, hay
  que poner la clave también en la lectura.

## API

Lectura pública; escritura de revisiones con `Authorization: Bearer <contraseña>`.
Siempre ordenado de la entrega más reciente a la más antigua.

### `GET /api/submissions`

```json
{
  "count": 1,
  "items": [
    {
      "id": "…",
      "title": "Ejercicio 1",
      "code": "#include <iostream>…",
      "stdin": "18",
      "compilerOutput": "$ g++ …\n$ ./main\nSuma = 7\n[El programa terminó correctamente (código 0) · 36 ms]",
      "createdAt": "2026-09-13T00:41:48.615Z",
      "reviewStatus": "pendiente",
      "feedback": "",
      "reviewNotes": [],
      "reviewedAt": null
    }
  ]
}
```

Admite `?limit=` (1–500, por defecto 100).

### `GET /api/submissions/latest`

Devuelve **directamente** el objeto de la última entrega, o `404` si no hay ninguna.
Es el endpoint para cuando el alumno dice «ya lo entregué».

### `GET /api/submissions/:id`

Una entrega concreta.

### `POST /api/submissions`

```json
{ "title": "Ejercicio 1", "code": "…", "stdin": "18", "compilerOutput": "…" }
```

Valida que el código no esté vacío y los tamaños máximos (código 100 000, stdin 20 000,
título 200, salida 100 000 caracteres). Responde `201` con `{ "submission": { … } }`.

### `POST /api/submissions/:id/review`

```bash
curl -X POST https://miguel-cpp-lab.vercel.app/api/submissions/<id>/review \
  -H "Authorization: Bearer <CONTRASEÑA>" \
  -H "Content-Type: application/json" \
  -d '{
        "status": "necesita_correccion",
        "feedback": "Valida la lectura antes de usar el valor.",
        "title": "Condicionales",
        "notes": [
          { "line": 5, "kind": "sugerencia", "body": "Comprueba si cin falló." },
          { "line": 8, "kind": "elogio", "body": "Buen uso de endl." }
        ]
      }'
```

- `status`: `pendiente` | `correcto` | `necesita_correccion` (acepta también
  `"necesita corrección"` y variantes con guion).
- `title` es opcional.
- `feedback` y `title` también son opcionales: si no se mandan, se quedan como estaban;
  mandar `"feedback": ""` sí lo borra.
- `notes` es opcional: si no se manda, las notas quedan como estaban; `[]` las borra.
  Cada nota necesita `line` (entre 1 y el número de líneas del código entregado) y
  `body` (1–2000 caracteres); `kind` es `error` (por defecto), `sugerencia` o `elogio`.

Responde `{ "submission": { … } }` con `reviewedAt` actualizado.

### `POST /api/run`

```json
{ "code": "#include <iostream>…", "stdin": "18", "mode": "interactive" }
```

`mode` `"interactive"` corta la salida donde el programa pide entrada y responde
`waitingForInput: true`; `"batch"` (por defecto) devuelve la ejecución completa.
`interactive: false` y `notice` avisan de que ese programa no puede tener sesión
interactiva (por ejemplo, porque lee con `scanf`).
Devuelve además `status`, `statusLabel`, `commandLine`, `compileOutput`, `diagnostics`
(línea, columna y severidad de cada mensaje de g++), `stdout`, `stdoutFull`, `stderr`,
`exitCode`, `signal`, `timedOut`, `truncated`, `timeMs` y `console` (la transcripción).

### Otros

| Endpoint | Para qué |
| --- | --- |
| `GET /api/health` | Estado de la configuración, sin revelar valores. |
| `GET /api/professor/status` | `{ bound, setupOpen }`: si hay contraseña y si el alta está abierta. |
| `POST /api/professor/setup` | Da de alta la contraseña (sólo con la ventana abierta). |
| `POST /api/professor/session` | Valida la contraseña. |
| `POST /api/professor/rotate` | Cambia la contraseña. |

## Base de datos

`supabase/migrations/` contiene el esquema completo y sus permisos.

```
cpp_lab_submissions
  id              uuid  pk
  title           text
  code            text
  stdin           text
  compiler_output text
  created_at      timestamptz   -- orden: created_at desc
  review_status   text          -- pendiente | correcto | necesita_correccion
  feedback        text
  review_notes    jsonb         -- [{id, line, kind, body, createdAt}]
  reviewed_at     timestamptz

cpp_lab_secrets       -- hash bcrypt de la contraseña del profesor
cpp_lab_setup_window  -- ventana temporal de alta
```

Nada se borra automáticamente.

## Migración desde AppDeploy

La versión anterior vivía en `miguel-c-lab-4sm2k2.v2.appdeploy.ai`. Sus entregas se
exportaron por su propia API y se insertaron aquí conservando `id`, código, stdin, salida
del compilador, estado y fecha original. Había **una** entrega y está migrada. La página
puente que redirigía a AppDeploy ya no existe: producción sirve esta aplicación.

---

Despliegue: cada push a `main` construye producción en Vercel.
