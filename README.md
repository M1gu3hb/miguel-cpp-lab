# Miguel C++ Lab — Manual completo

**Qué es esto:** una página web donde un alumno escribe programas en C++, los ejecuta de
verdad y los entrega; y donde el profesor los lee, los prueba él mismo y devuelve
correcciones. Nada más. No hay cursos, ni teoría, ni ejercicios automáticos, ni nadie que
le resuelva el ejercicio al alumno.

**Las dos direcciones que hay que recordar:**

| Quién | Dirección | Para qué |
| --- | --- | --- |
| El alumno | **https://miguel-cpp-lab.vercel.app** | Escribir, probar y entregar |
| El profesor | **https://miguel-cpp-lab.vercel.app/profesor** | Revisar y corregir |

No hace falta instalar nada. Se abre en el navegador (Chrome, Edge, Safari, Firefox), en
computadora, tablet o teléfono. No hay que crear cuentas ni registrarse: el alumno entra
directo, y el profesor sólo escribe una contraseña.

---

## Índice

1. [Diccionario mínimo (lea esto primero)](#1-diccionario-mínimo-lea-esto-primero)
2. [Cómo funciona todo, en cinco pasos](#2-cómo-funciona-todo-en-cinco-pasos)
3. [Primer día: el profesor pone su contraseña](#3-primer-día-el-profesor-pone-su-contraseña)
4. [Guía para el alumno, paso a paso](#4-guía-para-el-alumno-paso-a-paso)
5. [Guía para el profesor: revisar una entrega](#5-guía-para-el-profesor-revisar-una-entrega)
6. [Qué es cada cosa de la pantalla](#6-qué-es-cada-cosa-de-la-pantalla)
7. [Cómo leer un error del compilador](#7-cómo-leer-un-error-del-compilador)
8. [Preguntas frecuentes y problemas](#8-preguntas-frecuentes-y-problemas)
9. [Lo que la página no hace (a propósito)](#9-lo-que-la-página-no-hace-a-propósito)
10. [Consultar las entregas desde ChatGPT u otro programa](#10-consultar-las-entregas-desde-chatgpt-u-otro-programa)
11. [Parte técnica (para quien mantenga la página)](#11-parte-técnica-para-quien-mantenga-la-página)

---

## 1. Diccionario mínimo (lea esto primero)

Si estas ocho palabras quedan claras, todo lo demás se entiende solo.

| Palabra | Qué significa aquí |
| --- | --- |
| **Código fuente** | El texto del programa, escrito por el alumno. En esta página se llama `main.cpp`, que es el nombre habitual del archivo principal de un programa en C++. |
| **Editor** | La zona grande donde se escribe el código. Pinta las palabras de colores y numera las líneas, igual que los programas que usan los programadores de verdad. |
| **Compilar** | Traducir el código a algo que la computadora pueda ejecutar. Lo hace un programa llamado **g++**, el compilador de C++ más usado del mundo. Si el código tiene fallos de escritura, la compilación **falla** y no se ejecuta nada. |
| **Ejecutar** | Poner el programa a funcionar y ver qué imprime. |
| **Terminal** (o consola) | La ventana negra de abajo donde aparece lo que el programa escribe y donde el alumno teclea lo que el programa le pide. |
| **Entrada** (`std::cin`, *stdin*) | Los datos que el programa le pide al usuario: una edad, un nombre, dos números. |
| **Salida** (`std::cout`) | Lo que el programa escribe en pantalla. |
| **Entrega** | Una foto fija del ejercicio: el código, la entrada usada, el resultado y la fecha. Una vez enviada **ya no se puede modificar**, ni por el alumno ni por nadie. Si hay que cambiar algo, se entrega otra vez. |

Dos más, para entender los errores:

- **Error de compilación**: el programa está mal escrito y ni siquiera llega a ejecutarse.
  Ejemplo: falta un punto y coma. La página muestra el mensaje exacto de g++.
- **Error de ejecución**: el programa compiló bien, arrancó, y algo salió mal mientras
  corría (por ejemplo, dividir entre cero). También se muestra tal cual.

---

## 2. Cómo funciona todo, en cinco pasos

```
1. El profesor le dice al alumno qué ejercicio hacer
   (por WhatsApp, en clase, en una hoja: donde sea, fuera de esta página)
                     |
                     v
2. El alumno abre  https://miguel-cpp-lab.vercel.app
   escribe su programa, lo compila y lo prueba las veces que quiera
                     |
                     v
3. Cuando está conforme, pulsa  [ Entregar ]
                     |
                     v
4. El profesor abre  https://miguel-cpp-lab.vercel.app/profesor
   lee el código, lo ejecuta él mismo, deja notas y publica la revisión
                     |
                     v
5. El alumno vuelve a la página y ve la corrección
   (con las notas pegadas a las líneas exactas del código)
```

El ejercicio lo pone el profesor **fuera** de la página. La página no inventa ejercicios.

---

## 3. Primer día: el profesor pone su contraseña

Esto se hace **una sola vez**, y conviene hacerlo antes de darle la dirección al alumno.

1. Abra **https://miguel-cpp-lab.vercel.app/profesor**
2. Verá un recuadro que dice **«Define tu contraseña»**.
3. Escriba la contraseña que quiera usar (**mínimo 10 caracteres**) y repítala abajo.
4. Pulse **«Guardar contraseña»**. Listo: ya está dentro.

Esa contraseña es la única llave de la parte del profesor. Apúntela donde guarde sus
contraseñas. En la página queda guardada **cifrada** (no se puede leer, ni siquiera desde
la base de datos), así que **no hay forma de recuperarla**: si se pierde, hay que
reiniciarla (ver abajo).

**Consejo:** que no sea una palabra suelta. Algo como `laboratorio-cpp-2026` sirve
perfectamente y es fácil de recordar.

### Si en vez de eso dice «el alta está cerrada»

Significa que pasó demasiado tiempo desde que se preparó la página. Hay que volver a
abrir la ventana de alta desde el panel de la base de datos:

1. Entre a **https://supabase.com** con la cuenta del proyecto.
2. Elija el proyecto **«Mis proyectos»**.
3. En el menú de la izquierda, pulse **SQL Editor** y luego **New query**.
4. Pegue exactamente esto y pulse **Run**:

   ```sql
   select cpp_lab_open_setup_window(30);
   ```

5. Vuelva a `/profesor`, recargue la página y ya podrá definir la contraseña.
   (Ese `30` son los minutos que la ventana queda abierta.)

Ese paso existe por seguridad: sin él, cualquiera que entrara antes que usted podría
haberse quedado con la contraseña del profesor.

### Cambiar la contraseña más adelante

Se hace con una orden desde la terminal de la computadora (o pidiéndoselo a quien
mantenga la página). Hay que saber la contraseña actual:

```bash
curl -X POST https://miguel-cpp-lab.vercel.app/api/professor/rotate \
  -H "Authorization: Bearer LA-CONTRASEÑA-ACTUAL" \
  -H "Content-Type: application/json" \
  -d '{"newKey":"LA-CONTRASEÑA-NUEVA"}'
```

### Si olvidó la contraseña

Se borra la que hay y se vuelve a empezar. En Supabase → **SQL Editor** → **New query**:

```sql
delete from cpp_lab_secrets where name = 'professor_key';
select cpp_lab_open_setup_window(30);
```

Después entre a `/profesor` y defina una nueva. **Las entregas no se tocan**: siguen
todas ahí.

---

## 4. Guía para el alumno, paso a paso

> Esta sección está escrita para el alumno. El profesor puede copiarla tal cual y
> mandársela.

### Paso 1 — Abrir la página

Entra a **https://miguel-cpp-lab.vercel.app**. No hay que registrarse ni instalar nada.

Verás tres zonas:

- **Arriba**: el nombre del ejercicio y los botones **Compilar y ejecutar** y **Entregar**.
- **En medio**: el editor, donde escribes el programa (`main.cpp`).
- **Abajo**: la terminal, donde el programa cobra vida.

### Paso 2 — Ponerle nombre al ejercicio

Arriba, junto a la palabra **EJERCICIO**, hay una casilla que dice «Sin nombre». Escribe
ahí el nombre que te dio el profesor: `Ejercicio 1`, `Condicionales`, `Suma de dos
números`… Sirve para que el profesor sepa qué está corrigiendo.

### Paso 3 — Escribir el programa

Haz clic en el editor y escribe. Mientras escribes:

- Las palabras de C++ se pintan de colores solas.
- Al escribir aparece una lista de sugerencias con palabras del lenguaje (`for`, `while`,
  `std::cout`…) y con las librerías (`iostream`, `string`, `vector`…). **Eso es todo lo
  que sugiere: palabras.** No te va a escribir el ejercicio.
  Para aceptar una sugerencia, `Enter`. Para ignorarla, sigue escribiendo o pulsa `Esc`.
- Se cierran solas las llaves y los paréntesis, y la indentación se respeta.

Si quieres probar que todo funciona, copia este programa:

```cpp
#include <iostream>

int main() {
    std::cout << "Hola";
    return 0;
}
```

### Paso 4 — Compilar y ejecutar

Pulsa el botón azul **Compilar y ejecutar** (o `Ctrl` + `Enter`; en Mac, `⌘` + `Enter`).

Abajo, en la pestaña **TERMINAL**, verás algo así:

```
$ g++ -std=c++17 -O1 -Wall main.cpp -o main
$ ./main
Hola
[El programa terminó correctamente (código 0) · 36 ms]
```

Las dos primeras líneas son las órdenes reales que se ejecutaron: primero se compila,
después se corre el programa. La última línea entre corchetes te dice cómo terminó.

### Paso 5 — Si tu programa pide datos, escríbelos en la terminal

Prueba este otro programa:

```cpp
#include <iostream>

int main() {
    int edad;
    std::cout << "Escribe tu edad: ";
    std::cin >> edad;

    if (edad >= 18) {
        std::cout << "Mayor de edad";
    } else {
        std::cout << "Menor de edad";
    }
    return 0;
}
```

Al pulsar **Compilar y ejecutar**, la terminal se detiene exactamente aquí:

```
$ ./main
Escribe tu edad: ▮
```

Ese cuadrito parpadeante significa: **el programa te está esperando a ti**. Escribe `18`,
pulsa `Enter`, y el programa sigue:

```
Escribe tu edad: 18
Mayor de edad
[El programa terminó correctamente (código 0) · 34 ms]
```

Funciona igual con `std::getline`, con varios datos seguidos y con bucles del tipo
`while (std::cin >> x)`.

Teclas de la terminal:

| Tecla | Qué hace |
| --- | --- |
| `Enter` | Envía la línea que escribiste al programa |
| `Ctrl` + `D` | Le dice al programa «ya no hay más datos» (lo que en una terminal de verdad se llama *fin de entrada*) |
| `Ctrl` + `C` | Corta la ejecución |

**Otra forma de dar los datos:** si prefieres dejarlos preparados antes de ejecutar, usa
la pestaña **ENTRADA** (al lado de TERMINAL), escribe ahí los datos —uno por línea— y
pulsa **Ejecutar con esta entrada**.

### Paso 6 — Cuando algo está mal

Si el programa está mal escrito verás:

- El error subrayado en rojo **en la línea exacta** del editor, con un punto rojo en el
  margen izquierdo.
- La pestaña **PROBLEMAS** se abre sola con la lista de fallos. Si pulsas uno, el cursor
  salta a esa línea.
- En la TERMINAL, el mensaje **completo** del compilador, igual que lo daría g++.

La página **no te dice cómo arreglarlo**. Te enseña exactamente lo que dijo el
compilador, que es lo que tienes que aprender a leer (la sección 7 explica cómo).

### Paso 7 — Entregar

Cuando tu programa hace lo que pedía el ejercicio, pulsa el botón verde **Entregar**
(o `Ctrl` + `Shift` + `Enter`). Abajo aparecerá **«Entrega enviada.»**.

Se guardan: el nombre del ejercicio, el código, la entrada que usaste, lo que salió en la
terminal y la fecha.

Tres cosas importantes:

1. **Una entrega no se puede modificar ni borrar.** Si te equivocaste, corrige y entrega
   otra vez: el profesor verá las dos y sabrá cuál es la última.
2. Puedes entregar las veces que haga falta.
3. Lo que escribas en el editor **no se pierde** si cierras la pestaña: vuelve a aparecer
   al entrar de nuevo en el mismo navegador. Pero eso es sólo un borrador tuyo: hasta que
   no pulses **Entregar**, el profesor no ve nada.

### Paso 8 — Ver la corrección del profesor

En la barra de iconos de la izquierda, el tercer icono (una hoja con un ✓) es
**Revisiones**. Ahí aparece, por cada entrega corregida:

- El estado: **Correcto**, **Necesita corrección** o **Pendiente de revisión**.
- Las **notas generales** del profesor.
- Las **notas por línea**: cada una dice a qué línea se refiere, muestra esa línea de tu
  código y explica qué pasa con ella. Pueden ser de tres tipos: **Corrige esto**,
  **Se puede mejorar** o **Bien hecho**.

Con el botón **«Abrir en el editor»** recuperas ese código en el editor para arreglarlo y
volver a entregar.

### Atajos de teclado (opcional)

| Atajo | Qué hace |
| --- | --- |
| `Ctrl`/`⌘` + `Enter` | Compilar y ejecutar |
| `Ctrl`/`⌘` + `Shift` + `Enter` | Entregar |
| `Ctrl` + `` ` `` | Esconder o mostrar el panel de abajo |
| `Ctrl`/`⌘` + `F` | Buscar dentro del código |
| `Ctrl`/`⌘` + `/` | Comentar o descomentar la línea |
| `Tab` | Indentar |
| `Esc` | Salir del editor (para seguir con `Tab` al resto de la página) |

---

## 5. Guía para el profesor: revisar una entrega

### Paso 1 — Entrar

Abra **https://miguel-cpp-lab.vercel.app/profesor**, escriba su contraseña y pulse
**Entrar**. La contraseña se queda guardada sólo en esa pestaña del navegador: si la
cierra, se la volverá a pedir. Con el botón **Salir** (arriba a la derecha) la olvida
inmediatamente, útil si usa una computadora compartida.

### Paso 2 — Elegir qué corregir

A la izquierda está la lista de entregas. Arriba hay tres botones:

- **Sin revisar (N)** — las que faltan por corregir. Es la vista por defecto.
- **Todas**
- **Revisadas**

Y una casilla para **buscar por nombre o por contenido del código**.

Cada entrega de la lista muestra su nombre, la fecha y una etiqueta de color con su
estado. Pulse una y aparecerá a la derecha.

### Paso 3 — Leer el código

En el centro verá el archivo **main.cpp** del alumno, con números de línea y colores.
Arriba a la derecha de esa tarjeta se indica el total de líneas y de notas.

Debajo hay dos tarjetas más:

- **«Compilación y ejecución guardadas por el alumno»**: lo que salió en su terminal
  cuando entregó. Sirve para ver si lo probó y con qué datos.
- **«Ejecutar este código ahora»**: aquí puede probarlo usted mismo.

### Paso 4 — Ejecutar el programa usted mismo

En la tarjeta **«Ejecutar este código ahora»**:

1. En **Entrada (stdin)** aparece ya la entrada que usó el alumno. Puede cambiarla por la
   que quiera: es la forma de comprobar si el programa aguanta otros casos (un número
   negativo, un cero, un texto donde esperaba un número…).
2. Pulse **Compilar y ejecutar**.
3. Abajo aparece el resultado real.
4. El botón **«Usar la entrada del alumno»** devuelve la entrada original.

El código del alumno **no se modifica** por ejecutarlo: sólo se corre.

### Paso 5 — Dejar notas pegadas a una línea

Es la parte más útil para el alumno. Sobre el código, **haga clic en cualquier línea**
(también funciona con el teclado: `Tab` hasta la línea y `Enter`).

Se abre un recuadro justo debajo de esa línea:

1. Elija el tipo de nota:
   - **Corrige esto** (rojo) — está mal y hay que cambiarlo.
   - **Se puede mejorar** (amarillo) — funciona, pero hay una forma mejor.
   - **Bien hecho** (verde) — para reconocer lo que está bien. Úselo: un principiante
     necesita saber qué sí hizo bien.
2. Escriba el comentario.
3. Pulse **Añadir nota** (o `Ctrl` + `Enter`).

Puede poner varias notas en la misma línea y en líneas distintas. Si se arrepiente, cada
nota tiene **Borrar nota**. Si empieza a escribir una nota y hace clic en otra línea, lo
escrito **no se pierde**: cada línea guarda su propio borrador.

### Paso 6 — Poner el estado y las notas generales

A la derecha, en la tarjeta **Revisión**:

- **Nombre del ejercicio** — puede corregirlo si el alumno lo dejó vacío o mal escrito.
- **Estado** — elija uno:

  | Estado | Cuándo usarlo |
  | --- | --- |
  | **Pendiente de revisión** | Todavía no lo ha mirado (es el estado con el que llega) |
  | **Correcto** | Hace lo que pedía el ejercicio |
  | **Necesita corrección** | Hay que arreglar algo y volver a entregar |

- **Notas generales** — el comentario global: qué tal en conjunto, qué repasar, qué
  esperar de la próxima entrega.

### Paso 7 — Publicar

Pulse **Publicar revisión**. Hasta ese momento el alumno **no ve nada**: mientras escribe,
arriba aparece la etiqueta **«sin publicar»** y todo queda guardado sólo en su navegador
(puede cerrar la pestaña y seguir después).

Si va a corregir varias seguidas, use **Publicar y siguiente**: publica y salta a la
siguiente entrega de la lista.

### Qué revisar (una lista corta)

Sugerencia práctica, no una regla de la página:

1. **¿Compila?** Si no, el error del compilador ya dice dónde: una nota en esa línea.
2. **¿Hace lo que pedía el ejercicio?** Ejecútelo con la entrada del alumno y con otra
   distinta.
3. **¿Aguanta datos raros?** Un `0`, un negativo, una letra donde esperaba un número.
4. **¿Se entiende?** Nombres de variables, indentación, si el código dice lo que hace.
5. **¿Hay algo que destacar?** Una nota verde vale tanto como una roja.

---

## 6. Qué es cada cosa de la pantalla

### La pantalla del alumno

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ MIGUEL C++ LAB   EJERCICIO [ Condicionales    ]  [Compilar y ejecutar][Entregar]│  ← barra de arriba
├───┬──────────────┬───────────────────────────────────────────────────────────┤
│ ▣ │ EXPLORADOR   │  C++ main.cpp                              ☐ Ajuste de línea│  ← pestaña del archivo
│ ⌕ │  main.cpp    │  1  #include <iostream>                                    │
│ ✓ │              │  2                                                          │
│   │ MIS ENTREGAS │  3  int main() {                                            │  ← EDITOR
│   │  Ejercicio 1 │  4      std::cout << "Hola";                                │
│   │  Ejercicio 2 │  5      return 0;                                           │
│   │              │  6  }                                                       │
│   │              ├───────────────────────────────────────────────────────────┤
│   │              │ TERMINAL │ PROBLEMAS │ ENTRADA              g++ 13.2  Limpiar│  ← panel de abajo
│   │              │ $ g++ -std=c++17 -O1 -Wall main.cpp -o main                 │
│   │              │ $ ./main                                                    │
│   │              │ Hola                                                        │
│   │              │ [El programa terminó correctamente (código 0) · 36 ms]      │
├───┴──────────────┴───────────────────────────────────────────────────────────┤
│ ● Listo   ⊗ 0 ⚠ 0            Ln 5, Col 14  Espacios: 4  UTF-8  C++17  g++ 13.2│  ← barra de estado
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Barra de iconos (izquierda)** — tres botones:
  - **Explorador**: el archivo `main.cpp` y la lista **MIS ENTREGAS**.
  - **Buscar**: buscar texto dentro del código.
  - **Revisiones**: las correcciones del profesor. Si tiene un número, es cuántas hay.
- **Editor** — donde se escribe. El número de la izquierda es el número de línea.
- **Panel de abajo** — tres pestañas:
  - **TERMINAL**: la ejecución del programa.
  - **PROBLEMAS**: la lista de errores y avisos del compilador. El número rojo son
    errores (impiden ejecutar); el amarillo, avisos (no impiden nada).
  - **ENTRADA**: para dejar los datos preparados antes de ejecutar.
  Se puede agrandar arrastrando la línea que lo separa del editor, o esconder con
  `Ctrl` + `` ` ``.
- **Barra de estado (abajo)** — cómo terminó la última ejecución, cuántos errores y
  avisos hay, en qué línea y columna está el cursor, y qué compilador se está usando.

### La pantalla del profesor

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ MIGUEL C++ LAB  profesor        3 entregas · 1 sin revisar  [Actualizar] Salir│
├─────────────────────┬────────────────────────────────────────────────────────┤
│ [Sin revisar (1)]   │  Condicionales   [Necesita corrección]  13 líneas 2 notas│
│ [Todas][Revisadas]  │ ┌─────────────────────────────┐ ┌────────────────────┐ │
│ [buscar…          ] │ │ main.cpp                    │ │ REVISIÓN           │ │
│                     │ │  1  #include <iostream>     │ │ Nombre: [        ] │ │
│ ▸ Condicionales     │ │  5  std::cin >> edad;       │ │ Estado:  [▼]       │ │
│   13 sep, 00:26     │ │    └ nota del profesor      │ │ Notas generales    │ │
│ ▸ Ejercicio 1       │ │  ...                        │ │ [              ]   │ │
│   12 sep, 22:08     │ └─────────────────────────────┘ │ [Publicar revisión]│ │
│                     │ ┌─────────────────────────────┐ └────────────────────┘ │
│                     │ │ Ejecutar este código ahora  │                        │
│                     │ └─────────────────────────────┘                        │
└─────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 7. Cómo leer un error del compilador

Los mensajes de g++ siempre tienen la misma forma. Ejemplo real:

```
main.cpp: In function 'int main()':
main.cpp:4:5: error: 'cout' was not declared in this scope; did you mean 'std::cout'?
   4 |     cout << "hola";
     |     ^~~~
main.cpp:3:9: warning: unused variable 'x' [-Wunused-variable]
   3 |     int x;
     |         ^
```

Se lee así:

| Parte | Qué significa |
| --- | --- |
| `main.cpp:4:5` | Archivo, **línea 4**, **columna 5**. Ahí está el problema. |
| `error:` | Es un error: el programa **no se ejecuta** hasta arreglarlo. |
| `warning:` | Es un aviso: el programa sí se ejecuta, pero hay algo mejorable. |
| `'cout' was not declared…` | El mensaje literal del compilador, en inglés. |
| `4 |     cout << "hola";` | La línea de código tal cual. |
| `^~~~` | Señala **exactamente** la parte de la línea que falla. |

Consejo: **arregle siempre el primer error de la lista y vuelva a compilar.** Un solo
fallo (un punto y coma, una llave) suele arrastrar diez errores detrás, y al corregirlo
desaparecen todos.

En esta página esos mismos errores aparecen además subrayados en el editor y listados en
la pestaña **PROBLEMAS**, donde al pulsarlos el cursor salta a la línea.

---

## 8. Preguntas frecuentes y problemas

**No sale nada en la terminal.**
Pulse **Compilar y ejecutar**. Si el programa no imprime nada, la terminal dirá que
terminó sin escribir nada, lo cual también es información: quizá falta un `std::cout`.

**La terminal se quedó parada con un cuadrito parpadeando.**
No está colgada: el programa está **esperando que escriba algo**. Escriba el dato y pulse
`Enter`.

**Puse los datos pero el programa no los usa.**
Compruebe que el programa los lee con `std::cin`. Si los lee con `scanf` (estilo C), la
página lo avisa: en ese caso hay que escribir los datos por adelantado en la pestaña
**ENTRADA** y pulsar **Ejecutar con esta entrada**.

**Dice «El programa no terminó a tiempo (posible bucle infinito)».**
El programa se quedó dando vueltas sin terminar. Suele ser un `while` cuya condición
nunca se vuelve falsa. Hay un límite de unos segundos por ejecución.

**Dice «El programa se cerró de forma anormal: SIGSEGV».**
El programa tocó memoria que no era suya (un puntero nulo, un índice fuera de un arreglo).
Lo que había impreso antes de morir se conserva, así que sirve para ver hasta dónde llegó.

**Cerré la pestaña sin entregar. ¿Perdí el código?**
No. Al volver a abrir la página en el mismo navegador, el código sigue ahí. Pero no está
entregado: el profesor no lo ve hasta que pulse **Entregar**.

**Entregué algo con un error. ¿Puedo borrarlo?**
No, y es a propósito: una entrega es un documento que ya se envió. Corrija y entregue de
nuevo; el profesor verá las dos y corregirá la última.

**¿Se pierden las entregas si la página se actualiza o se apaga la computadora?**
No. Se guardan en una base de datos aparte. Se pueden ver desde otro dispositivo, otro
navegador, otro día.

**¿Funciona en el teléfono?**
Sí. La pantalla se reorganiza: el panel de abajo queda debajo del editor y el menú
lateral se abre por encima. Para escribir código, una computadora es mucho más cómoda.

**No me deja entrar a `/profesor`.**
Compruebe mayúsculas y minúsculas de la contraseña. Si se equivoca muchas veces seguidas,
la página hace esperar un minuto. Si la olvidó, vea el final de la sección 3.

**Salió un mensaje raro que empieza por «El servicio de compilación…».**
El servicio externo que compila el C++ no respondió en ese momento. No se pierde nada:
espere unos segundos y vuelva a pulsar **Compilar y ejecutar**.

**¿Puedo usar `#include <bits/stdc++.h>` o `ios_base::sync_with_stdio(false)`?**
Sí, las dos cosas funcionan con normalidad, incluida la terminal interactiva.

**¿Qué versión de C++ es?**
C++17, compilado con **g++ 13.2** y las opciones `-std=c++17 -O1 -Wall` (se ven en la
primera línea de la terminal).

**¿Hay límites?**
Sí, holgados: el código hasta 100 000 caracteres, la entrada hasta 20 000, unos segundos
de ejecución por programa y un tope de ejecuciones por minuto para que nadie lo use de
juguete. Un ejercicio de clase no se acerca ni de lejos.

---

## 9. Lo que la página no hace (a propósito)

- **No propone ejercicios.** Los pone el profesor, fuera de la página.
- **No da pistas ni explica los errores.** Muestra el mensaje del compilador, tal cual.
  Aprender a leerlo es parte del trabajo.
- **No completa el ejercicio.** El autocompletado sugiere palabras del lenguaje
  (`while`, `std::vector`, `iostream`), igual que cualquier editor de programación. Nunca
  sugiere la solución.
- **No hay puntos, insignias, niveles, rachas ni chat.** Es un laboratorio, no un juego.
- **No corrige sola.** Quien decide si está bien o mal es el profesor.

---

## 10. Consultar las entregas desde ChatGPT u otro programa

Si el alumno dice «ya lo entregué», se puede pedir la última entrega sin copiar y pegar
nada. Basta con abrir esta dirección en el navegador (o pasársela a un asistente):

**https://miguel-cpp-lab.vercel.app/api/submissions/latest**

Devuelve la última entrega en formato JSON: nombre, código, entrada, salida, fecha,
estado y notas del profesor.

Otras direcciones útiles:

| Dirección | Qué devuelve |
| --- | --- |
| `/api/submissions` | Todas las entregas, de la más reciente a la más antigua |
| `/api/submissions/latest` | Sólo la última |
| `/api/submissions/<id>` | Una concreta |

Para **corregir** desde fuera hace falta la contraseña del profesor:

```bash
curl -X POST https://miguel-cpp-lab.vercel.app/api/submissions/EL-ID/review \
  -H "Authorization: Bearer LA-CONTRASEÑA" \
  -H "Content-Type: application/json" \
  -d '{"status":"necesita_correccion","feedback":"Valida la entrada antes de usarla."}'
```

Conviene saber que **leer las entregas no pide contraseña**: es lo que permite que un
asistente las consulte. Corregir, en cambio, sí. Los ejercicios de clase se consideran
información no confidencial; si algún día dejara de serlo, hay que pedir la contraseña
también para leer (está explicado en la sección técnica).

---

## 11. Parte técnica (para quien mantenga la página)

Esta sección ya asume conocimientos de programación. El resto del manual no la necesita.

### Qué usa

| Pieza | Elección |
| --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript |
| Editor | CodeMirror 6 (`@uiw/react-codemirror`) con `@codemirror/lang-cpp` |
| Base de datos | Supabase PostgreSQL — tablas `cpp_lab_*` del proyecto *Mis proyectos* |
| Compilador | Compiler Explorer (godbolt.org), GCC 13.2, `-std=c++17 -O1 -Wall -ftabstop=4` |
| Hosting | Vercel; cada push a `main` despliega producción |
| Repositorio | https://github.com/M1gu3hb/miguel-cpp-lab |

### Cómo se consigue una terminal interactiva sin proceso vivo

El servicio de ejecución es de un solo disparo: se manda el código y toda la entrada, y
devuelve la salida. Aun así la terminal se comporta como una real, y no por adivinación:

1. Antes de compilar se antepone al fuente un prólogo que **envuelve el `streambuf` de
   `std::cin`**. Cuando el programa pide un carácter y no queda entrada, el prólogo
   imprime una marca con un token aleatorio (así el código del alumno no puede
   falsificarla). Esa marca es el instante exacto en el que un programa real se quedaría
   esperando.
2. La terminal muestra la salida **hasta** la marca y espera. Al escribir una línea, el
   programa se reejecuta con toda la entrada acumulada y sólo se pinta el trozo nuevo:
   como la entrada nueva contiene a la anterior, la salida sólo puede crecer.
3. `Ctrl+D` reejecuta en modo lote (EOF real). `Ctrl+C` aborta la petición en curso.
4. Si la salida deja de reproducir lo ya mostrado (programas con `rand`, `time`, memoria
   sin inicializar), se avisa y se repinta la ejecución completa en vez de fingir
   continuidad.

El mismo prólogo pone `std::cout` en `unitbuf` (así una señal no se lleva la salida por
delante) y sobrevive a `ios::sync_with_stdio(false)` reenganchando el buffer.

Dos honestidades más:

- Programas que leen con `scanf`, `getchar`, `fgets`… no pasan por `std::cin`: se detecta,
  se dice y se ejecuta en lote.
- Como el prólogo incluye `<iostream>`, un programa al que le falte ese `#include`
  compilaría aquí y no con g++ a secas. Por eso se compila **también** el código tal cual,
  en paralelo, y si ese falla mandan sus errores. Los números de línea y el fragmento con
  el `^~~~` se reubican para citar las líneas del editor.

### Desarrollo local

```bash
npm install
cp .env.example .env.local   # y rellenar los dos valores
npm run dev                  # http://localhost:3000
```

```bash
npm run build      # build de producción
npm run start      # sirve el build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

En el repositorio no hay ninguna clave. Las dos variables se definen en Vercel
(*Project → Settings → Environment Variables*) y en local en `.env.local`:

| Variable | Qué es |
| --- | --- |
| `SUPABASE_URL` | URL del proyecto de Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | *Publishable key* del proyecto (rol `anon`, permisos acotados) |

Opcionales: `CPP_COMPILER_ID`, `CPP_COMPILER_ARGS`, `CPP_COMPILER_LABEL`.
`GET /api/health` dice si cada variable **existe**, nunca su valor.

### Base de datos

`supabase/migrations/` tiene el esquema completo y sus permisos.

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

### Seguridad

- Todo el acceso a datos ocurre en el servidor; el navegador nunca ve claves de Supabase.
- El rol anónimo sólo puede **leer** e **insertar**, y al insertar sólo las columnas
  `title`, `code`, `stdin` y `compiler_output`: no puede modificar una entrega enviada ni
  forjar `id`, `created_at` o el estado.
- La revisión pasa por `cpp_lab_review_submission(...)` (`SECURITY DEFINER`), que exige la
  contraseña y valida cada nota contra el código real de la entrega.
- La contraseña se guarda con bcrypt (coste 11), mínimo 10 caracteres, y su alta sólo es
  posible dentro de una ventana que se abre a mano desde Supabase.
- `cpp_lab_secrets` y `cpp_lab_setup_window` no tienen permisos para `anon` ni
  `authenticated`.
- Hay límite de peticiones por minuto en `/api/run`, en la creación de entregas y en los
  endpoints de contraseña. Es en memoria del proceso: frena bucles accidentales y scripts
  curiosos, no a un atacante decidido.
- **Las lecturas son públicas a propósito** (ver sección 10).

### API completa

Lectura pública; escritura de revisiones con `Authorization: Bearer <contraseña>`.
Siempre ordenado de la entrega más reciente a la más antigua.

#### `GET /api/submissions`

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

#### `GET /api/submissions/latest`

Devuelve directamente el objeto de la última entrega, o `404` si no hay ninguna.

#### `GET /api/submissions/:id`

Una entrega concreta. Si el id no tiene forma de UUID, responde `400`.

#### `POST /api/submissions`

```json
{ "title": "Ejercicio 1", "code": "…", "stdin": "18", "compilerOutput": "…" }
```

Valida que el código no esté vacío y los tamaños máximos (código 100 000, stdin 20 000,
título 200, salida 100 000 caracteres). Responde `201` con `{ "submission": { … } }`.

#### `POST /api/submissions/:id/review`

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
- `feedback` y `title` son opcionales: omitirlos los deja como estaban; mandar
  `"feedback": ""` sí lo borra.
- `notes` es opcional: omitirlo deja las notas como estaban, `[]` las borra. Cada nota
  necesita `line` (entre 1 y el número de líneas del código entregado) y `body`
  (1–2000 caracteres); `kind` es `error` (por defecto), `sugerencia` o `elogio`.

#### `POST /api/run`

```json
{ "code": "#include <iostream>…", "stdin": "18", "mode": "interactive" }
```

`mode` `"interactive"` corta la salida donde el programa pide entrada y responde
`waitingForInput: true`; `"batch"` (por defecto) devuelve la ejecución completa.
`interactive: false` y `notice` avisan de que ese programa no puede tener sesión
interactiva. Devuelve además `status`, `statusLabel`, `commandLine`, `compileOutput`,
`diagnostics` (línea, columna y severidad de cada mensaje de g++), `stdout`, `stdoutFull`,
`stderr`, `exitCode`, `signal`, `timedOut`, `truncated`, `timeMs` y `console`.

#### Otros

| Endpoint | Para qué |
| --- | --- |
| `GET /api/health` | Estado de la configuración, sin revelar valores |
| `GET /api/professor/status` | `{ bound, setupOpen }`: si hay contraseña y si el alta está abierta |
| `POST /api/professor/setup` | Da de alta la contraseña (sólo con la ventana abierta) |
| `POST /api/professor/session` | Valida la contraseña |
| `POST /api/professor/rotate` | Cambia la contraseña |

### Migración desde AppDeploy

La versión anterior vivía en `miguel-c-lab-4sm2k2.v2.appdeploy.ai`. Sus entregas se
exportaron por su propia API y se insertaron aquí conservando `id`, código, stdin, salida
del compilador, estado y fecha original. Había **una** entrega y está migrada. La página
puente que redirigía a AppDeploy ya no existe: producción sirve esta aplicación.
