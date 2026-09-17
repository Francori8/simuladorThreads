import Memoria from "./memoria.js";
import EstadoGlobal from "./estadoGlobal.js";
import { parsear } from "./parser.js";

// Explorador: corre el mismo motor de ejecución que Simulador/pasoapaso, pero
// en vez de dejar que el scheduler elija al azar, fuerza una secuencia de
// elecciones (threadIdForzado) predeterminada. Es la base para el DFS de
// exploración exhaustiva: cada rama del árbol se corre re-parseando el
// código desde cero y forzando el prefijo de elecciones que lleva a esa rama.
//
// Ver README.md, sección "Model checking — modo 'Verificar'" para el porqué
// de este enfoque (re-ejecución en vez de clonado de estado).
export default class Explorador {
  constructor(codigo, limiteRepeticiones = 10) {
    this.codigo = codigo;
    this.limiteRepeticiones = limiteRepeticiones;
  }

  // Corre una única ejecución forzando, en cada punto de decisión, el id de
  // thread indicado por `secuencia` (en orden). Si la secuencia se agota antes
  // de que termine el programa, sigue tomando el primer thread preparado
  // (determinista, mismo orden que el parseo) — salvo que `detenerEnBifurcacion`
  // esté activo, en cuyo caso corta ahí mismo apenas encuentra más de un
  // thread preparado sin secuencia forzada que lo resuelva (ver `explorar`).
  //
  // Devuelve:
  //   - valoresFinales: resultado de mem.mostrarMemoria() al terminar (o al cortar)
  //   - deadlock: mensaje de error si la ejecución terminó en deadlock, si no null
  //   - bifurcacion: { indice, idsPreparados } del primer punto de decisión no
  //     resuelto por `secuencia` (null si la secuencia alcanzó para llegar al final)
  ejecutarSecuencia(secuencia = [], { detenerEnBifurcacion = false } = {}) {
    const mem = new Memoria();
    const consolaVirtual = { lines: [], log(msg) { this.lines.push(msg); } };
    const threads = parsear(this.codigo, mem, consolaVirtual, this.limiteRepeticiones);
    const estadoGlobal = new EstadoGlobal(threads);
    estadoGlobal.setModoManual(true); // no sortear: siempre se fuerza o se toma el primero preparado

    const generador = estadoGlobal.resolverGen();
    let indice = 0;
    let deadlock = null;
    let bifurcacion = null;

    try {
      let result = generador.next();
      while (!result.done) {
        if (indice < secuencia.length) {
          estadoGlobal.threadIdForzado = secuencia[indice];
          indice++;
        } else if (detenerEnBifurcacion) {
          const preparados = estadoGlobal.threadPreparados();
          if (preparados.length > 1) {
            bifurcacion = { indice, idsPreparados: preparados.map(th => th.id) };
            break;
          }
        }
        result = generador.next();
      }
    } catch (e) {
      if (e?.esSimulador && /Deadlock/.test(e.message)) {
        deadlock = e.message;
      } else {
        throw e;
      }
    }

    return {
      valoresFinales: mem.mostrarMemoria(),
      deadlock,
      bifurcacion,
      estadoGlobal,
      mem,
    };
  }

  // Re-parsea el código y avanza el generador forzando `secuencia`. Devuelve
  // { generador, estadoGlobal, result } en el punto exacto donde se agotó la
  // secuencia — listo para sondear candidatos desde ahí.
  #avanzarHasta(secuencia) {
    const mem = new Memoria();
    const consolaVirtual = { lines: [], log(msg) { this.lines.push(msg); } };
    const threads = parsear(this.codigo, mem, consolaVirtual, this.limiteRepeticiones);
    const estadoGlobal = new EstadoGlobal(threads);
    estadoGlobal.setModoManual(true);

    const generador = estadoGlobal.resolverGen();
    let result = generador.next();
    for (const id of secuencia) {
      if (result.done) break;
      estadoGlobal.threadIdForzado = id;
      result = generador.next();
    }
    return { generador, estadoGlobal, result };
  }

  // Sobre un generador/estadoGlobal YA avanzado hasta el punto de
  // bifurcación (ver #avanzarHasta), deja correr SOLO a `idForzado`, paso a
  // paso, hasta que se bloquee o termine su bloque. Ningún otro thread
  // interviene en el medio. Acumula TODOS los recursos tocados en el tramo,
  // no solo el primero (ver nota de por qué en #candidatosRelevantes).
  //
  // Importante: esto AVANZA el estado real de `idForzado` (y de los
  // recursos que toca, ej. puede tomar un semáforo de verdad). Por diseño
  // no se revierte — cada candidato de una bifurcación se sondea en
  // secuencia sobre el mismo estadoGlobal/generador (ver #candidatosRelevantes),
  // así que sus objetos Semaphore/Canal/Monitor son literalmente los mismos
  // y la comparación de independencia por identidad de referencia funciona.
  // El resultado final del camino elegido se vuelve a calcular aparte, desde
  // cero, en explorarDesde — este sondeo es solo para decidir qué ramas vale
  // la pena explorar, nunca se usa su resultado numérico.
  #sondearFootprint(generador, estadoGlobal, resultActual, idForzado) {
    let result = resultActual;
    const recursos = [];
    while (!result.done) {
      const thread = estadoGlobal.threads.find(th => th.id === idForzado);
      if (!thread || !thread.estaPreparado()) {
        return { recursos, termino: true, result };
      }
      estadoGlobal.threadIdForzado = idForzado;
      result = generador.next();

      recursos.push(...thread.dependencias.delUltimoPaso());
      if (thread.estaBloqueado()) {
        return { recursos, termino: false, result };
      }
      // Paso sin recursos y sin bloqueo (instrucción local) — seguir.
    }
    return { recursos, termino: true, result };
  }

  // Fisher-Yates — no muta el array de entrada.
  static #barajar(arr) {
    const copia = [...arr];
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  }

  // ¿Dos conjuntos de recursos comparten algún elemento? Comparación por
  // referencia para recursos "obj" (identidad del Semaphore/Canal/Monitor) y
  // por valor para "var" (nombre de variable global, ya incluye el índice
  // para arrays: "tenedor[2]").
  static #comparteRecurso(recursosA, recursosB) {
    for (const a of recursosA) {
      for (const b of recursosB) {
        if (a.tipo !== b.tipo) continue;
        if (a.tipo === "obj" ? a.ref === b.ref : a.ref === b.ref) return true;
      }
    }
    return false;
  }

  // Poda por sleep-set (reducción de orden parcial, ver README): en una
  // bifurcación con candidatos [c0, c1, ..., cn], se explora siempre c0
  // (ample set mínimo). Un candidato ci (i > 0) NO hace falta explorarlo
  // como "primera elección" en este punto si es independiente de c0 —es
  // decir, el paso que ci daría y el paso que c0 va a dar no comparten
  // ningún recurso compartido (variable global u objeto de sincronización).
  // En ese caso, ejecutar c0 primero y ci después da el mismo estado que
  // ejecutar ci primero y c0 después (son conmutables), así que postergar
  // ci a cuando le toque el turno más adelante no pierde ningún estado.
  //
  // Si ci comparte recurso con c0 (dependientes — ej. ambos compiten por el
  // mismo semáforo, o uno escribe una variable que el otro lee), sí hace
  // falta explorar ambos órdenes por separado.
  //
  // Usa `hilo.dependencias` (instrumentado en hilos.js/semaforo.js/canal.js/
  // monitor.js) en vez de metadata estática por instrucción — no se tocan
  // las ~55 clases de instrucciones.js.
  //
  // Devuelve la sublista de idsPreparados que sí representan una elección
  // real a explorar como rama separada. Siempre incluye idsPreparados[0].
  #candidatosRelevantes(secuencia, idsPreparados) {
    // Un único parseo/generador compartido para sondear TODOS los
    // candidatos de esta bifurcación: si cada uno se sondeara en su propio
    // parseo, sus objetos Semaphore/Canal/Monitor serían instancias
    // distintas aunque representen "la misma" variable global, y la
    // comparación por identidad de referencia nunca coincidiría.
    const { generador, estadoGlobal, result } = this.#avanzarHasta(secuencia);

    const [primero, ...resto] = idsPreparados;
    let ultimoResult = result;
    const sondeoPrimero = this.#sondearFootprint(generador, estadoGlobal, ultimoResult, primero);
    ultimoResult = sondeoPrimero.result;

    const relevantes = [primero];
    for (const id of resto) {
      const sondeoId = this.#sondearFootprint(generador, estadoGlobal, ultimoResult, id);
      ultimoResult = sondeoId.result;
      // Dos candidatos que terminan su bloque entero sin tocar nada
      // compartido son independientes de cualquier cosa — no hace falta
      // explorarlos como "primero" acá.
      const ambosSinTocarNada = sondeoPrimero.recursos.length === 0 && sondeoId.recursos.length === 0
        && sondeoPrimero.termino && sondeoId.termino;
      const esDependiente = !ambosSinTocarNada
        && Explorador.#comparteRecurso(sondeoPrimero.recursos, sondeoId.recursos);
      if (esDependiente) relevantes.push(id);
    }
    return relevantes;
  }

  // DFS exhaustivo: explora todos los entrelazados posibles.
  //
  // En cada punto donde hay más de un thread preparado (bifurcación real —
  // hay más de una elección posible), recursa una vez por cada thread
  // preparado, extendiendo la secuencia forzada. Si solo hay un preparado no
  // bifurca: no hay elección real, seguir derecho no infla el árbol.
  //
  // `maxCaminos`: tope de caminos completos (terminados o en deadlock) a
  // explorar antes de cortar. `maxProfundidad`: tope de elecciones forzadas
  // por rama, para no colgarse en programas con loops largos. Al cortar por
  // cualquiera de los dos límites, `truncado` queda en true — el resultado
  // deja de ser una garantía exhaustiva y hay que comunicarlo así en la UI.
  //
  // `onProgreso(caminosExplorados, maxCaminos)`: callback opcional, llamado
  // como mucho cada ~200ms (no por cada camino, para no saturar) — pensado
  // para que la UI muestre progreso en exploraciones largas en vez de un
  // spinner ciego sin información de cuánto falta.
  //
  // Devuelve { caminosExplorados, truncado, deadlocks, valoresPorVariable } donde:
  //   - deadlocks: lista de secuencias que llevaron a deadlock
  //   - valoresPorVariable: { nombreVar: Map<valorString, cantidadDeCaminos> }
  explorar({ maxCaminos = 100000, maxProfundidad = 500, onProgreso = null } = {}) {
    const resultado = {
      caminosExplorados: 0,
      truncado: false,
      deadlocks: [],
      valoresPorVariable: {},
    };
    let ultimoAviso = Date.now();

    const avisarProgreso = () => {
      if (!onProgreso) return;
      const ahora = Date.now();
      if (ahora - ultimoAviso < 200) return;
      ultimoAviso = ahora;
      onProgreso(resultado.caminosExplorados, maxCaminos);
    };

    const explorarDesde = (secuencia) => {
      if (resultado.caminosExplorados >= maxCaminos) {
        resultado.truncado = true;
        return;
      }
      if (secuencia.length >= maxProfundidad) {
        resultado.truncado = true;
        resultado.caminosExplorados++;
        avisarProgreso();
        return;
      }

      const r = this.ejecutarSecuencia(secuencia, { detenerEnBifurcacion: true });

      if (r.bifurcacion) {
        // Orden aleatorio de los preparados antes de decidir el ample-set:
        // un DFS que siempre recorre "el primer candidato" en el mismo orden
        // determinista puede tardar exponencialmente más en alcanzar un
        // camino específico que esté "lejos" en ese orden fijo (medido: en
        // Filósofos, el subárbol de "TH0 siempre gana cada micro-decisión"
        // agota el límite completo sin llegar nunca a intercalados donde
        // otro thread se adelanta). Aleatorizar no cambia la corrección
        // (sigue siendo exhaustivo si no hay límite) pero da mucha mejor
        // cobertura del espacio dentro de maxCaminos.
        const idsBarajados = Explorador.#barajar(r.bifurcacion.idsPreparados);
        const candidatos = this.#candidatosRelevantes(secuencia, idsBarajados);
        for (const id of candidatos) {
          explorarDesde([...secuencia, id]);
          if (resultado.caminosExplorados >= maxCaminos) {
            resultado.truncado = true;
            return;
          }
        }
        return;
      }

      // Camino completo (terminó o dio deadlock) — registrar resultado.
      resultado.caminosExplorados++;
      avisarProgreso();
      if (r.deadlock) {
        resultado.deadlocks.push({ secuencia, mensaje: r.deadlock });
        return;
      }
      for (const linea of r.valoresFinales) {
        const separador = linea.indexOf(": ");
        const nombre = linea.slice(0, separador);
        const valor = linea.slice(separador + 2);
        if (!resultado.valoresPorVariable[nombre]) resultado.valoresPorVariable[nombre] = new Map();
        const mapa = resultado.valoresPorVariable[nombre];
        mapa.set(valor, (mapa.get(valor) ?? 0) + 1);
      }
    };

    explorarDesde([]);
    return resultado;
  }
}
