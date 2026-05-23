import Memoria from "./memoria.js";
import Hilo from "./hilos.js";
import {
  Sumar,
  Restar,
  Multiplicar,
  Dividir,
  Imprimir,
  ValorFijo,
  Escritura,
  Lectura,
  Igualdad,
  Desigualdad,
  FinDeBloque,
  Condicional,
  Else,
  DeclaracionVariableLocal,
  InicializarLocal,
  While,
  Mayor,
  MayorOIgual,
  Menor,
  MenorOIgual,
  YLogico,
  OLogico,
  Repeat,
  For,
  ForEach,
  LecturaIndexada,
  EscrituraIndexada,
  Maximo,
  Negacion,
  GetId,
} from "./instrucciones.js";

export function parsear(textoRaw, mem, consola, limiteRepeticiones) {
  const lineas = textoRaw
    .trim()
    .replaceAll(" ", "")
    .replaceAll("\t", "")
    .split("\n")
    .filter((s) => s !== "");

  const globales = lineas.filter((s) => s.startsWith("global"));
  establecerMemoria(globales, mem);

  const bloques = separarCadaThread(lineas);
  return crearThreads(bloques, mem, consola, limiteRepeticiones);
}

export function manejarMemoria(string, mem) {
  if (string.startsWith("Int")) {
    const vari = string.substring(3).replace(";", "").split("=");
    mem.agregarVariable(vari[0], parseInt(vari[1]));
  }
  if (string.startsWith("String")) {
    const vari = string.substring(6).replace(";", "").split("=");
    mem.agregarVariable(vari[0], vari[1]);
  }
  if (string.startsWith("Bool")) {
    const vari = string.substring(4).replace(";", "").split("=");
    mem.agregarVariable(vari[0], true && eval(vari[1]));
  }
  if (string.startsWith("List")) {
    const vari = string.substring(4).replace(";", "").split("=");
    mem.agregarVariable(vari[0], eval(vari[1]));
  }
}

function establecerMemoria(lineasGlobal, mem) {
  lineasGlobal.forEach((s) => manejarMemoria(s.substring(6), mem));
}

function separarCadaThread(lineas) {
  const sinGlobales = lineas.filter((s) => !s.startsWith("global"));
  const bloques = [];
  sinGlobales.forEach((s) => {
    if (s.startsWith("Thread")) {
      bloques.push([s]);
    } else {
      bloques[bloques.length - 1].push(s);
    }
  });
  return bloques;
}

function crearThreads(bloques, mem, consola, limiteRepeticiones) {
  let idThread = 0;
  const bloquesExpandidos = [];
  bloques.forEach((bloque) => {
    const num = parseInt(
      bloque[0].substring(6).replace("(", "").replace(")", "")
    );
    for (let i = 0; i < num; i++) bloquesExpandidos.push(bloque);
  });
  return bloquesExpandidos.map(
    (bloque) =>
      new Hilo(
        idThread++,
        new Memoria(),
        mem,
        crearInstrucciones(bloque.toSpliced(0, 1), mem, consola, limiteRepeticiones)
      )
  );
}

function crearInstrucciones(lineas, mem, consola, limiteRepeticiones) {
  return lineas.map((s) => instruccionSegunString(s, mem, consola, limiteRepeticiones));
}

function instruccionSegunString(string, mem, consola, limiteRepeticiones) {
  if (string.startsWith("local")) {
    const rest = string.substring(5);
    const eqIdx = rest.indexOf("=");
    if (eqIdx !== -1) {
      let typeAndName = rest.substring(0, eqIdx);
      let varName;
      if (typeAndName.startsWith("Int")) varName = typeAndName.substring(3);
      else if (typeAndName.startsWith("Bool")) varName = typeAndName.substring(4);
      else if (typeAndName.startsWith("String")) varName = typeAndName.substring(6);
      else if (typeAndName.startsWith("List")) varName = typeAndName.substring(4);
      else varName = typeAndName;
      varName = varName.replace(";", "");
      const valueStr = rest.substring(eqIdx + 1);
      return new InicializarLocal(varName, instruccionSegunString(valueStr, mem, consola, limiteRepeticiones));
    }
    return new DeclaracionVariableLocal(rest, manejarMemoria);
  }
  if (string.startsWith("print")) {
    const argumento = extraerContenidoParentesis(string.substring(5));
    return new Imprimir(instruccionSegunString(argumento, mem, consola, limiteRepeticiones), consola);
  }
  if (string.startsWith("while")) {
    const condicion = extraerContenidoParentesis(string.substring(5));
    return new While(
      instruccionSegunString(condicion, mem, consola, limiteRepeticiones),
      limiteRepeticiones
    );
  }
  if (string.startsWith("repeat")) {
    const argumento = extraerContenidoParentesis(string.substring(6));
    return new Repeat(instruccionSegunString(argumento, mem, consola, limiteRepeticiones), limiteRepeticiones);
  }
  if (string.startsWith("for")) {
    const inner = string.substring(3);
    let depth = 0, closeIdx = -1;
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === "(") depth++;
      else if (inner[i] === ")") { depth--; if (depth === 0) { closeIdx = i; break; } }
    }
    const args = inner.substring(1, closeIdx);
    if (args.includes(";")) {
      const idx1 = args.indexOf(";");
      const idx2 = args.indexOf(";", idx1 + 1);
      const initStr = args.substring(0, idx1);
      const condStr = args.substring(idx1 + 1, idx2);
      const incrStr = args.substring(idx2 + 1);
      return new For(
        instruccionSegunString(initStr, mem, consola, limiteRepeticiones),
        instruccionSegunString(condStr, mem, consola, limiteRepeticiones),
        instruccionSegunString(incrStr, mem, consola, limiteRepeticiones),
        limiteRepeticiones
      );
    } else {
      const colonIdx = args.indexOf(":");
      const nombreVar = args.substring(0, colonIdx);
      const listaStr = args.substring(colonIdx + 1);
      return new ForEach(
        nombreVar,
        instruccionSegunString(listaStr, mem, consola, limiteRepeticiones),
        limiteRepeticiones
      );
    }
  }
  if (string.startsWith("if")) {
    const condicion = extraerContenidoParentesis(string.substring(2));
    return new Condicional(instruccionSegunString(condicion, mem, consola, limiteRepeticiones));
  }
  if (string.includes("else")) {
    return new Else();
  }

  if (string.startsWith("maximum")) {
    const inner = extraerContenidoParentesis(string.substring(7));
    return new Maximo(instruccionSegunString(inner, mem, consola, limiteRepeticiones));
  }
  if (string.startsWith("getId")) {
    return new GetId();
  }

  if (estaEnvueltoEnParentesis(string)) {
    return instruccionSegunString(string.substring(1, string.length - 1), mem, consola, limiteRepeticiones);
  }

  if (string.startsWith("!")) {
    return new Negacion(instruccionSegunString(string.substring(1), mem, consola, limiteRepeticiones));
  }

  if (esEscrituraIndexada(string)) {
    const bracketIdx = string.indexOf("[");
    const nombre = string.substring(0, bracketIdx);
    let depth = 0, closeIdx = -1;
    for (let i = bracketIdx; i < string.length; i++) {
      if (string[i] === "[") depth++;
      else if (string[i] === "]") { depth--; if (depth === 0) { closeIdx = i; break; } }
    }
    const indiceStr = string.substring(bracketIdx + 1, closeIdx);
    const valorStr = string.substring(closeIdx + 2);
    return new EscrituraIndexada(
      nombre,
      instruccionSegunString(indiceStr, mem, consola, limiteRepeticiones),
      instruccionSegunString(valorStr, mem, consola, limiteRepeticiones)
    );
  }

  if (tieneEscritura(string)) {
    const partes = string.split("=");
    const nombre = partes.shift();
    return new Escritura(nombre, instruccionSegunString(partes.join("="), mem, consola, limiteRepeticiones));
  }

  let idx;
  idx = encontrarPrimerOperadorFuera(string, "&&");
  if (idx !== -1) {
    return new YLogico(
      instruccionSegunString(string.substring(0, idx), mem, consola, limiteRepeticiones),
      instruccionSegunString(string.substring(idx + 2), mem, consola, limiteRepeticiones)
    );
  }
  idx = encontrarPrimerOperadorFuera(string, "||");
  if (idx !== -1) {
    return new OLogico(
      instruccionSegunString(string.substring(0, idx), mem, consola, limiteRepeticiones),
      instruccionSegunString(string.substring(idx + 2), mem, consola, limiteRepeticiones)
    );
  }
  idx = encontrarPrimerOperadorFuera(string, ">=");
  if (idx !== -1) {
    return new MayorOIgual(
      instruccionSegunString(string.substring(0, idx), mem, consola, limiteRepeticiones),
      instruccionSegunString(string.substring(idx + 2), mem, consola, limiteRepeticiones)
    );
  }
  idx = encontrarPrimerOperadorFuera(string, "<=");
  if (idx !== -1) {
    return new MenorOIgual(
      instruccionSegunString(string.substring(0, idx), mem, consola, limiteRepeticiones),
      instruccionSegunString(string.substring(idx + 2), mem, consola, limiteRepeticiones)
    );
  }
  idx = encontrarPrimerOperadorFuera(string, "!=");
  if (idx !== -1) {
    return new Desigualdad(
      instruccionSegunString(string.substring(0, idx), mem, consola, limiteRepeticiones),
      instruccionSegunString(string.substring(idx + 2), mem, consola, limiteRepeticiones)
    );
  }
  idx = encontrarPrimerOperadorFuera(string, "==");
  if (idx !== -1) {
    return new Igualdad(
      instruccionSegunString(string.substring(0, idx), mem, consola, limiteRepeticiones),
      instruccionSegunString(string.substring(idx + 2), mem, consola, limiteRepeticiones)
    );
  }
  idx = encontrarPrimerOperadorFuera(string, ">");
  if (idx !== -1) {
    return new Mayor(
      instruccionSegunString(string.substring(0, idx), mem, consola, limiteRepeticiones),
      instruccionSegunString(string.substring(idx + 1), mem, consola, limiteRepeticiones)
    );
  }
  idx = encontrarPrimerOperadorFuera(string, "<");
  if (idx !== -1) {
    return new Menor(
      instruccionSegunString(string.substring(0, idx), mem, consola, limiteRepeticiones),
      instruccionSegunString(string.substring(idx + 1), mem, consola, limiteRepeticiones)
    );
  }

  const opAditiva = encontrarUltimoOperadorFuera(string, ["+", "-"]);
  if (opAditiva.indice > 0) {
    const izq = string.substring(0, opAditiva.indice);
    const der = string.substring(opAditiva.indice + 1);
    if (opAditiva.op === "+")
      return new Sumar(instruccionSegunString(izq, mem, consola, limiteRepeticiones), instruccionSegunString(der, mem, consola, limiteRepeticiones));
    if (opAditiva.op === "-")
      return new Restar(instruccionSegunString(izq, mem, consola, limiteRepeticiones), instruccionSegunString(der, mem, consola, limiteRepeticiones));
  }

  const opMultiplicativa = encontrarUltimoOperadorFuera(string, ["*", "/"]);
  if (opMultiplicativa.indice !== -1) {
    const izq = string.substring(0, opMultiplicativa.indice);
    const der = string.substring(opMultiplicativa.indice + 1);
    if (opMultiplicativa.op === "*")
      return new Multiplicar(instruccionSegunString(izq, mem, consola, limiteRepeticiones), instruccionSegunString(der, mem, consola, limiteRepeticiones));
    if (opMultiplicativa.op === "/")
      return new Dividir(instruccionSegunString(izq, mem, consola, limiteRepeticiones), instruccionSegunString(der, mem, consola, limiteRepeticiones));
  }

  if (string.includes("[") && string.endsWith("]") && string.indexOf("[") > 0) {
    const bracketIdx = string.indexOf("[");
    const nombre = string.substring(0, bracketIdx);
    const indiceStr = string.substring(bracketIdx + 1, string.length - 1);
    return new LecturaIndexada(
      nombre,
      instruccionSegunString(indiceStr, mem, consola, limiteRepeticiones)
    );
  }
  if (mem.hayVariable(string)) return new Lectura(string);
  if (string === "}") return new FinDeBloque();

  return new ValorFijo(string);
}

// Encuentra la primera ocurrencia de `operador` que no esté dentro de () ni []
function encontrarPrimerOperadorFuera(string, operador) {
  let depth = 0;
  for (let i = 0; i <= string.length - operador.length; i++) {
    const c = string[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (depth === 0 && string.startsWith(operador, i)) return i;
  }
  return -1;
}

function extraerContenidoParentesis(string) {
  const start = string.indexOf("(");
  if (start === -1) return string.replace("{", "").trim();
  let depth = 0, end = -1;
  for (let i = start; i < string.length; i++) {
    if (string[i] === "(") depth++;
    else if (string[i] === ")") { depth--; if (depth === 0) { end = i; break; } }
  }
  return string.substring(start + 1, end);
}

function estaEnvueltoEnParentesis(string) {
  if (!string.startsWith("(")) return false;
  let profundidad = 0;
  for (let i = 0; i < string.length; i++) {
    if (string[i] === "(") profundidad++;
    else if (string[i] === ")") profundidad--;
    if (profundidad === 0) return i === string.length - 1;
  }
  return false;
}

function encontrarUltimoOperadorFuera(string, operadores) {
  let profundidad = 0;
  let ultimoIndice = -1;
  let ultimoOp = null;
  for (let i = 0; i < string.length; i++) {
    if (string[i] === "(") profundidad++;
    else if (string[i] === ")") profundidad--;
    else if (profundidad === 0 && operadores.includes(string[i])) {
      ultimoIndice = i;
      ultimoOp = string[i];
    }
  }
  return { indice: ultimoIndice, op: ultimoOp };
}

function tieneEscritura(string) {
  let i = 0;
  let b = false;
  while (!b && string.length > i) {
    if (string[i] === ">" || string[i] === "<") break;
    if (string[i] === "=" && (i === 0 || string[i - 1] !== "!")) b = true;
    i++;
  }
  return b && string[i] !== "=";
}

function esEscrituraIndexada(string) {
  const bracketIdx = string.indexOf("[");
  if (bracketIdx === -1) return false;
  let depth = 0;
  for (let i = bracketIdx; i < string.length; i++) {
    if (string[i] === "[") depth++;
    else if (string[i] === "]") {
      depth--;
      if (depth === 0) return string[i + 1] === "=" && string[i + 2] !== "=";
    }
  }
  return false;
}
