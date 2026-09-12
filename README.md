# Miguel C++ Lab

Laboratorio para practicar C++ y revisar entregas. Dos vistas, nada más:

- **`/`** — el alumno escribe C++ en un editor con resaltado, autocompletado del
  lenguaje y de las cabeceras estándar, lo compila y lo ejecuta de verdad, y entrega.
- **`/profesor`** — el profesor entra con su contraseña, ve el código completo, la
  entrada, el resultado real de compilación y ejecución, nombra el ejercicio, marca el
  estado y deja sus notas.
- **`/api/...`** — lo mismo en JSON, para consultarlo desde herramientas externas.

Sin cursos, sin teoría, sin ejercicios predefinidos, sin pistas y sin IA que complete
el código: el ejercicio lo plantea el profesor fuera de la aplicación y la consola
muestra exactamente lo que respondió el compilador, sin interpretarlo.

## Stack

| Pieza         | Elección                                                              |
| ------------- | --------------------------------------------------------------------- |
| Framework     | Next.js 15 (App Router) + TypeScript                                  |
| Editor        | CodeMirror 6 (`@uiw/react-codemirror`) con `@codemirror/lang-cpp`      |
| Base de datos | Supabase PostgreSQL — tablas `cpp_lab_*`                              |
| Compilador    | Compiler Explorer (godbolt.org), GCC 13.2 con `-std=c++17`            |
| Hosting       | Vercel, rama de producción `main`                                     |

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

| Variable                   | Qué es                                                        |
| -------------------------- | ------------------------------------------------------------- |
| `SUPABASE_URL`             | URL del proyecto de Supabase.                                  |
| `SUPABASE_PUBLISHABLE_KEY` | *Publishable key* del proyecto (rol `anon`, permisos acotados). |

`GET /api/health` dice si cada una **existe**, nunca su valor.

## La contraseña del profesor

No hay contraseñas en el código ni en el repositorio, y tampoco hace falta crear
variables de entorno en Vercel:

1. La primera vez, `/profesor` pide **definir** la contraseña.
2. Se guarda como hash bcrypt en `cpp_lab_secrets`, tabla sin permisos para ningún rol
   de la API.
3. El alta sólo funciona mientras haya una **ventana de alta** abierta, para que nadie
   pueda adelantarse. Se abre desde el SQL Editor de Supabase:

   ```sql
   select cpp_lab_open_setup_window(30);  -- 30 minutos
   ```

4. A partir de ahí, `/profesor` pide la contraseña y la guarda sólo en el
   `sessionStorage` de esa pestaña; cada petición la manda como
   `Authorization: Bearer …`.

Para cambiarla más tarde, con la contraseña actual:

```bash
curl -X POST https://miguel-cpp-lab.vercel.app/api/professor/rotate \
  -H "Authorization: Bearer <CONTRASEÑA ACTUAL>" \
  -H "Content-Type: application/json" \
  -d '{"newKey":"<CONTRASEÑA NUEVA>"}'
```

## Seguridad

- Todo el acceso a datos ocurre en el servidor (route handlers). El navegador nunca
  ve claves de Supabase.
- El rol anónimo sólo tiene `SELECT` e `INSERT` sobre `cpp_lab_submissions`: **una
  entrega enviada no se puede modificar ni borrar** desde la API pública, ni siquiera
  por el alumno.
- Una entrega nace siempre como `pendiente` (lo fuerza la policy de `INSERT`).
- La revisión pasa por `cpp_lab_review_submission(...)`, `SECURITY DEFINER`, que exige
  la contraseña del profesor y la verifica contra el hash.
- `cpp_lab_secrets` y `cpp_lab_setup_window` no tienen permisos para `anon` ni
  `authenticated`.

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
      "compilerOutput": "Estado: Ejecución completada (código 0)…",
      "createdAt": "2026-09-12T22:41:48.615Z",
      "reviewStatus": "pendiente",
      "feedback": "",
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
  -d '{"status":"correcto","feedback":"Bien resuelto.","title":"Condicionales"}'
```

`status`: `pendiente` | `correcto` | `necesita_correccion` (acepta también
`"necesita corrección"` y variantes con guion). `title` es opcional. Responde
`{ "submission": { … } }` con `reviewedAt` actualizado.

### `POST /api/run`

```json
{ "code": "#include <iostream>…", "stdin": "18" }
```

Compila y ejecuta de verdad. Devuelve `status`, `statusLabel`, `compileOutput`,
`stdout`, `stderr`, `exitCode`, `timedOut`, `timeMs` y `console` (texto ya formateado).

### Otros

| Endpoint                     | Para qué                                                   |
| ---------------------------- | ---------------------------------------------------------- |
| `GET /api/health`            | Estado de la configuración, sin revelar valores.            |
| `GET /api/professor/status`  | `{ bound, setupOpen }`: si hay contraseña y si el alta está abierta. |
| `POST /api/professor/setup`  | Da de alta la contraseña (sólo con la ventana abierta).     |
| `POST /api/professor/session`| Valida la contraseña.                                       |
| `POST /api/professor/rotate` | Cambia la contraseña.                                       |

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
  reviewed_at     timestamptz

cpp_lab_secrets       -- hash bcrypt de la contraseña del profesor
cpp_lab_setup_window  -- ventana temporal de alta
```

Nada se borra automáticamente.

## Migración desde AppDeploy

La versión anterior vivía en `miguel-c-lab-4sm2k2.v2.appdeploy.ai`. Sus entregas se
exportaron por su propia API (`/api/submissions`) y se insertaron aquí conservando
`id`, código, stdin, salida del compilador, estado y fecha original. Había **una**
entrega y está migrada. La página puente que redirigía a AppDeploy ya no existe:
producción sirve esta aplicación.

## Atajos del editor

| Atajo                 | Acción                        |
| --------------------- | ----------------------------- |
| `Ctrl/⌘ + Enter`      | Compilar y ejecutar           |
| `Ctrl/⌘ + Espacio`    | Sugerencias                   |
| `Tab`                 | Indentar                      |
| `Ctrl/⌘ + F`          | Buscar en el código           |

---

Despliegue: cada push a `main` construye producción en Vercel.
