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
- Cada hilo re-parsea sus propias instrucciones de métodos para evitar estado compartido entre hilos (`resuelto`, `resultado`)
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

**Pendiente:** agregar más ejemplos de monitores (lectores-escritores, filósofos, barrera, etc.)

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

#### Modelo del buffer

El buffer del canal es suficientemente grande para los ejemplos de la materia — no hay límite artificial. No se puede hacer `while(true) { c.send(...) }` porque llenaría la memoria.

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

#### Pendiente

- Más ejemplos: pipeline, fan-out, productor-consumidor con canales, filósofos sin memoria compartida
- Threads dentro de procesos (sintaxis: `Thread(N) { ... }` adentro de un `process`)

---

## Roadmap

### Antes de v0 → v1

- **Threads dentro de procesos** — `Thread(N) { ... }` dentro de un `process`, con herencia de contexto (los threads ven las variables locales del proceso, incluyendo canales). La pureza del modelo de mensajes queda a cargo del programador — igual que con `global` en el resto del simulador.
  - El patrón principal es un servidor con loop: `while(true){ req = c.receive(); Thread(1){ ...procesar req... } }` — cada iteración lanza un thread nuevo. Requiere que `Thread` sea ejecutable en cualquier punto del body, no solo al inicio (hoy `LanzarThreads` se inyecta una sola vez al principio).
  - Ciclo de vida: los threads deberían poder crearse dinámicamente a lo largo de la ejecución y morir cuando terminan su tarea. Si el proceso padre muere, los hijos también mueren.
- **Más ejemplos reales** — pipeline, fan-out, productor-consumidor con canales, filósofos sin memoria compartida, y otros patrones de la materia
- **Verificación general** — asegurarse de que todo ande correctamente antes de taggear v1

---

### Ideas para v1+

- **Mejor representación de objetos en la traza** — en vez de `[Buffer]` o `[Database]`, mostrar el estado interno del objeto (atributos y sus valores actuales) para que la traza sea más legible

- **`sleep(n)`** — instrucción que pausa un thread. El `n` no representa tiempo real sino algo a definir: probablemente *instrucciones ejecutadas por otros threads* antes de que este vuelva a ser elegible, o simplemente un número de *pasos del scheduler*. Hace visible el efecto del timing sin necesidad de concurrencia real.

- **Visualización de deadlock** — cuando todos los threads están bloqueados y ninguno puede avanzar, mostrarlo claramente en pantalla (ya aparece un warn en algunos casos, habría que pulirlo y hacerlo visible en la UI)

- **Más ejemplos de algoritmos** — Peterson, Dekker, 5 filósofos con semáforos, sleeping barber, barbería, etc.

- **Traza paso a paso** — dos modos de ejecución: el modo continuo actual (corre todo y muestra la traza al final) y un modo paso a paso donde el usuario avanza con un botón y ve la traza crecer en tiempo real. Para implementarlo hay que extraer "ejecutar un paso" como función independiente en `EstadoGlobal` y mover el control del loop a `script.js` — la lógica de scheduling no cambia, solo quién decide cuándo ejecutar el siguiente paso.

- **Otras formas de visualización** — por ejemplo: diagrama de estados de los threads (corriendo / bloqueado / terminado), línea de tiempo estilo Gantt, o vista de memoria compartida en tiempo real

---

---

## Arquitectura

| Archivo | Rol |
|---|---|
| `index.html` | UI: editor, controles, paneles de salida |
| `style.css` | Estilos |
| `script.js` | Orquesta UI y ejecución |
| `lexer.js` | Tokeniza el pseudocódigo |
| `parser.js` | Convierte tokens en instrucciones ejecutables |
| `instrucciones.js` | Clases de instrucciones (assign, if, while, semáforos, monitores, canales, etc.) |
| `hilos.js` | Lógica de ejecución de cada thread |
| `estadoGlobal.js` | Scheduler y traza |
| `memoria.js` | Manejo de variables |
| `semaforo.js` | Clase Semaphore con acquire/release |
| `clase.js` | Clases `Clase` e `Instancia` para el modelo de objetos |
| `monitor.js` | Clases `Monitor`, `InstanciaMonitor` y `VariableCondicion` |
| `canal.js` | Clases `Canal` y `Request` para comunicación por mensajes |
| `listaCircular.js` | Estructura para ciclos con interleaving |
| `ejemplo.js` | Ejemplos precargados por categoría |
| `errores.js` | Clase ErrorSimulador para errores de parse y runtime |
