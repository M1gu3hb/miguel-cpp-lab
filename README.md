# Miguel C++ Lab

Laboratorio mínimo para practicar C++ y revisar entregas.

- **`/`** — el alumno escribe C++, lo compila y lo ejecuta de verdad, y entrega.
- **`/profesor`** — el profesor ve cada entrega, la marca y deja feedback.
- **`/api/...`** — la misma información, en JSON, para consultarla desde herramientas externas.

No hay cursos, teoría, pistas, ejercicios predefinidos ni IA que complete código:
el ejercicio lo plantea el profesor fuera de la aplicación.

## Stack

| Pieza          | Elección                                                              |
| -------------- | --------------------------------------------------------------------- |
| Framework      | Next.js 15 (App Router) + TypeScript                                  |
| Editor         | CodeMirror 6 (`@uiw/react-codemirror`) con resaltado de C++           |
| Base de datos  | Supabase PostgreSQL — tablas `cpp_lab_*` del proyecto `Mis proyectos` |
| Compilador     | Compiler Explorer (godbolt.org), GCC 13.2 con `-std=c++17`           |
| Hosting        | Vercel, desplegando desde la rama `main` de este repositorio          |

## Desarrollo

```bash
npm install
cp .env.example .env.local   # y rellena los valores
npm run dev                  # http://localhost:3000
```

Otros comandos:

```bash
npm run build      # build de producción
npm run start      # sirve el build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

## Variables de entorno

Se configuran en Vercel (Project → Settings → Environment Variables) y, en local,
en `.env.local`. Ninguna se escribe en el código ni se sube al repositorio.

| Variable                   | Obligatoria | Para qué sirve                                                          |
| -------------------------- | ----------- | ----------------------------------------------------------------------- |
| `SUPABASE_URL`             | sí          | URL del proyecto Supabase.                                              |
| `SUPABASE_PUBLISHABLE_KEY` | sí          | Clave publishable (pública por diseño; los permisos los da la base).     |
| `PROFESSOR_KEY`            | sí          | Clave de revisión: protege `/profesor` y la API de revisión. Mín. 12 car. |
| `CPP_COMPILER_ID`          | no          | Compilador de Compiler Explorer (por defecto `g132`).                   |
| `CPP_COMPILER_ARGS`        | no          | Flags de compilación (por defecto `-std=c++17 -O1 -Wall`).              |
| `CPP_COMPILER_LABEL`       | no          | Texto que se muestra junto al resultado.                                |

`GET /api/health` dice si cada variable **existe**, nunca su valor.

## Seguridad

- Todo el acceso a datos ocurre en el servidor (route handlers). La clave de Supabase
  no llega al navegador.
- En la base de datos, el rol anónimo sólo tiene `SELECT` e `INSERT` sobre
  `cpp_lab_submissions`: **una entrega enviada no se puede modificar ni borrar**
  desde la API pública.
- La revisión pasa por la función `cpp_lab_review_submission(...)`, `SECURITY DEFINER`,
  que exige la clave del profesor. El hash (bcrypt) vive en `cpp_lab_secrets`, tabla
  sin permisos para ningún rol de la API.
- `/profesor` pide la clave, la guarda sólo en `sessionStorage` de esa pestaña y la
  manda como `Authorization: Bearer` en cada petición.

### Rotar `PROFESSOR_KEY`

La base guarda el hash de la clave con la que se revisó por primera vez. Para cambiarla:

1. Cambia `PROFESSOR_KEY` en Vercel y vuelve a desplegar.
2. Llama una vez, con la clave **anterior**:

   ```bash
   curl -X POST https://miguel-cpp-lab.vercel.app/api/professor/rotate \
     -H "Authorization: Bearer <CLAVE_ANTERIOR>"
   ```

A partir de ahí sólo vale la nueva. (La primera clave que se use queda registrada
automáticamente, así que en una instalación nueva no hay que hacer nada.)

## API

Lectura pública; escritura de revisiones con `Authorization: Bearer <PROFESSOR_KEY>`.
Las entregas van siempre ordenadas de la más reciente a la más antigua.

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

Devuelve **directamente** el objeto de la última entrega (mismo formato que arriba),
o `404` con `{"error": "...", "submission": null}` si todavía no hay ninguna.
Es el endpoint pensado para cuando el alumno dice «ya lo entregué».

### `GET /api/submissions/:id`

Una entrega concreta.

### `POST /api/submissions`

```json
{ "title": "Ejercicio 1", "code": "…", "stdin": "18", "compilerOutput": "…" }
```

Valida que el código no esté vacío y los tamaños máximos (código 100 000, stdin 20 000,
título 200, salida 100 000 caracteres). Responde `201` con `{ "submission": { … } }`.
Una entrega nace siempre como `pendiente`.

### `POST /api/submissions/:id/review`

```bash
curl -X POST https://miguel-cpp-lab.vercel.app/api/submissions/<id>/review \
  -H "Authorization: Bearer $PROFESSOR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status":"correcto","feedback":"Bien resuelto."}'
```

`status`: `pendiente` | `correcto` | `necesita_correccion` (también acepta
`"necesita corrección"` y variantes con guion). Responde `{ "submission": { … } }`
con `reviewedAt` actualizado.

### `POST /api/run`

```json
{ "code": "#include <iostream>…", "stdin": "18" }
```

Compila y ejecuta de verdad; devuelve `status`, `compileOutput`, `stdout`, `stderr`,
`exitCode`, `timedOut`, `timeMs` y `console` (el texto ya formateado). No interpreta
ni explica los errores: muestra lo que respondió g++.

### `GET /api/health`

Estado de la configuración, sin revelar valores.

## Base de datos

`supabase/migrations/20260912_000001_cpp_lab.sql` contiene el esquema completo.

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
```

Nada se borra automáticamente.

## Migración desde AppDeploy

La versión anterior vivía en `miguel-c-lab-4sm2k2.v2.appdeploy.ai`. Sus entregas se
exportaron por su propia API (`/api/submissions`) y se insertaron aquí conservando
`id`, código, stdin, salida del compilador, estado y fecha original. Había **una**
entrega y está migrada. La antigua página puente de Vercel que redirigía a AppDeploy
se eliminó: producción sirve esta aplicación.
