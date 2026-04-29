import { ListaCircular } from "./listaCircular.js";

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
  }

  terminado() { this.resuelto = true; }

  reiniciar() {
    super.reiniciar();
    this.maximo--;
    this.condicion.reiniciar();
    this.bloque.reiniciarTodos();
  }

  resolver(hilo) {
    if (this.maximo === 0) {
      this.resuelto = true;
      hilo.resolverMaximoCiclos();
      return;
    }

    const siguiente = this.bloque.siguienteElemento();

    if (siguiente.estaResuelto()) {
      this.bloque.pasarElemento();
      const proxima = this.bloque.siguienteElemento();
      if (proxima.estaResuelto()) {
        if (!this.condicion.estaResuelto()) {
          hilo.pushContexto(this.condicion);
          this.condicion.resolver(hilo);
          hilo.popContexto();
        } else {
          hilo.resolverSeguirCiclo(this.condicion.resolverPuro(), this);
        }
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

  toString() { return `repeat(${this.cantidadExpr.toString()}) { ... }`; }
}
