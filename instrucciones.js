import { ListaCircular } from "./listaCircular.js";
import { ErrorSimulador } from "./errores.js";
import { Instancia } from "./clase.js";
import { InstanciaMonitor } from "./monitor.js";

class Instruccion {
  constructor() {
    this.resuelto = false;
  }

  estaResuelto() { return this.resuelto; }
  esElse() { return false; }
  esFinDeBloque() { return false; }
  reiniciar() { this.resuelto = false; }
  esInstruccionConBloque() { return false; }

  toString() {
    throw new Error("Debes implementar toString() en la subclase de Instruccion");
  }
}

// Base para todas las operaciones binarias (aritméticas y lógicas)
class OperacionBinaria extends Instruccion {
  constructor(izq, der) {
    super();
    this.izq = izq;
    this.der = der;
  }

  reiniciar() {
    super.reiniciar();
    this.izq.reiniciar();
    this.der.reiniciar();
  }

  resolver(hilo) {
    if (!this.izq.estaResuelto()) {
      this.izq.resolver(hilo);
    } else if (!this.der.estaResuelto()) {
      this.der.resolver(hilo);
    } else {
      const a = this.izq.resolverPuro();
      const b = this.der.resolverPuro();
      this.resultado = this.operar(a, b);
      hilo.informar(this.tipoOp, `${a} ${this.simbolo} ${b} = ${this.resultado}`);
      this.resuelto = true;
    }
  }

  resolverPuro() { return this.resultado; }
}

class OperacionAritmetica extends OperacionBinaria {
  get tipoOp() { return "OP arit"; }
}

class OperacionLogica extends OperacionBinaria {
  get tipoOp() { return "OP bool"; }
}

// --- Aritméticas ---

export class Sumar extends OperacionAritmetica {
  operar(a, b) { return a + b; }
  get simbolo() { return "+"; }
  toString() { return `(${this.izq} + ${this.der})`; }
}

export class Restar extends OperacionAritmetica {
  operar(a, b) { return a - b; }
  get simbolo() { return "-"; }
  toString() { return `(${this.izq} - ${this.der})`; }
}

export class Multiplicar extends OperacionAritmetica {
  operar(a, b) { return a * b; }
  get simbolo() { return "*"; }
  toString() { return `(${this.izq} * ${this.der})`; }
}

export class Dividir extends OperacionAritmetica {
  operar(a, b) { return a / b; }
  get simbolo() { return "/"; }
  toString() { return `(${this.izq} / ${this.der})`; }
}

// --- Lógicas / comparaciones ---

export class Igualdad extends OperacionLogica {
  operar(a, b) { return a == b; }
  get simbolo() { return "=="; }
  toString() { return `(${this.izq} == ${this.der})`; }
}

export class Mayor extends OperacionLogica {
  operar(a, b) { return a > b; }
  get simbolo() { return ">"; }
  toString() { return `(${this.izq} > ${this.der})`; }
}

export class MayorOIgual extends OperacionLogica {
  operar(a, b) { return a >= b; }
  get simbolo() { return ">="; }
  toString() { return `(${this.izq} >= ${this.der})`; }
}

export class Menor extends OperacionLogica {
  operar(a, b) { return a < b; }
  get simbolo() { return "<"; }
  toString() { return `(${this.izq} < ${this.der})`; }
}

export class MenorOIgual extends OperacionLogica {
  operar(a, b) { return a <= b; }
  get simbolo() { return "<="; }
  toString() { return `(${this.izq} <= ${this.der})`; }
}

export class YLogico extends OperacionLogica {
  operar(a, b) { return a && b; }
  get simbolo() { return "&&"; }
  toString() { return `(${this.izq} && ${this.der})`; }
}

export class OLogico extends OperacionLogica {
  operar(a, b) { return a || b; }
  get simbolo() { return "||"; }
  toString() { return `(${this.izq} || ${this.der})`; }
}

// --- Instrucciones de memoria ---

export class Lectura extends Instruccion {
  constructor(variable) {
    super();
    this.variable = variable;
  }

  resolver(hilo) {
    this.resultado = hilo.leer(this.variable);
    this.resuelto = true;
  }

  resolverPuro() { return this.resultado; }
  toString() { return `${this.variable}`; }
}

export class Escritura extends Instruccion {
  constructor(nombre, valor) {
    super();
    this.nombre = nombre;
    this.valor = valor;
  }

  reiniciar() {
    super.reiniciar();
    this.valor.reiniciar();
  }

  resolver(hilo) {
    if (!this.valor.estaResuelto()) {
      this.valor.resolver(hilo);
    } else {
      hilo.escribir(this.nombre, this.valor.resolverPuro());
      this.resuelto = true;
    }
  }

  toString() { return `${this.nombre} = ${this.valor.toString()}`; }
}

export class DeclaracionVariableLocal extends Instruccion {
  constructor(string, funcionAMemoria) {
    super();
    this.escritura = string;
    this.funcion = funcionAMemoria;
  }

  resolver(hilo) {
    hilo.declararLocal(this.escritura, this.funcion);
    this.resuelto = true;
  }

  toString() { return `local ${this.escritura}`; }
}

export class InicializarLocal extends Instruccion {
  constructor(nombre, expresion) {
    super();
    this.nombre = nombre;
    this.expresion = expresion;
  }

  reiniciar() {
    super.reiniciar();
    this.expresion.reiniciar();
  }

  resolver(hilo) {
    if (!this.expresion.estaResuelto()) {
      this.expresion.resolver(hilo);
    } else {
      hilo.escribir(this.nombre, this.expresion.resolverPuro());
      this.resuelto = true;
    }
  }

  toString() { return `local ${this.nombre} = ${this.expresion}`; }
}

export class ValorFijo extends Instruccion {
  constructor(valor) {
    super();
    this.valor = valor;
  }

  resolver(hilo) {
    this.resultado = hilo.evaluar(this.valor);
    this.resuelto = true;
  }

  resolverPuro() { return this.resultado; }
  toString() { return `${this.valor}`; }
}

// --- Instrucciones de control ---

export class Imprimir extends Instruccion {
  constructor(valor, consola) {
    super();
    this.valor = valor;
    this.consola = consola;
  }

  reiniciar() {
    super.reiniciar();
    this.valor.reiniciar();
  }

  resolver(hilo) {
    if (!this.valor.estaResuelto()) {
      this.valor.resolver(hilo);
    } else {
      const v = this.valor.resolverPuro();
      this.consola.innerHTML += `<p>${v}</p>`;
      hilo.informar("Imprimir", v);
      this.resuelto = true;
    }
  }

  toString() { return `imprimir(${this.valor.toString()})`; }
}

export class Condicional extends Instruccion {
  constructor(condicion) {
    super();
    this.condicion = condicion;
  }

  reiniciar() { this.condicion.reiniciar(); }

  resolver(hilo) {
    if (!this.condicion.estaResuelto()) {
      this.condicion.resolver(hilo);
    } else {
      hilo.resolverCondicional(this.condicion.resolverPuro());
      this.resuelto = true;
    }
  }

  esInstruccionConBloque() { return true; }
  toString() { return `if (${this.condicion.toString()}) { ... }`; }
}

export class Ciclo extends Instruccion {
  constructor(condicion, bloque, maximo) {
    super();
    this.condicion = condicion;
    this.bloque = new ListaCircular(bloque);
    this.maximo = maximo;
    this._evaluandoCondicion = false;
  }

  terminado() { this.resuelto = true; }

  reiniciar() {
    super.reiniciar();
    this.maximo--;
    this.condicion.reiniciar();
    this._evaluandoCondicion = false;
    // El bloque se reinicia al fin de cada vuelta en resolver()
  }

  reiniciarParaLlamada() {
    this.resuelto = false;
    this.condicion.reiniciar();
    this._evaluandoCondicion = false;
    // Reiniciar cada instrucción del bloque recursivamente
    this.bloque.lista.forEach(i => i.reiniciarParaLlamada ? i.reiniciarParaLlamada() : i.reiniciar());
    this.bloque.indice = 0;
  }

  resolver(hilo) {
    if (this.maximo === 0) {
      this.resuelto = true;
      hilo.resolverMaximoCiclos();
      return;
    }

    // Mientras evaluamos la condición, no ejecutar el bloque
    if (this._evaluandoCondicion) {
      if (!this.condicion.estaResuelto()) {
        hilo.pushContexto(this.condicion);
        this.condicion.resolver(hilo);
        hilo.popContexto();
      } else {
        this._evaluandoCondicion = false;
        hilo.resolverSeguirCiclo(this.condicion.resolverPuro(), this);
      }
      return;
    }

    const siguiente = this.bloque.siguienteElemento();

    if (siguiente.estaResuelto()) {
      this.bloque.pasarElemento();
      const proxima = this.bloque.siguienteElemento();
      if (proxima.estaResuelto()) {
        // Fin de vuelta: reiniciar bloque y pasar a evaluar condición
        this.bloque.reiniciarTodos();
        this._evaluandoCondicion = true;
        hilo.pushContexto(this.condicion);
        this.condicion.resolver(hilo);
        hilo.popContexto();
      }
    } else {
      hilo.pushContexto(siguiente);
      siguiente.resolver(hilo);
      hilo.popContexto();
    }
  }

  toString() { return `while (${this.condicion.toString()}) { ... }`; }
}

export class While extends Instruccion {
  constructor(condicion, max) {
    super();
    this.condicion = condicion;
    this.max = max;
  }

  resolver(hilo) {
    if (!this.condicion.estaResuelto()) {
      this.condicion.resolver(hilo);
    } else {
      const valor = this.condicion.resolverPuro();
      this.condicion.reiniciar();
      hilo.resolverWhile(this.condicion, valor, this.max);
      this.resuelto = true;
    }
  }

  esInstruccionConBloque() { return true; }
  toString() { return `while (${this.condicion.toString()}) { ... }`; }
}

export class Else extends Instruccion {
  resolver(hilo) { this.resuelto = true; }
  esElse() { return true; }
  esInstruccionConBloque() { return true; }
  toString() { return `else { ... }`; }
}

export class FinDeBloque extends Instruccion {
  resolver(hilo) { this.resuelto = true; }
  esFinDeBloque() { return true; }
  toString() { return `}`; }
}

export class For extends Instruccion {
  constructor(init, condicion, incremento, max) {
    super();
    this.init = init;
    this.condicion = condicion;
    this.incremento = incremento;
    this.max = max;
  }

  reiniciar() {
    super.reiniciar();
    this.init.reiniciar();
    this.condicion.reiniciar();
    this.incremento.reiniciar();
  }

  resolver(hilo) {
    if (!this.init.estaResuelto()) {
      this.init.resolver(hilo);
    } else if (!this.condicion.estaResuelto()) {
      this.condicion.resolver(hilo);
    } else {
      const valor = this.condicion.resolverPuro();
      this.condicion.reiniciar();
      hilo.resolverFor(this.condicion, this.incremento, valor, this.max);
      this.resuelto = true;
    }
  }

  esInstruccionConBloque() { return true; }
  toString() { return `for(...) { ... }`; }
}

export class ForEach extends Instruccion {
  constructor(nombreVar, listaExpr, max) {
    super();
    this.nombreVar = nombreVar;
    this.listaExpr = listaExpr;
    this.max = max;
  }

  reiniciar() {
    super.reiniciar();
    this.listaExpr.reiniciar();
  }

  resolver(hilo) {
    if (!this.listaExpr.estaResuelto()) {
      this.listaExpr.resolver(hilo);
    } else {
      const lista = this.listaExpr.resolverPuro();
      hilo.resolverForEach(this.nombreVar, lista, this.max);
      this.resuelto = true;
    }
  }

  esInstruccionConBloque() { return true; }
  toString() { return `for(${this.nombreVar} : ${this.listaExpr}) { ... }`; }
}

export class CicloForEach extends Instruccion {
  constructor(nombreVar, lista, bloque, maximo) {
    super();
    this.nombreVar = nombreVar;
    this.lista = lista;
    this.bloque = new ListaCircular(bloque);
    this.indice = 0;
    this.maximo = maximo;
    this.varEstablecida = false;
  }

  reiniciar() {
    super.reiniciar();
    this.indice++;
    this.maximo--;
    this.bloque.reiniciarTodos();
    this.varEstablecida = false;
  }

  resolver(hilo) {
    if (this.maximo === 0) {
      this.resuelto = true;
      hilo.resolverMaximoCiclos();
      return;
    }
    if (this.indice >= this.lista.length) {
      this.resuelto = true;
      return;
    }

    if (!this.varEstablecida) {
      hilo.escribirLocal(this.nombreVar, this.lista[this.indice]);
      this.varEstablecida = true;
      return;
    }

    const siguiente = this.bloque.siguienteElemento();

    if (siguiente.estaResuelto()) {
      this.bloque.pasarElemento();
      const proxima = this.bloque.siguienteElemento();
      if (proxima.estaResuelto()) {
        this.reiniciar();
      }
    } else {
      hilo.pushContexto(siguiente);
      siguiente.resolver(hilo);
      hilo.popContexto();
    }
  }

  toString() { return `for(${this.nombreVar} : [${this.indice}/${this.lista.length}]) { ... }`; }
}

// Bloque interno del repeat: recibe el conteo ya evaluado y va decrementando
export class CicloRepeat extends Instruccion {
  constructor(bloque, maximo) {
    super();
    this.bloque = new ListaCircular(bloque);
    this.contador = 0;
    this.maximo = maximo;
  }

  iniciar(n) { this.contador = n; }
  terminado() { this.resuelto = true; }

  reiniciar() {
    super.reiniciar();
    this.contador--;
    this.maximo--;
    this.bloque.reiniciarTodos();
  }

  resolver(hilo) {
    if (this.maximo === 0) {
      this.resuelto = true;
      hilo.resolverMaximoCiclos();
      return;
    }
    if (this.contador <= 0) {
      this.resuelto = true;
      return;
    }

    const siguiente = this.bloque.siguienteElemento();

    if (siguiente.estaResuelto()) {
      this.bloque.pasarElemento();
      const proxima = this.bloque.siguienteElemento();
      if (proxima.estaResuelto()) {
        this.reiniciar();
      }
    } else {
      hilo.pushContexto(siguiente);
      siguiente.resolver(hilo);
      hilo.popContexto();
    }
  }

  toString() { return `repeat(${this.contador}) { ... }`; }
}

export class Repeat extends Instruccion {
  constructor(cantidadExpr, max) {
    super();
    this.cantidadExpr = cantidadExpr;
    this.max = max;
  }

  resolver(hilo) {
    if (!this.cantidadExpr.estaResuelto()) {
      this.cantidadExpr.resolver(hilo);
    } else {
      const n = this.cantidadExpr.resolverPuro();
      hilo.resolverRepeat(n, this.max);
      this.resuelto = true;
    }
  }

  esInstruccionConBloque() { return true; }
  toString() { return `repeat(${this.cantidadExpr.toString()}) { ... }`; }
}

// --- Nuevas instrucciones ---

export class Negacion extends Instruccion {
  constructor(expr) {
    super();
    this.expr = expr;
  }

  reiniciar() {
    super.reiniciar();
    this.expr.reiniciar();
  }

  resolver(hilo) {
    if (!this.expr.estaResuelto()) {
      this.expr.resolver(hilo);
    } else {
      const val = this.expr.resolverPuro();
      this.resultado = !val;
      hilo.informar("OP bool", `!${val} = ${this.resultado}`);
      this.resuelto = true;
    }
  }

  resolverPuro() { return this.resultado; }
  toString() { return `(!${this.expr})`; }
}

// Resuelve a la instancia activa en el call stack del hilo.
// Se usa para implementar `this` dentro de métodos de clase.
export class LecturaThis extends Instruccion {
  resolver(hilo) {
    this.resultado = hilo.getInstanciaActiva();
    if (!this.resultado) {
      throw ErrorSimulador.runtime(`"this" usado fuera de un método de instancia`);
    }
    hilo.informar("This", `${this.resultado}`);
    this.resuelto = true;
  }

  resolverPuro() { return this.resultado; }
  toString() { return `this`; }
}

export class GetId extends Instruccion {
  resolver(hilo) {
    this.resultado = hilo.getId();
    hilo.informar("GetId", `id = ${this.resultado}`);
    this.resuelto = true;
  }

  resolverPuro() { return this.resultado; }
  toString() { return `getId()`; }
}

export class Desigualdad extends OperacionLogica {
  operar(a, b) { return a != b; }
  get simbolo() { return "!="; }
  toString() { return `(${this.izq} != ${this.der})`; }
}

export class LecturaIndexada extends Instruccion {
  constructor(nombre, indiceExpr) {
    super();
    this.nombre = nombre;
    this.indiceExpr = indiceExpr;
  }

  reiniciar() {
    super.reiniciar();
    this.indiceExpr.reiniciar();
  }

  resolver(hilo) {
    if (!this.indiceExpr.estaResuelto()) {
      this.indiceExpr.resolver(hilo);
    } else {
      const idx = this.indiceExpr.resolverPuro();
      this.resultado = hilo.leerIndexado(this.nombre, idx);
      this.resuelto = true;
    }
  }

  resolverPuro() { return this.resultado; }
  toString() { return `${this.nombre}[${this.indiceExpr}]`; }
}

export class EscrituraIndexada extends Instruccion {
  constructor(nombre, indiceExpr, valorExpr) {
    super();
    this.nombre = nombre;
    this.indiceExpr = indiceExpr;
    this.valorExpr = valorExpr;
  }

  reiniciar() {
    super.reiniciar();
    this.indiceExpr.reiniciar();
    this.valorExpr.reiniciar();
  }

  resolver(hilo) {
    if (!this.indiceExpr.estaResuelto()) {
      this.indiceExpr.resolver(hilo);
    } else if (!this.valorExpr.estaResuelto()) {
      this.valorExpr.resolver(hilo);
    } else {
      const idx = this.indiceExpr.resolverPuro();
      const val = this.valorExpr.resolverPuro();
      hilo.escribirIndexado(this.nombre, idx, val);
      this.resuelto = true;
    }
  }

  toString() { return `${this.nombre}[${this.indiceExpr}] = ${this.valorExpr}`; }
}

// Valor literal ya evaluado (sin pasar por eval)
export class Literal extends Instruccion {
  constructor(valor) {
    super();
    this.valor = valor;
  }

  resolver(hilo) {
    this.resultado = this.valor;
    this.resuelto = true;
  }

  resolverPuro() { return this.resultado; }
  toString() { return JSON.stringify(this.valor); }
}

// Lista de expresiones que se evalúan paso a paso
export class ListaLiteral extends Instruccion {
  constructor(elementos) {
    super();
    this.elementos = elementos;
    this.idx = 0;
  }

  reiniciar() {
    super.reiniciar();
    this.idx = 0;
    this.elementos.forEach(e => e.reiniciar());
  }

  resolver(hilo) {
    while (this.idx < this.elementos.length) {
      const e = this.elementos[this.idx];
      if (!e.estaResuelto()) {
        e.resolver(hilo);
        return;
      }
      this.idx++;
    }
    this.resultado = this.elementos.map(e => e.resolverPuro());
    this.resuelto = true;
  }

  resolverPuro() { return this.resultado; }
  toString() { return `[${this.elementos.join(", ")}]`; }
}

// Acceso a método/propiedad sobre un objeto: obj.metodo o obj.metodo(args)
export class AccesoMetodo extends Instruccion {
  static METODOS = {
    maximum: (arr) => Math.max(...arr),
    minimum: (arr) => Math.min(...arr),
    length:  (arr) => arr.length,
    sum:     (arr) => arr.reduce((a, b) => a + b, 0),
  };

  constructor(objetoExpr, metodo, argsExprs = []) {
    super();
    this.objetoExpr = objetoExpr;
    this.metodo = metodo;
    this.argsExprs = argsExprs;
    this.argIdx = 0;
  }

  reiniciar() {
    super.reiniciar();
    this.objetoExpr.reiniciar();
    this.argIdx = 0;
    this.argsExprs.forEach(a => a.reiniciar());
  }

  resolver(hilo) {
    if (!this.objetoExpr.estaResuelto()) {
      this.objetoExpr.resolver(hilo);
      return;
    }
    while (this.argIdx < this.argsExprs.length) {
      const arg = this.argsExprs[this.argIdx];
      if (!arg.estaResuelto()) {
        arg.resolver(hilo);
        return;
      }
      this.argIdx++;
    }
    const obj  = this.objetoExpr.resolverPuro();
    const args = this.argsExprs.map(a => a.resolverPuro());
    const fn   = AccesoMetodo.METODOS[this.metodo];
    if (!fn) throw ErrorSimulador.runtime(`Método desconocido: "${this.metodo}"`);
    this.resultado = fn(obj, ...args);
    hilo.informar("Método", `${this.metodo}(${obj}) = ${this.resultado}`);
    this.resuelto = true;
  }

  resolverPuro() { return this.resultado; }
  toString() { return `${this.objetoExpr}.${this.metodo}`; }
}

// ─── Funciones ────────────────────────────────────────────────────────────────

// Llamada a función definida por el usuario.
// Evalúa los argumentos de a uno (con interleaving entre cada uno),
// luego empuja el frame de la función al call stack del hilo.
export class LlamadaFuncion extends Instruccion {
  constructor(nombre, argsExprs, tablaDeFunciones) {
    super();
    this.nombre          = nombre;
    this.argsExprs       = argsExprs;
    this.tablaDeFunciones = tablaDeFunciones;
    this.argIdx          = 0;
    this.enEjecucion     = false; // true mientras el frame de la función está activo
  }

  reiniciar() {
    super.reiniciar();
    this.argIdx      = 0;
    this.enEjecucion = false;
    this.argsExprs.forEach(a => a.reiniciar());
  }

  resolver(hilo) {
    // Fase 1: evaluar cada argumento de a uno
    while (this.argIdx < this.argsExprs.length) {
      const arg = this.argsExprs[this.argIdx];
      if (!arg.estaResuelto()) {
        arg.resolver(hilo);
        return; // cede el paso al scheduler
      }
      this.argIdx++;
    }

    // Fase 2: primer vez que todos los args están listos — empujar frame
    if (!this.enEjecucion) {
      this.enEjecucion = true;
      const def = this.tablaDeFunciones[this.nombre];
      if (!def) throw new Error(`Función desconocida: ${this.nombre}`);
      const valoresArgs = this.argsExprs.map(a => a.resolverPuro());
      hilo.informar("Llamada", `${this.nombre}(${valoresArgs.join(", ")})`);
      hilo.llamarFuncion(this.nombre, def.params, def.instrucciones, valoresArgs, this);
      // El hilo ahora ejecuta instrucciones de la función.
      // Esta instrucción queda pendiente hasta que Return llame a retornarFuncion().
      return;
    }

    // Fase 3: el frame ya terminó (retornarFuncion puso this.resultado y llamó resolve())
    // No hace nada — resuelto ya fue seteado por retornarFuncion
  }

  // Llamado por hilos.js cuando la función retorna
  resolve(valorRetorno) {
    this.resultado = valorRetorno;
    this.resuelto  = true;
  }

  resolverPuro() { return this.resultado; }
  toString() { return `${this.nombre}(...)`; }
}

// Instrucción return dentro de una función.
export class Return extends Instruccion {
  constructor(expr) {
    super();
    this.expr    = expr;
    this.exprIdx = 0;
  }

  reiniciar() {
    super.reiniciar();
    this.expr.reiniciar();
  }

  resolver(hilo) {
    if (!this.expr.estaResuelto()) {
      this.expr.resolver(hilo);
    } else {
      const valor = this.expr.resolverPuro();
      hilo.informar("Return", `${this.nombre ?? ""} → ${valor}`);
      hilo.retornarFuncion(valor);
      this.resuelto = true;
    }
  }

  toString() { return `return ${this.expr}`; }
}

// Crea una instancia de una clase y ejecuta su constructor con interleaving.
// Se usa como expresión: new MiClase(args) → devuelve la Instancia via resolverPuro().
// El Escritura o InicializarLocal que la envuelve hace la asignación.
export class NuevaInstancia extends Instruccion {
  constructor(nombreClase, argsExprs) {
    super();
    this.nombreClase = nombreClase; // string — lookup en hilo.clases en runtime
    this.argsExprs   = argsExprs;
    this.argIdx      = 0;
    this.enEjecucion = false;
    this._instancia  = null;
  }

  reiniciar() {
    super.reiniciar();
    this.argIdx      = 0;
    this.enEjecucion = false;
    this._instancia  = null;
    this.argsExprs.forEach(a => a.reiniciar());
  }

  resolver(hilo) {
    // Fase 1: evaluar argumentos del constructor de a uno
    while (this.argIdx < this.argsExprs.length) {
      const arg = this.argsExprs[this.argIdx];
      if (!arg.estaResuelto()) {
        arg.resolver(hilo);
        return;
      }
      this.argIdx++;
    }

    // Fase 2: crear la instancia y llamar al constructor (una sola vez)
    if (!this.enEjecucion) {
      this.enEjecucion = true;
      // Buscar la clase en la tabla del hilo (instrucciones frescas por hilo)
      const clase = hilo.clases[this.nombreClase];
      if (!clase) throw ErrorSimulador.runtime(`Clase desconocida: "${this.nombreClase}"`);
      this._instancia = clase.instanciar();
      const valoresArgs = this.argsExprs.map(a => a.resolverPuro());
      hilo.informar("New", `${this.nombreClase}(${valoresArgs.join(", ")})`);

      const ctor = clase.constructorDef;
      if (ctor && ctor.instrucciones.length > 0) {
        // Empujar frame del constructor — el scheduler puede interleave aquí
        hilo.llamarMetodo(
          "constructor", ctor.params, ctor.instrucciones,
          valoresArgs, this._instancia, this
        );
        return;
      }
      // Sin constructor: ya está lista
      this.resultado = this._instancia;
      this.resuelto  = true;
    }
    // Fase 3: el frame del constructor ya terminó (resolve() fue llamado)
  }

  // Llamado por hilos.js cuando el constructor retorna
  resolve(_valorRetorno) {
    // El valor de retorno del constructor se ignora (igual que en Java/Python)
    this.resultado = this._instancia;
    this.resuelto  = true;
  }

  resolverPuro() { return this.resultado; }
  toString() { return `new ${this.nombreClase}(...)`; }
}

// Llamada a método de instancia: obj.metodo(args)
// Igual a LlamadaFuncion pero activa la memoriaInstancia del objeto como tercer nivel.
export class LlamadaMetodo extends Instruccion {
  constructor(objetoExpr, nombreMetodo, argsExprs) {
    super();
    this.objetoExpr   = objetoExpr;
    this.nombreMetodo = nombreMetodo;
    this.argsExprs    = argsExprs;
    this.argIdx       = 0;
    this.enEjecucion  = false;
  }

  reiniciar() {
    super.reiniciar();
    this.objetoExpr.reiniciar();
    this.argIdx      = 0;
    this.enEjecucion = false;
    this.argsExprs.forEach(a => a.reiniciar());
  }

  resolver(hilo) {
    // Fase 1: evaluar el objeto receptor
    if (!this.objetoExpr.estaResuelto()) {
      this.objetoExpr.resolver(hilo);
      return;
    }

    // Fase 2: evaluar argumentos de a uno
    while (this.argIdx < this.argsExprs.length) {
      const arg = this.argsExprs[this.argIdx];
      if (!arg.estaResuelto()) {
        arg.resolver(hilo);
        return;
      }
      this.argIdx++;
    }

    // Fase 3: primer vez que todo está listo — dispatch según tipo del objeto
    if (!this.enEjecucion) {
      this.enEjecucion = true;
      const obj = this.objetoExpr.resolverPuro();
      const valoresArgs = this.argsExprs.map(a => a.resolverPuro());

      if (obj instanceof InstanciaMonitor) {
        // Método de monitor — lookup en la tabla de monitores del hilo
        const monitor = hilo.monitores[obj.nombreMonitor];
        if (!monitor || !monitor.tieneMetodo(this.nombreMetodo)) {
          throw ErrorSimulador.runtime(
            `El monitor "${obj.nombreMonitor}" no tiene el método "${this.nombreMetodo}"`
          );
        }
        const def = monitor.getMetodo(this.nombreMetodo);
        hilo.informar("LlamadaM", `${obj}.${this.nombreMetodo}(${valoresArgs.join(", ")})`);
        hilo.llamarMetodoMonitor(this.nombreMetodo, def.params, def.instrucciones, valoresArgs, obj, this);
        return;
      }

      if (obj instanceof Instancia) {
        // Lookup en la tabla de clases del hilo (instrucciones frescas por hilo)
        const clase = hilo.clases[obj.nombreClase];
        if (!clase || !clase.tieneMetodo(this.nombreMetodo)) {
          throw ErrorSimulador.runtime(
            `La clase "${obj.nombreClase}" no tiene el método "${this.nombreMetodo}"`
          );
        }
        const def = clase.getMetodo(this.nombreMetodo);
        hilo.informar("LlamadaM", `${obj}.${this.nombreMetodo}(${valoresArgs.join(", ")})`);
        hilo.llamarMetodo(this.nombreMetodo, def.params, def.instrucciones, valoresArgs, obj, this);
        return;
      }

      // Fallback: método built-in (ej: lista.length(), lista.sum(), etc.)
      const fn = AccesoMetodo.METODOS[this.nombreMetodo];
      if (!fn) throw ErrorSimulador.runtime(`Método desconocido: "${this.nombreMetodo}"`);
      this.resultado = fn(obj, ...valoresArgs);
      hilo.informar("Método", `${this.nombreMetodo}(${obj}) = ${this.resultado}`);
      this.resuelto = true;
      return;
    }

    // Fase 4: el frame de método de instancia ya terminó (resolve() fue llamado)
  }

  resolve(valorRetorno) {
    this.resultado = valorRetorno;
    this.resuelto  = true;
  }

  resolverPuro() { return this.resultado; }
  toString() { return `${this.objetoExpr}.${this.nombreMetodo}(...)`; }
}

// --- Semáforos ---

// Instrucción s.acquire(): bloquea el hilo si no hay permisos disponibles.
// Si el hilo queda bloqueado, esta instrucción NO se marca resuelta.
// Cuando el hilo sea despertado, despertar() llama resolverComoDesbloqueado()
// para marcarla resuelta y el hilo avanza normalmente.
export class Acquire extends Instruccion {
  constructor(semExpr) {
    super();
    this.semExpr = semExpr; // expresión que resuelve al objeto Semaphore
  }

  reiniciar() {
    super.reiniciar();
    this.semExpr.reiniciar();
  }

  resolver(hilo) {
    if (!this.semExpr.estaResuelto()) {
      this.semExpr.resolver(hilo);
      return;
    }
    const sem = this.semExpr.resolverPuro();
    const ok = sem.acquire(hilo, this);
    if (ok) this.resuelto = true;
  }

  // Llamado por Hilo.despertar() cuando el semáforo hace hand-off
  resolverComoDesbloqueado() {
    this.resuelto = true;
  }

  toString() { return `${this.semExpr}.acquire()`; }
}

// Instrucción s.release(): libera un permiso o hace hand-off a un thread bloqueado.
export class Release extends Instruccion {
  constructor(semExpr) {
    super();
    this.semExpr = semExpr;
  }

  reiniciar() {
    super.reiniciar();
    this.semExpr.reiniciar();
  }

  resolver(hilo) {
    if (!this.semExpr.estaResuelto()) {
      this.semExpr.resolver(hilo);
      return;
    }
    const sem = this.semExpr.resolverPuro();
    sem.release(hilo);
    this.resuelto = true;
  }

  toString() { return `${this.semExpr}.release()`; }
}

// ─── Monitor ──────────────────────────────────────────────────────────────────

// Intenta tomar el lock del monitor al entrar a un método.
// Si el lock está libre → lo toma y sigue. Si está ocupado → bloquea el thread.
// No se marca resuelta hasta que el thread efectivamente tiene el lock.
export class EntradaMonitor extends Instruccion {
  constructor(instanciaExpr) {
    super();
    this.instanciaExpr = instanciaExpr;
  }

  reiniciar() {
    super.reiniciar();
    this.instanciaExpr.reiniciar();
  }

  resolver(hilo) {
    if (!this.instanciaExpr.estaResuelto()) {
      this.instanciaExpr.resolver(hilo);
      return;
    }
    const inst = this.instanciaExpr.resolverPuro();
    if (!(inst instanceof InstanciaMonitor)) {
      throw ErrorSimulador.runtime(`Se esperaba un monitor`);
    }
    // intentarTomarLock devuelve true si tomó el lock, false si quedó bloqueado
    const ok = inst.intentarTomarLock(hilo, this);
    if (ok) this.resuelto = true;
    // Si no ok, el thread quedó bloqueado — esta instrucción NO se marca resuelta.
    // Cuando el monitor libere el lock y despierte este thread, llamará a resolverComoDesbloqueado()
  }

  resolverComoDesbloqueado() { this.resuelto = true; }
  toString() { return `[EntradaMonitor]`; }
}

// Libera el lock del monitor al salir del método.
export class SalidaMonitor extends Instruccion {
  constructor(instanciaMonitor) {
    super();
    this.instanciaMonitor = instanciaMonitor; // referencia directa a InstanciaMonitor
  }

  resolver(hilo) {
    this.instanciaMonitor.liberarLock(hilo);
    this.resuelto = true;
  }

  toString() { return `[SalidaMonitor]`; }
}

// wait() — suelta el lock y encola el thread en la variable de condición.
export class Wait extends Instruccion {
  constructor(condicionExpr) {
    super();
    this.condicionExpr = condicionExpr; // expresión que resuelve a VariableCondicion
  }

  reiniciar() {
    super.reiniciar();
    this.condicionExpr.reiniciar();
  }

  resolver(hilo) {
    if (!this.condicionExpr.estaResuelto()) {
      this.condicionExpr.resolver(hilo);
      return;
    }
    const vc            = this.condicionExpr.resolverPuro();
    const instMonitor   = hilo.getMonitorActivo();
    hilo.informar("Wait", `esperando en condición`);
    // Soltar el lock antes de encolar
    instMonitor.lock = null;
    // Despertar a un thread que esperaba el lock (si hay)
    if (instMonitor.colaLock.length > 0) {
      instMonitor.colaLock.sort(() => Math.random() - 0.5);
      const { hilo: sig, instruccion } = instMonitor.colaLock.shift();
      instMonitor.lock = sig;
      sig.despertarEnMonitor(instruccion);
      sig.informar("MonitorEntra", `${instMonitor.nombreMonitor} — lock tomado`);
    }
    // Encolar este thread en la variable de condición (queda bloqueado)
    vc.encolar(hilo, this);
    // NO marcar resuelta — el thread está bloqueado.
    // resolverComoDesbloqueado() se llama cuando notify() lo despierta.
  }

  resolverComoDesbloqueado() { this.resuelto = true; }
  toString() { return `wait()`; }
}

// notify() — despierta al primero de la cola de la variable de condición.
export class Notify extends Instruccion {
  constructor(condicionExpr) {
    super();
    this.condicionExpr = condicionExpr;
  }

  reiniciar() {
    super.reiniciar();
    this.condicionExpr.reiniciar();
  }

  resolver(hilo) {
    if (!this.condicionExpr.estaResuelto()) {
      this.condicionExpr.resolver(hilo);
      return;
    }
    const vc          = this.condicionExpr.resolverPuro();
    const instMonitor = hilo.getMonitorActivo();
    hilo.informar("Notify", `notificando condición`);
    vc.notificarUno(instMonitor);
    this.resuelto = true;
  }

  toString() { return `notify()`; }
}

// notifyAll() — despierta a todos los threads de la variable de condición.
export class NotifyAll extends Instruccion {
  constructor(condicionExpr) {
    super();
    this.condicionExpr = condicionExpr;
  }

  reiniciar() {
    super.reiniciar();
    this.condicionExpr.reiniciar();
  }

  resolver(hilo) {
    if (!this.condicionExpr.estaResuelto()) {
      this.condicionExpr.resolver(hilo);
      return;
    }
    const vc          = this.condicionExpr.resolverPuro();
    const instMonitor = hilo.getMonitorActivo();
    hilo.informar("NotifyAll", `notificando todos`);
    vc.notificarTodos(instMonitor);
    this.resuelto = true;
  }

  toString() { return `notifyAll()`; }
}

// Expresión que resuelve a una VariableCondicion del monitor activo.
// Para wait()/notify() implícitos usa la condición "_default".
// Para explícitos: condicion.wait() → LecturaCondicion("condicion")
export class LecturaCondicion extends Instruccion {
  constructor(nombre) {
    super();
    this.nombre = nombre; // "_default" o nombre explícito
  }

  resolver(hilo) {
    const inst = hilo.getMonitorActivo();
    if (!inst) throw ErrorSimulador.runtime(`wait/notify usado fuera de un monitor`);
    this.resultado = inst.getCondicion(this.nombre);
    this.resuelto  = true;
  }

  resolverPuro() { return this.resultado; }
  toString() { return this.nombre === "_default" ? `(condición)` : this.nombre; }
}

export class Maximo extends Instruccion {
  constructor(arregloExpr) {
    super();
    this.arregloExpr = arregloExpr;
  }

  reiniciar() {
    super.reiniciar();
    this.arregloExpr.reiniciar();
  }

  resolver(hilo) {
    if (!this.arregloExpr.estaResuelto()) {
      this.arregloExpr.resolver(hilo);
    } else {
      const arr = this.arregloExpr.resolverPuro();
      this.resultado = Math.max(...arr);
      hilo.informar("Maximo", `max([${arr}]) = ${this.resultado}`);
      this.resuelto = true;
    }
  }

  resolverPuro() { return this.resultado; }
  toString() { return `maximum(${this.arregloExpr})`; }
}
