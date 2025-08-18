import { ListaCircular } from "./listaCircular.js";

class Instruccion {
  constructor() {
    this.resuelto = false;
  }

  estaResuelto() {
    return this.resuelto;
  }

  esElse() {
    return false;
  }

  esFinDeBloque() {
    return false;
  }
  reiniciar() {
    this.resuelto = false;
  }

  esInstruccionConBloque() {
    return false;
  }

  // Obliga a las subclases a implementar toString()
  toString() {
    throw new Error(
      "Debes implementar toString() en la subclase de Instruccion"
    );
  }
}

export class DeclaracionVariableLocal extends Instruccion {
  constructor(string, funcionAMemoria) {
    super();
    this.escritura = string;
    this.funcion = funcionAMemoria;
  }

  resolver(hilo) {
    this.resuelto = true;
    hilo.resolverDeclaracionVariableLocal(this.escritura, this.funcion);
  }

  toString() {
    return `local ${this.escritura}`;
  }
}

export class Imprimir extends Instruccion {
  constructor(valor, lugarAEscribir) {
    super();
    this.valor = valor;
    this.escritura = lugarAEscribir;
  }

  resolver(hilo) {
    if (!this.valor.estaResuelto()) {
      this.valor.resolver(hilo);
    } else {
      this.resuelto = true;
      const valorAEscribir = this.valor.resolverPuro(hilo);
      this.escritura.innerHTML += `<p>${valorAEscribir}</p>`;
      hilo.resolverConImprimir(valorAEscribir);
    }
  }
  reiniciar() {
    super.reiniciar();
    this.valor.reiniciar();
  }

  resolverPuro(hilo) {}

  toString() {
    return `imprimir(${this.valor.toString()})`;
  }
}

export class Lectura extends Instruccion {
  constructor(valor) {
    super();
    this.valor = valor;
  }

  resolver(hilo) {
    this.resuelto = true;
    hilo.resolverLectura(this.valor);
  }

  resolverPuro(hilo) {
    return hilo.valorLocalDe(this.valor);
  }

  toString() {
    return `${this.valor}`;
  }
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
      this.resuelto = true;
      hilo.resolverEscritura(this.nombre, this.valor);
    }
  }

  toString() {
    return `${this.nombre} = ${this.valor.toString()}`;
  }
}

class OperacionBooleana extends Instruccion {
  constructor(valorIzquierdo, valorDerecho) {
    super();
    this.valorIzquierdo = valorIzquierdo;
    this.valorDerecho = valorDerecho;
  }

  reiniciar() {
    super.reiniciar();
    this.valorIzquierdo.reiniciar();
    this.valorDerecho.reiniciar();
  }

  resolver(hilo) {
    if (!this.valorIzquierdo.estaResuelto()) {
      this.valorIzquierdo.resolver(hilo);
    } else if (!this.valorDerecho.estaResuelto()) {
      this.valorDerecho.resolver(hilo);
    } else {
      this.resuelto = true;
      this.resolverSegunOperacion(hilo);
    }
  }

  resolverPuro(hilo) {
    return hilo.valorLocalDe("OP");
  }

  // No implementa toString, las subclases deben hacerlo
  toString() {
    throw new Error(
      "Debes implementar toString() en la subclase de OperacionBooleana"
    );
  }
}

export class YLogico extends OperacionBooleana {
  constructor(valorIzquierdo, valorDerecho) {
    super(valorIzquierdo, valorDerecho);
  }

  resolverSegunOperacion(hilo) {
    hilo.resolverYLogico(this.valorIzquierdo, this.valorDerecho);
  }

  toString() {
    return `(${this.valorIzquierdo.toString()} && ${this.valorDerecho.toString()})`;
  }
}

export class OLogico extends OperacionBooleana {
  constructor(valorIzquierdo, valorDerecho) {
    super(valorIzquierdo, valorDerecho);
  }

  resolverSegunOperacion(hilo) {
    hilo.resolverOLogico(this.valorIzquierdo, this.valorDerecho);
  }

  toString() {
    return `(${this.valorIzquierdo.toString()} || ${this.valorDerecho.toString()})`;
  }
}

export class Comparacion extends Instruccion {
  constructor(valorIzquierdo, valorDerecho) {
    super();
    this.valorIzquierdo = valorIzquierdo;
    this.valorDerecho = valorDerecho;
  }

  reiniciar() {
    super.reiniciar();
    this.valorIzquierdo.reiniciar();
    this.valorDerecho.reiniciar();
  }

  resolver(hilo) {
    if (!this.valorIzquierdo.estaResuelto()) {
      this.valorIzquierdo.resolver(hilo);
    } else if (!this.valorDerecho.estaResuelto()) {
      this.valorDerecho.resolver(hilo);
    } else {
      this.resuelto = true;
      this.resolverSegunComparacion(hilo);
    }
  }

  resolverPuro(hilo) {
    return hilo.valorLocalDe("OP");
  }

  // No implementa toString, las subclases deben hacerlo
  toString() {
    throw new Error(
      "Debes implementar toString() en la subclase de Comparacion"
    );
  }
}

export class MayorOIgual extends Comparacion {
  constructor(valorIzquierdo, valorDerecho) {
    super(valorIzquierdo, valorDerecho);
  }

  resolverSegunComparacion(hilo) {
    hilo.resolverMayorOIgualdad(this.valorIzquierdo, this.valorDerecho);
  }

  toString() {
    return `(${this.valorIzquierdo.toString()} >= ${this.valorDerecho.toString()})`;
  }
}

export class Menor extends Comparacion {
  constructor(valorIzquierdo, valorDerecho) {
    super(valorIzquierdo, valorDerecho);
  }

  resolverSegunComparacion(hilo) {
    hilo.resolverMenor(this.valorIzquierdo, this.valorDerecho);
  }

  toString() {
    return `(${this.valorIzquierdo.toString()} < ${this.valorDerecho.toString()})`;
  }
}

export class MenorOIgual extends Comparacion {
  constructor(valorIzquierdo, valorDerecho) {
    super(valorIzquierdo, valorDerecho);
  }

  resolverSegunComparacion(hilo) {
    hilo.resolverMenorOIgual(this.valorIzquierdo, this.valorDerecho);
  }

  toString() {
    return `(${this.valorIzquierdo.toString()} <= ${this.valorDerecho.toString()})`;
  }
}

export class Mayor extends Comparacion {
  constructor(valorIzquierdo, valorDerecho) {
    super();
    this.valorIzquierdo = valorIzquierdo;
    this.valorDerecho = valorDerecho;
  }

  resolverSegunComparacion(hilo) {
    hilo.resolverConMayor(this.valorIzquierdo, this.valorDerecho);
  }

  toString() {
    return `(${this.valorIzquierdo.toString()} > ${this.valorDerecho.toString()})`;
  }
}

export class Igualdad extends Comparacion {
  constructor(valorIzquierdo, valorDerecho) {
    super();
    this.valorIzquierdo = valorIzquierdo;
    this.valorDerecho = valorDerecho;
  }

  resolverSegunComparacion(hilo) {
    hilo.resolverConIgualdad(this.valorIzquierdo, this.valorDerecho);
  }

  toString() {
    return `(${this.valorIzquierdo.toString()} == ${this.valorDerecho.toString()})`;
  }
}

export class Condicional extends Instruccion {
  constructor(condicion) {
    super();
    this.condicion = condicion;
    this.valorDeVerdad;
  }

  reiniciar() {
    this.condicion.reiniciar();
  }

  resolver(hilo) {
    if (!this.condicion.estaResuelto()) {
      this.condicion.resolver(hilo);
    } else {
      this.resuelto = true;
      hilo.resolverCondicional(this.condicion);
    }
  }

  esInstruccionConBloque() {
    return true;
  }

  toString() {
    return `if (${this.condicion.toString()}) { ... }`;
  }
}

export class Ciclo extends Instruccion {
  constructor(condicion, bloque, maximo) {
    super();
    this.condicion = condicion;
    this.bloque = new ListaCircular(bloque);
    this.maximo = maximo;
    this.resolviendo = false;
  }

  terminado() {
    this.resuelto = true;
  }
  reiniciar() {
    super.reiniciar();
    this.maximo--;
    this.condicion.reiniciar();
    this.bloque.reiniciarTodos();
  }

  resolver(hilo) {
    if (this.maximo === 0) {
      this.resuelto = true;
      // informar de maximas vueltas se llego
      hilo.resolverMaximoCiclos();
      return;
    }

    const siguienteInstruccion = this.bloque.siguienteElemento();

    if (siguienteInstruccion.estaResuelto()) {
      this.bloque.pasarElemento();
      const proximaInstruccion = this.bloque.siguienteElemento();
      if (proximaInstruccion.estaResuelto()) {
        if (!this.condicion.estaResuelto()) {
          this.condicion.resolver(hilo);
        } else {
          hilo.resolverSeguirCiclo(this.condicion, this);
        }
      }
    } else {
      siguienteInstruccion.resolver(hilo);
    }
  }

  toString() {
    return `while (${this.condicion.toString()}) { ... }`;
  }
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
      this.resuelto = true;
      this.condicion.reiniciar();
      hilo.resolverWhile(this.condicion, this.max);
    }
  }

  toString() {
    return `while (${this.condicion.toString()}) { ... }`;
  }
}

export class Else extends Instruccion {
  constructor() {
    super();
  }

  resolver(hilo) {
    this.resuelto = true;
  }

  esElse() {
    return true;
  }

  esInstruccionConBloque() {
    return true;
  }

  toString() {
    return `else { ... }`;
  }
}

export class Sumar extends Instruccion {
  constructor(instruccion1, instruccion2) {
    super();
    this.instruccion1 = instruccion1;
    this.instruccion2 = instruccion2;
  }

  reiniciar() {
    super.reiniciar();
    this.instruccion1.reiniciar();
    this.instruccion2.reiniciar();
  }

  resolverPuro(hilo) {
    // Ahora suma recursivamente los operandos
    return hilo.valorLocalDe("OP");
  }

  resolver(hilo) {
    if (!this.instruccion1.estaResuelto()) {
      this.instruccion1.resolver(hilo);
    } else if (!this.instruccion2.estaResuelto()) {
      this.instruccion2.resolver(hilo);
    } else {
      this.resuelto = true;
      hilo.resolverConSuma(this.instruccion1, this.instruccion2);
    }
  }

  toString() {
    return `(${this.instruccion1.toString()} + ${this.instruccion2.toString()})`;
  }
}

export class ValorFijo extends Instruccion {
  constructor(valor) {
    super();

    this.valor = valor;
  }

  resolver(hilo) {
    this.resuelto = true;
    hilo.resolverSegunValorFijo(this.valor);
  }
  resolverPuro(hilo) {
    return hilo.valorFijoSegun(this.valor);
  }

  toString() {
    return `${this.valor}`;
  }
}

export class FinDeBloque extends Instruccion {
  constructor() {
    super();
  }
  resolver(hilo) {
    this.resuelto = true;
    hilo.resolverFinDeBloque();
  }

  resolverPuro(hilo) {}

  esFinDeBloque() {
    return true;
  }

  toString() {
    return `}`;
  }
}
