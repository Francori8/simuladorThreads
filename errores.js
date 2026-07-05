export class ErrorSimulador extends Error {
  constructor(tipo, mensaje, contexto = {}) {
    super(mensaje);
    this.esSimulador = true;
    this.tipo     = tipo;    // "parse" | "runtime"
    this.contexto = contexto; // { linea?, threadId?, instruccion? }
  }

  static parse(mensaje, linea = null) {
    return new ErrorSimulador("parse", mensaje, { linea });
  }

  static runtime(mensaje, threadId = null, instruccion = null) {
    return new ErrorSimulador("runtime", mensaje, { threadId, instruccion });
  }

  formatear() {
    const { linea, threadId, instruccion } = this.contexto;
    const partes = [];
    if (this.tipo === "parse") {
      partes.push(`Error de sintaxis`);
      if (linea != null) partes.push(`en línea ${linea}`);
    } else {
      partes.push(`Error de ejecución`);
      if (threadId != null) partes.push(`en TH:${threadId}`);
      if (instruccion)      partes.push(`→ ${instruccion}`);
    }
    partes.push(`\n${this.message}`);
    const sugerencia = sugerirCausa(this.message);
    if (sugerencia) partes.push(`\n💡 ${sugerencia}`);
    return partes.join(" ");
  }
}

function sugerirCausa(mensaje) {
  if (/no está declarada/.test(mensaje)) {
    return `¿Olvidaste declararla con "global" o "local" antes de usarla?`;
  }
  if (/^Deadlock/.test(mensaje)) {
    return `Revisá el orden en que los threads piden los mismos recursos (semáforos, monitores) — si dos threads los piden en orden distinto, cada uno puede quedar esperando al otro.`;
  }
  if (/no es una lista/.test(mensaje)) {
    return `Declarála con el tipo "List" para poder indexarla con [i].`;
  }
  if (/fuera de rango/.test(mensaje)) {
    return `El índice tiene que estar entre 0 y (tamaño - 1) de la lista.`;
  }
  if (/Método desconocido/.test(mensaje)) {
    return `Revisá que el método esté definido dentro de la clase o monitor, y que el nombre esté bien escrito.`;
  }
  if (/wait\/notify usado fuera de un monitor/.test(mensaje)) {
    return `"wait" y "notify" solo se pueden usar dentro de métodos de un monitor.`;
  }
  if (/Se esperaba/.test(mensaje)) {
    return `Revisá que no falte un paréntesis, llave o punto y coma cerca de esa línea.`;
  }
  return null;
}
