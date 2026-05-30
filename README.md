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
- `Thread(N, 'nombre')` crea N instancias con nombre
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

## Lo que falta implementar

### Clases

#### Sintaxis planificada

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

#### Modelo de memoria

Cuando un método accede a una variable, el orden de búsqueda es:
1. Variables locales del método
2. Atributos de la instancia
3. Variables globales

Los atributos pertenecen a la **instancia**, no a la clase. Si dos threads tienen referencia a la misma instancia, ven los mismos atributos (posible race condition). Si cada thread crea su propia instancia con `local`, no se comparte nada.

#### Plan de implementación

**Lexer:**
- `class` → ya existe (`TK.CLASS`)
- `constructor` → nueva keyword `TK.CONSTRUCTOR`
- `this` → ya existe (`TK.THIS`)

**Parser:**
- `parseClass()` — parsea atributos, constructor y métodos. Guarda en tabla de clases compartida (similar a `funciones`).
- `parseGlobalDecl()` / `parseLocal()` — detectar `new NombreClase(args)` para crear instancias.
- `AccesoMetodo` ya maneja `obj.metodo(args)` — se extiende para llamadas a métodos de instancia.

**Nueva clase `Instancia` (archivo propio `instancia.js`):**
```js
class Instancia {
    constructor(nombreClase, memoriaInstancia, metodos)
    // memoriaInstancia → objeto Memoria con los atributos de la instancia
    // metodos → tabla nombre -> { params, instrucciones }
}
```

**Nueva instrucción `LlamadaMetodo` en `instrucciones.js`:**
- Similar a `LlamadaFuncion` pero al entrar al método activa un tercer nivel de memoria (la instancia).
- El hilo necesita saber cuál es la instancia activa para resolver lecturas/escrituras de atributos.

**`hilos.js`:**
- Agregar `memoriaInstancia` al frame del call stack cuando se llama un método.
- `leer(nombre)`: busca en local → instancia activa → global.
- `escribir(nombre, valor)`: escribe en el primer nivel donde existe la variable.

---

### Monitores

*(Pendiente de definición — el usuario explicará cómo funcionan los monitores de la materia antes de implementar.)*

La idea base es que un monitor es como una clase pero con exclusión mutua implícita: cuando un thread entra a cualquier método del monitor, los demás threads que intenten entrar quedan bloqueados hasta que el primero termine.

Sintaxis planificada:
```
monitor Buffer {
    local Int dato = 0

    constructor() {
    }

    function depositar(Int v) {
        dato = v
    }

    function retirar() {
        return dato
    }
}
```

---

### Metaprogramación (post-concurrencia)

Hoy `AccesoMetodo` tiene una tabla estática de métodos disponibles (`maximum`, `minimum`, `length`, `sum`). Agregar un nuevo método a un objeto requiere modificar el lexer, parser y esa tabla.

**Objetivo:** que `AccesoMetodo` delegue directamente al objeto JS si tiene ese método, sin hardcodear nada. Así agregar `permisos()` a `Semaphore` solo requiere escribir el método en `semaforo.js`.

Los únicos casos especiales que siempre necesitan tratamiento en el parser son `acquire`/`release` porque son métodos **bloqueantes** — generan instrucciones propias (`Acquire`/`Release`) en lugar de `AccesoMetodo`.

---

## Arquitectura

| Archivo | Rol |
|---|---|
| `index.html` | UI: editor, controles, paneles de salida |
| `style.css` | Estilos |
| `script.js` | Orquesta UI y ejecución |
| `lexer.js` | Tokeniza el pseudocódigo |
| `parser.js` | Convierte tokens en instrucciones ejecutables |
| `instrucciones.js` | Clases de instrucciones (assign, if, while, semáforos, etc.) |
| `hilos.js` | Lógica de ejecución de cada thread |
| `estadoGlobal.js` | Scheduler y traza |
| `memoria.js` | Manejo de variables |
| `semaforo.js` | Clase Semaphore con acquire/release |
| `listaCircular.js` | Estructura para ciclos |
| `ejemplo.js` | Ejemplos precargados por categoría |
| `errores.js` | Clase ErrorSimulador para errores de parse y runtime |
