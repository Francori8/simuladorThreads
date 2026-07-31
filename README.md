# Simulador de Threads

Simulador interactivo de concurrencia para uso educativo. Permite escribir pseudocódigo con múltiples threads y observar cómo la ejecución no-determinística puede generar condiciones de carrera, pérdida de escrituras y otros problemas clásicos de concurrencia.

## Idea

El objetivo es hacer visible lo que normalmente es invisible: el scheduler puede interrumpir un thread en cualquier punto entre instrucciones. Cada instrucción es atómica por sí sola (una lectura, una escritura, una operación), pero no las secuencias. La traza de ejecución muestra paso a paso qué hizo cada thread, en qué orden, y sobre qué valor operó.

El slider de **probabilidad** controla el sesgo del scheduler: en 0 tiende a mantener el mismo thread corriendo (más secuencial), en el máximo cambia de thread con más frecuencia (más interleaving).

---

## Sintaxis del pseudocódigo

```
global Int contador = 0

Thread(2){
    contador = contador + 1
}
```

- `Thread(N)` crea N instancias del mismo bloque
- `Thread(N, 'nombre')` crea N instancias con nombre — la traza muestra `TH N : Nombre`
- `global Tipo nombre = valor` declara una variable compartida entre todos los threads
- `local Tipo nombre = valor` declara una variable local al thread
- Tipos disponibles: `Int`, `String`, `Bool`, `List`, `Semaphore`

## Operaciones implementadas

| Categoría     | Operadores                  |
|---------------|-----------------------------|
| Aritméticas   | `+`  `-`  `*`  `/`          |
| Comparación   | `==`  `!=`  `>`  `>=`  `<`  `<=`  |
| Lógicas       | `&&`  `\|\|`  `!`           |
| Agrupación    | `( )`                       |

## Control de flujo implementado

- `if (condicion) { ... } else { ... }`
- `while (condicion) { ... }` — con límite de ciclos configurable
- `repeat(n) { ... }` — repite el bloque `n` veces
- `for(local Int i = 0; i < n; i = i + 1) { ... }`
- `for(x : lista) { ... }` — for-each
- `print(expresion)`
- `sleep(n)` — pausa el thread `n` pasos del scheduler; otros threads siguen ejecutando

## Funciones

```
function Int nombreFuncion(Int param1, Int param2) {
    return param1 + param2
}
```

- El tipo de retorno es opcional
- Los parámetros pueden llevar tipo o no
- El interleaving puede ocurrir entre instrucciones de la función

## Semáforos

```
global Semaphore s = new Semaphore(1)          // débil, 1 permiso
global Semaphore s = new Semaphore(1, true)    // fuerte (FIFO), 1 permiso
global Semaphore[] sems = new Semaphore[5](1)  // array de 5 semáforos débiles
global Semaphore[] sems = new Semaphore[5](1, true)  // array de 5 semáforos fuertes
```

- `s.acquire()` — pide un permiso. Si hay permisos disponibles (> 0), decrementa y sigue. Si no hay, bloquea el thread.
- `s.release()` — libera un permiso. Si hay threads bloqueados, hace hand-off directo (sin incrementar). Si no hay, incrementa.
- **Débil** (default): la estructura de espera es un Set — orden no garantizado al despertar
- **Fuerte** (`true`): la estructura de espera es una Queue FIFO — despierta al que lleva más tiempo esperando
- Los semáforos no pueden tener contador negativo
- El contador no es visible desde el pseudocódigo

---

## Clases

```
class Contador {
    local Int valor = 0

    constructor(Int valorInicial) {
        valor = valorInicial
    }

    function incrementar() {
        valor = valor + 1
    }

    function getValor() {
        return valor
    }
}

global Contador c = new Contador(10)

Thread(2){
    c.incrementar()
    print(c.getValor())
}
```

- `class NombreClase { ... }` define una clase con atributos, constructor y métodos
- `local Tipo nombre = valor` dentro de la clase declara un atributo con valor inicial
- `constructor(params) { ... }` se ejecuta al crear la instancia — puede recibir parámetros
- `function nombre(params) { ... }` dentro de la clase define un método
- `global NombreClase c = new NombreClase(args)` crea una instancia global compartida entre todos los threads
- `local NombreClase c = new NombreClase(args)` crea una instancia local al thread — no se comparte
- `c.metodo(args)` llama a un método sobre una instancia — el interleaving puede ocurrir entre instrucciones del método
- `this.metodo(args)` dentro de un método llama a otro método de la misma instancia

#### Modelo de memoria

Cuando un método accede a una variable, el orden de búsqueda es:
1. Variables locales del método
2. Atributos de la instancia
3. Variables globales

Los atributos pertenecen a la **instancia**, no a la clase. Si dos threads referencian la misma instancia global, ven los mismos atributos — posible race condition. Si cada thread crea su propia instancia con `local`, no hay memoria compartida.

#### Arquitectura de clases

- `clase.js` — `Clase` (definición: atributos default, métodos, constructor) e `Instancia` (memoria propia de atributos + referencia al nombre de clase)
- Cada hilo re-parsea sus propias instrucciones de métodos para evitar estado compartido entre hilos (`resueldo`, `resultado`)
- El lookup de métodos va: `hilo.clases[instancia.nombreClase].getMetodo(nombre)` — así cada hilo usa sus propias instrucciones frescas pero la instancia (y sus atributos) es compartida correctamente

---

## Monitores

```
monitor Buffer {
    condition hayDato
    condition hayEspacio

    local Int dato = 0
    local Bool lleno = false

    function depositar(Int v) {
        while (lleno == true) {
            hayEspacio.wait()
        }
        dato = v
        lleno = true
        hayDato.notify()
    }

    function retirar() {
        while (lleno == false) {
            hayDato.wait()
        }
        local Int tmp = dato
        lleno = false
        hayEspacio.notify()
        return tmp
    }
}

global Buffer b = new Buffer()

Thread(1, 'Productor'){
    b.depositar(42)
}

Thread(1, 'Consumidor'){
    print(b.retirar())
}
```

- `monitor NombreMonitor { ... }` define un monitor — como una clase pero con exclusión mutua implícita
- Solo un thread puede ejecutar un método del monitor a la vez; los demás quedan bloqueados hasta que el primero termine
- `local Tipo nombre = valor` dentro del monitor declara un atributo
- `constructor(params) { ... }` opcional, se ejecuta al instanciar
- `function nombre(params) { ... }` define un método con exclusión mutua automática
- `global NombreMonitor m = new NombreMonitor()` crea una instancia global del monitor

#### Variables de condición

Los monitores soportan variables de condición para sincronización más precisa:

```
condition nombreCondicion
```

- `wait()` — el thread libera el lock del monitor y se bloquea en la variable de condición default
- `notify()` — despierta al primero en esperar en la condición (FIFO)
- `notifyAll()` — despierta a todos los que esperan en la condición
- `condicion.wait()` — bloquea en una variable de condición explícita
- `condicion.notify()` — notifica la primera en esa condición
- `condicion.notifyAll()` — notifica todas en esa condición

**Semántica:**
- Las colas de variables de condición son **FIFO**
- La pelea por el lock al despertar es **aleatoria** (no FIFO)
- El monitor es **re-entrante**: si un método llama a otro método del mismo monitor, el lock no se suelta — se mantiene hasta que el método más externo termine
- Se recomienda usar `while` en lugar de `if` para re-verificar la condición al despertar (patrón estándar de monitores)

#### Arquitectura de monitores

- `monitor.js` — `Monitor` (definición), `InstanciaMonitor` (lock + profundidad de re-entrada + cola de espera), `VariableCondicion` (cola FIFO)
- `EntradaMonitor` — instrucción inyectada al inicio de cada método; toma el lock o bloquea
- El lock se libera en `retornarFuncion()` al detectar que el frame pertenece a un monitor, manejando correctamente tanto métodos con `return` explícito como los que terminan por agotamiento del bloque
- La re-entrada se maneja con un contador de profundidad: `liberarLock` solo suelta el lock cuando la profundidad llega a 0

---

## Canales

```
global Channel c = new Channel()

process Emisor(c) {
    c.send(42)
}

process Receptor(c) {
    local x = c.receive()
    print(x)
}
```

- `global Channel c = new Channel()` declara un canal global
- `local Channel c = new Channel()` declara un canal local
- `c.send(valor)` — **no bloqueante**: encola el valor en el buffer del canal. Si hay un receiver esperando, hace hand-off directo
- `c.receive()` — **bloqueante**: consume el primer valor del buffer. Si el buffer está vacío, bloquea el thread hasta que alguien haga `send`
- `process Nombre(c1, c2) { ... }` crea exactamente 1 thread con los canales como variables locales — semánticamente equivale a un proceso que se comunica solo por mensajes
- Los canales pueden pasarse como parámetros a funciones o enviarse por otro canal

#### Threads dinámicos dentro de procesos

```
process Servidor(c) {
    repeat(3) {
        local req = c.receive()
        Thread(1, 'Worker') {
            print(req + 1)
        }
    }
}
```

- `Thread(N) { ... }` puede aparecer en cualquier punto del flujo — dentro de `while`, `if`, `repeat`, etc.
- Se ejecuta en runtime: cada vez que el flujo llega a esa instrucción, lanza N hilos hijos
- Los hijos reciben un **snapshot** de la memoria local del padre al momento de ser lanzados — si el padre después modifica `req`, los hijos no lo ven
- Los hijos pueden leer variables del padre como si fueran propias (via `_memoriaContextoPadre`)
- Los hijos mueren cuando terminan su bloque; el padre sigue ejecutando independientemente

#### Modelo del buffer

El buffer del canal es suficientemente grande para los ejemplos de la materia — no hay límite artificial.

La semántica es FIFO: los mensajes se reciben en el orden en que fueron enviados.

#### Request

Para agrupar varios datos en un mensaje:

```
local req = new Request()
req.campo1 = valor1
req.campo2 = valor2
c.send(req)

local r = c.receive()
print(r.campo1)
```

- `new Request()` crea un objeto con campos dinámicos
- `r.campo = valor` asigna un campo
- `r.campo` lee un campo

#### Arquitectura de canales

- `canal.js` — `Canal` (buffer FIFO + cola de receivers bloqueados) y `Request` (mapa de campos dinámicos)
- `send` hace hand-off directo si hay receivers en espera; si no, encola en el buffer
- `receive` consume del buffer si hay dato; si no, bloquea el thread via `bloquearEnCanal()`
- El despertar sigue el mismo patrón que semáforos y monitores: `despertarDelCanal()` llama `resolverComoDesbloqueado(valor)` sobre la instrucción `Receive` pendiente

---

## Deadlock

Cuando todos los threads están bloqueados y ninguno puede avanzar, el simulador lo detecta automáticamente y lo muestra en el panel de error con la lista de threads bloqueados.

Ejemplos de deadlock están en la categoría **Errores**:
- Deadlock clásico con semáforos: T1 toma A y espera B, T2 toma B y espera A
- Deadlock en monitor: consumidores esperan en una condición que nadie notifica

---

## Roadmap

### Para v1

- **Verificación general** — correr todos los ejemplos y asegurarse que todo ande antes de taggear v1
- **Más ejemplos** — filósofos, sleeping barber, Dekker, pipeline, fan-out

### Ideas para v1+

- [x] **Web Worker** — implementado en `simulador.worker.js`, mueve la ejecución completa fuera del main thread
- [x] **Traza paso a paso** — implementado en `pasoapaso.js` + `pasoapaso.worker.js`

- **Otras formas de visualización** — línea de tiempo estilo Gantt, vista de memoria compartida en tiempo real

- **Muerte de hijos al morir el padre** — si un proceso padre termina, los threads hijos que lanzó dinámicamente también deberían terminar

### Mejoras educativas de UX

- [x] **Leyenda de estados de thread** — tooltip explicando qué significa preparado/bloqueado/durmiendo/terminado en el panel paso a paso (`index.html`, `style.css`)
- [x] **Tooltips en Probabilidad y Límite** — explican qué controla cada slider/opción del header
- [x] **Sugerencias pedagógicas en errores** — `errores.js` agrega una pista (💡) según el patrón del mensaje (variable no declarada, deadlock, índice fuera de rango, etc.)
- [x] **Comparar ejecuciones distintas del mismo código** — botón "Comparar 2 ejecuciones" abre un panel con dos columnas (variables/consola/traza) corriendo el mismo código con dos schedulers independientes; cada columna tiene su propio botón "↻ Reejecutar" (`index.html`, `style.css`, `script.js`)
- [x] **Historial de cambios por variable global** — en `#variables` cada variable con 2+ escrituras muestra el valor final y un toggle (▸) para desplegar cómo fue cambiando y qué thread hizo cada escritura (`script.js`, `estadoGlobal.js`, `hilos.js`)
- [x] **Representación de objetos en variables/traza** — `Instancia.toString()` (`clase.js`) e `InstanciaMonitor.toString()` (`monitor.js`) ahora muestran los atributos internos (ej. `Contador(valor: 3)`) en vez de `[Contador]`, usando un helper común `formatearAtributos()` (`memoria.js`) con protección de recursión consistente entre ambas clases
- [ ] ~~Resaltar en el editor la línea correspondiente al pasar el mouse sobre un paso de la traza~~ — **descartado por ahora**. Investigado: el parser no propaga número de línea a las instrucciones hoy, pero sería viable agregarlo asignando `instr.linea` después de cada `new` en `parser.js` (sin tocar las ~55 clases de `instrucciones.js`). Se descarta igual porque el beneficio pedagógico es marginal (el alumno ya ve la instrucción como texto en la traza) frente al costo: tocar ~55 puntos del parser y resolver qué pasa si el código se edita después de ejecutar (la línea quedaría desincronizada)

### Model checking — modo "Verificar" (plan, no implementado)

Idea: agregar un tercer modo de ejecución (junto a "Ejecutar" y "Paso a paso") que en vez de correr **un** entrelazado al azar (como hace hoy el scheduler probabilístico), **explora exhaustivamente todos los entrelazados posibles** de las instrucciones y reporta si alguno lleva a deadlock o si distintas variables globales pueden terminar con valores distintos según el orden — evidenciando race conditions sin que el usuario tenga que predecir nada de antemano.

Decisión de diseño clave: **no agregar `assert` ni ninguna instrucción nueva al pseudocódigo**. Mezclar la propiedad a verificar con el algoritmo que se está modelando iría contra el espíritu del simulador (foco en concurrencia, no en programar tests). El explorador reporta automáticamente, sin configuración del usuario:
1. **Deadlocks** — ¿existe algún camino que termine en deadlock? Si sí, guarda la secuencia exacta para poder cargarla en el visor de traza existente.
2. **Rango de valores finales de cada variable global** — el conjunto de valores distintos observados al final de la ejecución, across todos los caminos explorados, con frecuencia de cada uno (ej. "`contador` terminó en 2 el 77% de los caminos, en 1 el 23%").

#### Motor de exploración

`Memoria.clonar()` (`memoria.js`) hoy hace **shallow clone** — comparte referencias a `Instancia`, `Semaphore`, `Canal` entre el original y la copia. Eso es correcto **a propósito** para el caso que ya existe hoy: threads dinámicos lanzados dentro de un proceso (`lanzarHiloHijo` en `estadoGlobal.js`) necesitan ver el mismo canal/semáforo/instancia que su padre — comparten el objeto de verdad, no una copia. No hay que tocar `clonar()` ni ese mecanismo.

El problema del explorador es distinto y no debe resolverse con el mismo método: si dos ramas hipotéticas del árbol de exploración (ej. "elegir Thread1 primero" vs. "elegir Thread2 primero") comparten la misma instancia mutable de `Semaphore`/`Canal`, lo que muta la rama A contamina el punto de partida de la rama B — se pierde el aislamiento entre ramas. Extender o reusar `clonar()` para esto arriesgaría además romper por descuido el caso 1 si en algún momento se comparte código entre ambos mecanismos.

Por eso el enfoque elegido es **DFS por re-ejecución determinística**, sin clonar nada: para explorar una rama hermana, se re-parsea el código desde cero (barato, ya lo hace cada `iniciar()`) y se re-ejecuta el generador `decidirQuienSigueGen()` (`estadoGlobal.js`) forzando la secuencia de `threadIdForzado` que lleva a ese punto, más una elección nueva al final. Más costoso en CPU que clonar estado, pero mucho más seguro y no interfiere con el clonado existente.

Si en el futuro la re-ejecución resulta demasiado lenta y hace falta clonado real para acelerar el explorador, ese debería ser un método **nuevo y separado** (ej. `clonarProfundo()`), usado *solo* por `explorador.js` — nunca una modificación de `clonar()`, para no arriesgar el comportamiento ya validado de threads dinámicos.

**Poda esencial**: solo bifurcar en puntos donde `threadPreparados().length > 1`. Si hay un solo thread preparado, no hay elección real — seguir derecho sin gastar una rama. Reduce el árbol drásticamente en los ejemplos típicos de la materia.

**Límites duros**: `maxCaminos` y `maxProfundidad` configurables, con aviso explícito en el resultado si la exploración se truncó (no es garantía exhaustiva) — mismo espíritu que `limiteRepeticiones` ya existente para loops.

Poda futura (opcional, evaluar según performance real): **partial-order reduction** — si dos instrucciones consecutivas de threads distintos no tocan la misma variable global / semáforo / canal, el orden entre ellas no cambia el resultado, evitar bifurcar ahí. Requiere que cada instrucción exponga qué variables toca (lectura/escritura), metadato que no existe hoy en `instrucciones.js`.

#### Arquitectura propuesta

- `explorador.js` (nuevo) — motor puro sin DOM, mismo espíritu que `simulador.js`. Expone `explorar({ maxCaminos, maxProfundidad })` → `{ caminosExplorados, truncado, deadlocks: [...], valoresFinales: {...} }`.
- `explorador.worker.js` (nuevo) — mismo patrón que `simulador.worker.js`, corre la exploración en background y reporta progreso.
- UI (`script.js`, `index.html`): botón "Verificar". Resultado tipo "✅ 1.240 caminos, sin deadlock, `contador` siempre en 2" o "⚠️ `contador` varía: 1 (23%), 2 (77%)" o "❌ deadlock en 4/1.240 caminos" — con botón para cargar el camino específico (deadlock o valor particular) en el visor de traza / paso a paso existente.

#### Orden de implementación sugerido

1. `explorador.js` con DFS + poda de bifurcación única + límites duros. Probar aislado (sin worker/UI) contra ejemplos ya existentes: uno con race condition conocida, uno con deadlock conocido, uno correcto — validar que el resultado es el esperado antes de seguir.
2. `explorador.worker.js` + UI mínima (botón, resultado en texto).
3. UI: cargar la traza de un camino específico (deadlock o valor particular) en el visor existente.

### Fixes de code review (sesión de code-review high sobre el diff de mejoras educativas)

- [x] **Historial de variables con snapshot inmutable** — si una variable global es un objeto de clase (`Instancia`) que se muta luego vía métodos, el historial ahora guarda `valor.toString()` en el momento de la escritura (`hilos.js:escribir`), en vez de la referencia viva — antes todas las entradas pasadas del toggle mostraban el estado *final* mutado, no el histórico real
- [x] **Deduplicación del modo "Comparar 2 ejecuciones"** — se extrajo `ejecutarYRenderizar()` en `script.js`, reusada tanto por `ejecutarCodigo()` como por `ejecutarEnColumna()`; de paso se unificó el estilo del panel de error (antes con estilos inline en el modo comparar) usando la clase CSS `panel-error--error` en ambos modos, y se unificó el escape de HTML en los mensajes de consola
- [ ] ~~Resaltar en el editor la línea correspondiente al pasar el mouse sobre un paso de la traza~~ — **descartado por ahora**. Investigado: el parser no propaga número de línea a las instrucciones hoy, pero sería viable agregarlo asignando `instr.linea` después de cada `new` en `parser.js` (sin tocar las ~55 clases de `instrucciones.js`). Se descarta igual porque el beneficio pedagógico es marginal (el alumno ya ve la instrucción como texto en la traza) frente al costo: tocar ~55 puntos del parser y resolver qué pasa si el código se edita después de ejecutar (la línea quedaría desincronizada)

---

## Arquitectura

### Flujo general

```
código (texto)
   │
   ▼
lexer.js ──tokens──► parser.js ──instrucciones──► simulador.js
                                                       │
                                          crea hilos.js (uno por Thread)
                                          y coordina con estadoGlobal.js
                                          (scheduler probabilístico)
                                                       │
                                                       ▼
                                          traza + variables + consola
                                                       │
                                                       ▼
                                    script.js / pasoapaso.js (renderizan en el DOM)
```

`simulador.js` no toca el DOM: recibe código y devuelve datos (traza, variables, consola). Esto es lo que permite correrlo tanto en el hilo principal (`script.js`) como dentro de un Web Worker (`simulador.worker.js`, `pasoapaso.worker.js`) sin congelar la UI durante ejecuciones largas.

Hay dos modos de ejecución, cada uno con su propio worker:
- **Ejecución completa** (`simulador.worker.js`): corre todo el programa de una vez y devuelve la traza completa al terminar.
- **Paso a paso** (`pasoapaso.worker.js` + `pasoapaso.js`): expone un método para avanzar de a una instrucción, permitiendo pausar, ir manual o automático, y ver el estado de cada thread (preparado/bloqueado/durmiendo/terminado) en tiempo real.

### Archivos

| Archivo | Rol |
|---|---|
| `index.html` | UI: editor, controles, paneles de salida |
| `style.css` | Estilos |
| `script.js` | Punto de entrada: inicializa UI, conecta eventos y delega en `simulador.worker.js` |
| `simulador.js` | Orquesta ejecución: parseo, estado global, expone `iniciar()` y `trazaTexto()` |
| `simulador.worker.js` | Web Worker que corre `Simulador` para una ejecución completa sin bloquear la UI |
| `pasoapaso.js` | Controla el modo paso a paso desde la UI: arranca `pasoapaso.worker.js`, maneja auto/manual/pausa y renderiza cada paso |
| `pasoapaso.worker.js` | Web Worker que ejecuta el programa instrucción por instrucción y reporta el estado tras cada paso |
| `lexer.js` | Tokeniza el pseudocódigo |
| `parser.js` | Convierte tokens en instrucciones ejecutables |
| `instrucciones.js` | Clases de instrucciones (assign, if, while, semáforos, monitores, canales, sleep, etc.) |
| `hilos.js` | Lógica de ejecución de cada thread |
| `estadoGlobal.js` | Scheduler y traza — detecta deadlock, maneja sleep y threads dinámicos |
| `memoria.js` | Manejo de variables, con soporte de clonado para snapshots |
| `semaforo.js` | Clase Semaphore con acquire/release |
| `clase.js` | Clases `Clase` e `Instancia` para el modelo de objetos |
| `monitor.js` | Clases `Monitor`, `InstanciaMonitor` y `VariableCondicion` |
| `canal.js` | Clases `Canal` y `Request` para comunicación por mensajes |
| `listaCircular.js` | Estructura para ciclos con interleaving |
| `ejemplo.js` | Ejemplos precargados por categoría |
| `errores.js` | Clase ErrorSimulador para errores de parse y runtime |
