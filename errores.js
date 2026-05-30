export class ErrorSimulador extends Error {
  constructor(tipo, mensaje, contexto = {}) {
    super(mensaje);
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
    return partes.join(" ");
  }
}
