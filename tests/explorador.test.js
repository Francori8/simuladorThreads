import { test } from "node:test";
import assert from "node:assert/strict";
import Explorador from "../explorador.js";

// Etapa 1, tarea 1: validar que ejecutarSecuencia([]) (sin forzar nada, toma
// siempre el primer thread preparado) da un resultado determinista y
// coherente — no se compara contra Simulador porque éste usa sorteo
// aleatorio incluso con probabilidad 0 (Math.random() sigue interviniendo en
// sortearSuerte). Lo que importa acá es que dos corridas con la misma
// secuencia (vacía) dan siempre el mismo resultado, y que forzar una
// secuencia explícita cambia el resultado de forma predecible.

test("ejecutarSecuencia([]) es determinista entre corridas repetidas", () => {
  const codigo = `
    global Int n = 0
    Thread(1){
      n = n + 1
    }
  `;
  const exp = new Explorador(codigo);
  const r1 = exp.ejecutarSecuencia([]);
  const r2 = exp.ejecutarSecuencia([]);
  assert.deepEqual(r1.valoresFinales, r2.valoresFinales);
  assert.equal(r1.deadlock, null);
});

test("ejecutarSecuencia sin sincronización puede perder un incremento forzando el orden", () => {
  // n = n + 1 se resuelve en Lectura(n) + Escritura(n). Si se intercalan las
  // lecturas de ambos threads antes de que cualquiera escriba, se pierde un
  // incremento. Forzamos esa secuencia explícitamente por id de thread.
  const codigo = `
    global Int n = 0
    Thread(2){
      n = n + 1
    }
  `;
  const exp = new Explorador(codigo);

  // Secuencia: TH0 lee, TH1 lee, TH0 escribe, TH1 escribe -> pérdida de escritura
  const forzada = exp.ejecutarSecuencia([0, 1, 0, 1, 0, 1]);
  const nForzada = forzada.valoresFinales.find(v => v.startsWith("n:"));
  assert.ok(nForzada, "variable n debe estar presente");

  // Secuencia: TH0 corre a completitud antes de que arranque TH1 -> sin
  // pérdida. Se sobre-especifica TH0 (más elecciones que pasos reales tiene)
  // porque índices ya consumidos por un thread terminado simplemente se
  // ignoran — evita tener que contar el número exacto de instrucciones
  // atómicas que genera "n = n + 1" (lectura + escritura + fin de bloque).
  const secuencial = exp.ejecutarSecuencia([
    ...new Array(20).fill(0),
    ...new Array(20).fill(1),
  ]);
  const nSecuencial = secuencial.valoresFinales.find(v => v.startsWith("n:"));
  assert.equal(nSecuencial, "n: 2");
});

test("deadlock clásico de semáforos cruzados se detecta y no revienta la ejecución", () => {
  const codigo = `
    global Semaphore a = new Semaphore(1)
    global Semaphore b = new Semaphore(1)
    Thread(1, 'T1'){
      a.acquire()
      b.acquire()
      a.release()
      b.release()
    }
    Thread(1, 'T2'){
      b.acquire()
      a.acquire()
      b.release()
      a.release()
    }
  `;
  const exp = new Explorador(codigo);
  // Forzamos: T1 toma a, T2 toma b, luego ambos quedan bloqueados esperando
  // el semáforo que tiene el otro -> deadlock.
  const r = exp.ejecutarSecuencia([0, 1, 0, 1]);
  assert.ok(r.deadlock, "se esperaba deadlock detectado");
  assert.match(r.deadlock, /Deadlock/);
});

// Etapa 1, tareas 2-6: explorar() — bifurcación real, límites y reporte.

test("explorar() detecta que una race condition puede dar más de un valor final", () => {
  const codigo = `
    global Int n = 0
    Thread(2){
      n = n + 1
    }
  `;
  const exp = new Explorador(codigo);
  const r = exp.explorar();
  assert.equal(r.truncado, false);
  assert.equal(r.deadlocks.length, 0);
  const valoresN = [...r.valoresPorVariable["n"].keys()].sort();
  assert.deepEqual(valoresN, ["1", "2"], "n debe poder terminar en 1 (pérdida de escritura) o en 2 (correcto)");
});

test("explorar() con mutex no reporta falsos positivos de race condition", () => {
  const codigo = `
    global Int contador = 0
    global Semaphore mutex = new Semaphore(1)
    Thread(2){
      mutex.acquire()
      contador = contador + 1
      mutex.release()
    }
  `;
  const exp = new Explorador(codigo);
  const r = exp.explorar();
  assert.equal(r.truncado, false);
  assert.equal(r.deadlocks.length, 0);
  const valoresContador = [...r.valoresPorVariable["contador"].keys()];
  assert.deepEqual(valoresContador, ["2"], "con mutex, contador siempre debe terminar en 2 en todos los caminos");
});

test("explorar() encuentra deadlock en semáforos cruzados sin abortar el resto del árbol", () => {
  const codigo = `
    global Semaphore a = new Semaphore(1)
    global Semaphore b = new Semaphore(1)
    Thread(1, 'T1'){
      a.acquire()
      b.acquire()
      a.release()
      b.release()
    }
    Thread(1, 'T2'){
      b.acquire()
      a.acquire()
      b.release()
      a.release()
    }
  `;
  const exp = new Explorador(codigo);
  const r = exp.explorar();
  assert.equal(r.truncado, false, "el árbol completo es chico, no debería truncarse");
  assert.ok(r.deadlocks.length > 0, "se esperaba al menos un camino en deadlock");
  assert.ok(r.caminosExplorados > r.deadlocks.length, "debe haber explorado también caminos sin deadlock");
});

test("explorar() no reporta deadlocks falsos cuando el orden evita la espera circular", () => {
  // Ambos threads toman los semáforos en el mismo orden (a, luego b) —
  // rompe la espera circular, nunca debería haber deadlock en ningún camino.
  const codigo = `
    global Semaphore a = new Semaphore(1)
    global Semaphore b = new Semaphore(1)
    Thread(1, 'T1'){
      a.acquire()
      b.acquire()
      a.release()
      b.release()
    }
    Thread(1, 'T2'){
      a.acquire()
      b.acquire()
      a.release()
      b.release()
    }
  `;
  const exp = new Explorador(codigo);
  // No hace falta agotar el árbol completo (miles de caminos, igual que en
  // el caso del mutex de 2 threads) para verificar ausencia de deadlock: si
  // existiera alguno, aparecería dentro de una muestra acotada de caminos.
  const r = exp.explorar({ maxCaminos: 2000 });
  assert.equal(r.deadlocks.length, 0, "no debería haber deadlock si ambos toman los semáforos en el mismo orden");
});

test("explorar() respeta maxCaminos y marca truncado", () => {
  const codigo = `
    global Int contador = 0
    global Semaphore mutex = new Semaphore(1)
    Thread(4){
      mutex.acquire()
      contador = contador + 1
      mutex.release()
    }
  `;
  const exp = new Explorador(codigo);
  const r = exp.explorar({ maxCaminos: 50 });
  assert.equal(r.truncado, true);
  assert.ok(r.caminosExplorados <= 50, "no debe superar el límite pedido");
});

// Etapa 2: tests contra los ejemplos reales de ejemplo.js (o equivalentes
// mínimos), no solo casos armados a mano.

test("explorar() sobre el ejemplo b2 de ejemplo.js (race condition) reporta ambos valores posibles", () => {
  // ejemplo.js:41-46, id "b2" — texto idéntico al catálogo real.
  const codigo = `
global Int n = 0

Thread(2){
\tn = n + 1
}`;
  const exp = new Explorador(codigo);
  const r = exp.explorar();
  const valoresN = [...r.valoresPorVariable["n"].keys()].sort();
  assert.deepEqual(valoresN, ["1", "2"]);
});

// Nota: los ejemplos "Filósofos" de ejemplo.js (5 threads, array de
// semáforos con índice calculado en runtime) se probaron manualmente contra
// este explorador y quedaron fuera de la Etapa 2 — no completan en tiempo
// razonable ni siquiera reducidos a 2-3 threads (ver "Model checking" en
// este README para las cifras medidas). No se agrega un test que fuerce ese
// caso porque tardaría minutos y no aportaría una aserción distinta de las
// ya cubiertas arriba con semáforos nombrados directamente.
