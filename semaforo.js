export class Semaphore {
  constructor(permisos, fuerte = false) {
    this.contador  = permisos;
    this.fuerte    = fuerte;
    this.esperando = fuerte ? [] : new Set();
  }

  // Intenta adquirir un permiso. Retorna true si ok, false si el hilo queda bloqueado.
  acquire(hilo, instruccionAcquire) {
    if (this.contador > 0) {
      this.contador--;
      hilo.informar("Semáforo", `acquire → permisos restantes: ${this.contador}`);
      return true;
    }
    // Sin permisos: bloquear el hilo y agregarlo a la estructura de espera
    if (this.fuerte) {
      this.esperando.push(hilo);
    } else {
      this.esperando.add(hilo);
    }
    hilo.bloquear(instruccionAcquire);
    return false;
  }

  // Libera un permiso. Si hay threads esperando, hand-off directo.
  release(hiloLlamador) {
    const cantEsperando = this.fuerte ? this.esperando.length : this.esperando.size;
    if (cantEsperando > 0) {
      // Hand-off: el permiso va directo al siguiente thread sin incrementar el contador
      let siguiente;
      if (this.fuerte) {
        siguiente = this.esperando.shift();
      } else {
        siguiente = this.esperando.values().next().value;
        this.esperando.delete(siguiente);
      }
      hiloLlamador.informar("Semáforo", `release → hand-off a TH:${siguiente.id}`);
      siguiente.despertar();
    } else {
      this.contador++;
      hiloLlamador.informar("Semáforo", `release → permisos disponibles: ${this.contador}`);
    }
  }

  toString() { return `Semaphore(${this.contador})`; }
}
