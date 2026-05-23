# Simulador de Threads

Simulador interactivo de concurrencia para uso educativo. Permite escribir pseudocódigo con múltiples threads y observar cómo la ejecución no-determinística puede generar condiciones de carrera, pérdida de escrituras y otros problemas clásicos de concurrencia.

## Idea

El objetivo es hacer visible lo que normalmente es invisible: el scheduler puede interrumpir un thread en cualquier punto entre instrucciones. Cada instrucción es atómica por sí sola (una lectura, una escritura, una operación), pero no las secuencias. La traza de ejecución muestra paso a paso qué hizo cada thread, en qué orden, y sobre qué valor operó.

El slider de **probabilidad** controla el sesgo del scheduler: en 0 tiende a mantener el mismo thread corriendo (más secuencial), en el máximo cambia de thread con más frecuencia (más interleaving).

## Sintaxis del pseudocódigo

```
global Int contador = 0

Thread(2){
    contador = contador + 1
}
```

- `Thread(N)` crea N instancias del mismo bloque
- `global Tipo nombre = valor` declara una variable compartida entre todos los threads
- `local Tipo nombre = valor` declara una variable local al thread
- Tipos disponibles: `Int`, `String`, `Bool`, `List`

## Operaciones implementadas

| Categoría     | Operadores                  |
|---------------|-----------------------------|
| Aritméticas   | `+`  `-`  `*`  `/`          |
| Comparación   | `==`  `>`  `>=`  `<`  `<=`  |
| Lógicas       | `&&`  `\|\|`                |
| Agrupación    | `( )`                       |

## Control de flujo implementado

- `if (condicion) { ... } else { ... }`
- `while (condicion) { ... }` — con límite de ciclos configurable
- `repeat(n) { ... }` — repite el bloque `n` veces; `n` puede ser una variable. No es atómico: el scheduler puede interrumpir entre iteraciones. Respeta el mismo límite de ciclos que el while.
- `print(expresion)`

## Ejemplos incluidos

| ID | Descripción |
|----|-------------|
| 0  | Dos pares de threads imprimiendo colores distintos — muestra interleaving básico |
| 1  | Thread suma global e imprime — muestra que la lectura puede ser anterior a la escritura del otro thread |
| 2  | Dos threads incrementando la misma variable — clásico ejemplo de pérdida de escritura por race condition |
| 3  | Dos threads con variables distintas que dependen entre sí — pérdida de suma cruzada |
| 4  | While con condición compartida — dos threads esperando la misma condición |
| 5  | While con print — muestra cómo un thread puede leer valores viejos mientras el otro actualiza |
| 6  | Repeat — dos threads repitiendo un bloque 3 veces cada uno, con posible pérdida de incrementos |

---

## Lo que falta antes de agregar semáforos

Los semáforos necesitan que un thread pueda **bloquearse** esperando a otro. Para que eso funcione bien y sea útil educativamente, primero conviene tener:

### 1. Estado "bloqueado" en los threads
Hoy un thread está o `preparado` o terminado. Para semáforos hace falta un tercer estado: bloqueado. El scheduler tiene que saltear threads bloqueados y despertarlos cuando el semáforo los libere.

### 2. Operador `!=`
Es la negación de `==` y casi seguro aparece en cualquier ejemplo con semáforos o flags. Hoy no está.

### 3. Negación lógica `!`
Complementa `!=` y permite escribir condiciones más naturales como `while(!libre)`.

### 4. Ejecución paso a paso (manual step)
Con semáforos el flujo se vuelve más complejo. Poder avanzar instrucción por instrucción, eligiendo qué thread ejecuta, hace que el usuario entienda exactamente cuándo y por qué un thread queda bloqueado. Con la ejecución automática actual es difícil seguir la lógica.

### 5. Visualización del estado de cada thread
Mostrar junto a la traza si cada thread está `corriendo`, `bloqueado` o `terminado`. Con semáforos sin esto el usuario no entiende qué pasó.

### 6. `for` loop
Menos urgente que lo anterior, pero completa el set de control de flujo estándar. Sintaxis natural: `for(local Int i = 0; i < n; i = i + 1)`.

---

Los semáforos en sí serían dos instrucciones nuevas: `wait(s)` (P) y `signal(s)` (V), donde `s` es una variable global que actúa como semáforo. `wait` bloquea el thread si el valor es 0, `signal` lo despierta y decrementa/incrementa el contador.
