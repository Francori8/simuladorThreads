/**
 * Canal de comunicación entre procesos/threads.
 * - send(valor)    → no bloqueante: encola el valor o hace hand-off si hay receiver esperando
 * - receive(hilo)  → bloqueante: consume del buffer o bloquea el thread hasta que haya dato
 */
export class Canal {
  constructor() {
    this.buffer    = []; // FIFO de valores
    this.esperando = []; // FIFO de { hilo, instruccion } bloqueados en receive
  }

  send(valor, hilo) {
    if (this.esperando.length > 0) {
      // Hand-off directo: hay alguien esperando, no pasar por el buffer
      const { hilo: receptor, instruccion } = this.esperando.shift();
      hilo.informar("CanalSend", `→ TH ${receptor.id} (hand-off)`);
      receptor.despertarDelCanal(instruccion, valor);
    } else {
      this.buffer.push(valor);
      hilo.informar("CanalSend", `encolado (buffer: ${this.buffer.length})`);
    }
  }

  // Retorna el valor si hay dato disponible inmediatamente.
  // Si no, bloquea el hilo y retorna null.
  receive(hilo, instruccion) {
    if (this.buffer.length > 0) {
      const valor = this.buffer.shift();
      hilo.informar("CanalReceive", `recibido: ${valor}`);
      return { valor, ok: true };
    }
    // Sin dato: bloquear
    this.esperando.push({ hilo, instruccion });
    hilo.bloquearEnCanal(instruccion);
    return null;
  }

  toString() { return `Channel`; }
}

/**
 * Objeto de datos dinámico — agrupa campos arbitrarios.
 * Uso: r = new Request(), r.campo = valor, print(r.campo)
 */
export class Request {
  constructor() {
    this._campos = {};
  }

  setCampo(nombre, valor) {
    this._campos[nombre] = valor;
  }

  getCampo(nombre) {
    if (!(nombre in this._campos)) {
      throw new Error(`El Request no tiene el campo "${nombre}"`);
    }
    return this._campos[nombre];
  }

  toString() {
    const campos = Object.entries(this._campos).map(([k, v]) => `${k}: ${v}`).join(", ");
    return `Request { ${campos} }`;
  }
}
