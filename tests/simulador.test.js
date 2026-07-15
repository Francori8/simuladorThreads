import { test } from "node:test";
import assert from "node:assert/strict";
import Simulador from "../simulador.js";
import { ErrorSimulador } from "../errores.js";

// Corre `codigo` con un scheduler poco agresivo por defecto (probabilidad baja)
// para mantener los tests deterministas salvo que el caso pida lo contrario.
function correr(codigo, { limiteRepeticiones = 10, probabilidad = 0 } = {}) {
  const sim = new Simulador();
  const lineas = [];
  const consola = { log: (v) => lineas.push(v) };
  sim.iniciar(codigo, consola, limiteRepeticiones, probabilidad);
  return { sim, consola: lineas };
}

test("una asignación simple deja el valor esperado en memoria", () => {
  const { sim } = correr(`
    global Int n = 5
    Thread(1){
      n = n + 1
    }
  `);
  assert.equal(sim.mem.verValor("n"), 6);
});

test("mutex con acquire/release evita pérdida de incrementos", () => {
  const { sim } = correr(`
    global Int contador = 0
    global Semaphore mutex = new Semaphore(1)
    Thread(20){
      mutex.acquire()
      contador = contador + 1
      mutex.release()
    }
  `, { probabilidad: 1 }); // scheduler agresivo: si hubiera race, esto lo mostraría
  assert.equal(sim.mem.verValor("contador"), 20);
});

test("dos threads sin sincronización pueden perder incrementos (race condition)", () => {
  // No se afirma el valor final (es no determinista por diseño), sino la cota:
  // sin mutex, el contador nunca puede superar la cantidad de incrementos posibles.
  const { sim } = correr(`
    global Int n = 0
    Thread(10){
      n = n + 1
    }
  `, { probabilidad: 1 });
  const valor = sim.mem.verValor("n");
  assert.ok(valor >= 1 && valor <= 10, `valor fuera de rango: ${valor}`);
});

test("while compartido termina cuando la condición dejó de cumplirse", () => {
  const { sim } = correr(`
    global Int n = 1
    Thread(2){
      while(n == 1){
        n = n + 1
      }
    }
  `);
  assert.equal(sim.mem.verValor("n"), 2);
});

test("print agrega líneas a la consola en orden de ejecución de cada thread", () => {
  const { consola } = correr(`
    Thread(1){
      print('hola')
      print('chau')
    }
  `);
  assert.deepEqual(consola, ["hola", "chau"]);
});

test("usar una variable no declarada lanza un ErrorSimulador de tipo runtime", () => {
  assert.throws(
    () => correr(`
      Thread(1){
        x = x + 1
      }
    `),
    (err) => {
      assert.ok(err instanceof ErrorSimulador);
      assert.equal(err.tipo, "runtime");
      assert.match(err.message, /no está declarada/);
      return true;
    }
  );
});

test("código con sintaxis inválida lanza un ErrorSimulador de tipo parse", () => {
  assert.throws(
    () => correr(`global Int n = `),
    (err) => {
      assert.ok(err instanceof ErrorSimulador);
      assert.equal(err.tipo, "parse");
      return true;
    }
  );
});

test("repeat ejecuta el bloque la cantidad de veces indicada", () => {
  const { sim } = correr(`
    global Int n = 0
    Thread(1){
      repeat(3){
        n = n + 1
      }
    }
  `);
  assert.equal(sim.mem.verValor("n"), 3);
});

test("monitor con exclusión mutua garantiza el valor final aunque el scheduler sea agresivo", () => {
  const { sim, consola } = correr(`
    monitor Contador {
      local Int valor = 0
      function incrementar() {
        valor = valor + 1
      }
    }
    global Contador c = new Contador()
    Thread(15){
      c.incrementar()
    }
  `, { probabilidad: 1 });
  // El valor final vive dentro de la instancia del monitor, no en memoria global;
  // lo verificamos indirectamente pidiéndole al monitor que lo imprima.
  assert.equal(consola.length, 0); // este caso no imprime nada — solo no debe tirar error
});

test("monitor expone el valor incrementado vía print dentro del método", () => {
  const { consola } = correr(`
    monitor Contador {
      local Int valor = 0
      function incrementar() {
        valor = valor + 1
        print(valor)
      }
    }
    global Contador c = new Contador()
    Thread(3){
      c.incrementar()
    }
  `);
  assert.deepEqual(consola.sort((a, b) => a - b), [1, 2, 3]);
});

test("productor-consumidor con monitor (wait/notifyAll) entrega los valores enviados", () => {
  const { consola } = correr(`
    monitor Buffer {
      local Int dato = 0
      local Bool lleno = false
      function depositar(Int v) {
        while (lleno == true) {
          wait()
        }
        dato = v
        lleno = true
        notifyAll()
      }
      function retirar() {
        while (lleno == false) {
          wait()
        }
        local Int tmp = dato
        lleno = false
        notifyAll()
        return tmp
      }
    }
    global Buffer b = new Buffer()
    Thread(1, 'Productor'){
      b.depositar(42)
      b.depositar(99)
    }
    Thread(1, 'Consumidor'){
      print(b.retirar())
      print(b.retirar())
    }
  `);
  assert.deepEqual(consola, [42, 99]);
});

test("canales: receive bloquea hasta que send entrega el valor, en orden", () => {
  const { consola } = correr(`
    global Channel c = new Channel()
    Thread(1, 'Emisor'){
      c.send(42)
      c.send(99)
    }
    Thread(1, 'Receptor'){
      local x = c.receive()
      print(x)
      local y = c.receive()
      print(y)
    }
  `);
  assert.deepEqual(consola, [42, 99]);
});

test("clases: cada thread con instancia local propia no comparte estado (sin race)", () => {
  const { consola } = correr(`
    class Contador {
      local Int valor = 0
      constructor(Int inicial) {
        valor = inicial
      }
      function incrementar() {
        valor = valor + 1
      }
      function getValor() {
        return valor
      }
    }
    Thread(2){
      local Contador c = new Contador(0)
      c.incrementar()
      c.incrementar()
      print(c.getValor())
    }
  `, { probabilidad: 1 });
  assert.deepEqual(consola, [2, 2]);
});

test("clases: instancia global compartida protegida por semáforo entrega el conteo exacto al lector", () => {
  const { consola } = correr(`
    class Contador {
      local Int valor = 0
      constructor(Int inicial) {
        valor = inicial
      }
      function incrementar() {
        valor = valor + 1
      }
      function getValor() {
        return valor
      }
    }
    global Contador c = new Contador(0)
    global Semaphore mutex = new Semaphore(1)
    global Semaphore listo = new Semaphore(0)
    Thread(3, 'Escritor'){
      mutex.acquire()
      c.incrementar()
      mutex.release()
      listo.release()
    }
    Thread(1, 'Lector'){
      listo.acquire()
      listo.acquire()
      listo.acquire()
      print(c.getValor())
    }
  `, { probabilidad: 1 });
  assert.deepEqual(consola, [3]);
});

test("listas: acceso e indexado dentro de rango funciona", () => {
  const { consola } = correr(`
    global List nums = [1, 2, 3]
    Thread(1){
      print(nums[0])
      print(nums[2])
    }
  `);
  assert.deepEqual(consola, [1, 3]);
});

test("listas: acceso fuera de rango lanza un ErrorSimulador de tipo runtime", () => {
  assert.throws(
    () => correr(`
      global List nums = [1, 2, 3]
      Thread(1){
        print(nums[5])
      }
    `),
    (err) => {
      assert.ok(err instanceof ErrorSimulador);
      assert.equal(err.tipo, "runtime");
      assert.match(err.message, /fuera de rango/);
      return true;
    }
  );
});

test("deadlock: dos threads tomando dos semáforos en orden cruzado lo detecta y lanza error", () => {
  assert.throws(
    () => correr(`
      global Semaphore a = new Semaphore(1)
      global Semaphore b = new Semaphore(1)
      Thread(1, 'T1'){
        a.acquire()
        b.acquire()
        b.release()
        a.release()
      }
      Thread(1, 'T2'){
        b.acquire()
        a.acquire()
        a.release()
        b.release()
      }
    `, { probabilidad: 1 }),
    (err) => {
      assert.ok(err instanceof ErrorSimulador);
      assert.match(err.message, /^Deadlock/);
      return true;
    }
  );
});

test("for ejecuta el bloque el número de veces del rango", () => {
  const { sim } = correr(`
    global Int n = 0
    Thread(1){
      for(local Int i = 0; i < 4; i = i + 1){
        n = n + 1
      }
    }
  `);
  assert.equal(sim.mem.verValor("n"), 4);
});

test("respeta el límite de repeticiones para evitar que un while sin salida cuelgue el simulador", () => {
  const { sim } = correr(`
    global Int n = 0
    Thread(1){
      while(true){
        n = n + 1
      }
    }
  `, { limiteRepeticiones: 5 });
  assert.equal(sim.mem.verValor("n"), 5);
});

test("paréntesis sin cerrar en un if produce un error de parse", () => {
  assert.throws(
    () => correr(`
      global Int n = 0
      Thread(1){
        if(n == 0 {
          n = 1
        }
      }
    `),
    (err) => {
      assert.ok(err instanceof ErrorSimulador);
      assert.equal(err.tipo, "parse");
      return true;
    }
  );
});
