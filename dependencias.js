// Registro de recursos compartidos tocados por un hilo en el paso en curso.
// No participa de la ejecución del pseudocódigo — es un observador que Hilo
// hospeda para que el Explorador (ver README, "Model checking") pueda decidir
// qué elecciones de scheduler son independientes entre sí (sleep-sets /
// partial-order reduction) sin tener que comparar snapshots de memoria.
//
// Un recurso es identificable de dos formas:
//   - "var": una variable global por nombre (o `nombre[indice]` para arrays)
//   - "obj": un objeto de sincronización (Semaphore, Canal, Monitor) por
//     identidad de referencia — así dos posiciones de un array de semáforos
//     (ej. tenedor[0] y tenedor[1]) quedan como recursos distintos sin
//     necesidad de resolver el índice desde afuera.
export default class RegistroDependencias {
  constructor() {
    this._recursosPaso = [];
  }

  registrar(tipo, ref) {
    this._recursosPaso.push({ tipo, ref });
  }

  delUltimoPaso() {
    return this._recursosPaso;
  }

  reiniciarPaso() {
    this._recursosPaso = [];
  }
}
