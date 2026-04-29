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
  FinDeBloque,
  Condicional,
  Else,
  DeclaracionVariableLocal,
  While,
  Mayor,
  MayorOIgual,
  Menor,
  MenorOIgual,
  YLogico,
  OLogico,
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
    return new DeclaracionVariableLocal(string.substring(5), manejarMemoria);
  }
  if (string.startsWith("print")) {
    const argumento = string.substring(5).replace("(", "").replace(")", "");
    return new Imprimir(instruccionSegunString(argumento, mem, consola, limiteRepeticiones), consola);
  }
  if (string.startsWith("while")) {
    const condicion = string.substring(5).replace("(", "").replace(")", "").replace("{", "");
    return new While(
      instruccionSegunString(condicion, mem, consola, limiteRepeticiones),
      limiteRepeticiones
    );
  }
  if (string.startsWith("if")) {
    const condicion = string.substring(2).replace("(", "").replace(")", "").replace("{", "");
    return new Condicional(instruccionSegunString(condicion, mem, consola, limiteRepeticiones));
  }
  if (string.includes("else")) {
    return new Else();
  }

  if (estaEnvueltoEnParentesis(string)) {
    return instruccionSegunString(string.substring(1, string.length - 1), mem, consola, limiteRepeticiones);
  }

  if (tieneEscritura(string)) {
    const partes = string.split("=");
    const nombre = partes.shift();
    return new Escritura(nombre, instruccionSegunString(partes.join("="), mem, consola, limiteRepeticiones));
  }

  if (string.includes("&&")) {
    const partes = string.split("&&");
    const izq = partes.shift();
    return new YLogico(
      instruccionSegunString(izq, mem, consola, limiteRepeticiones),
      instruccionSegunString(partes.join("&&"), mem, consola, limiteRepeticiones)
    );
  }
  if (string.includes("||")) {
    const partes = string.split("||");
    const izq = partes.shift();
    return new OLogico(
      instruccionSegunString(izq, mem, consola, limiteRepeticiones),
      instruccionSegunString(partes.join("||"), mem, consola, limiteRepeticiones)
    );
  }

  if (string.includes(">=")) {
    const [izq, ...der] = string.split(">=");
    return new MayorOIgual(
      instruccionSegunString(izq, mem, consola, limiteRepeticiones),
      instruccionSegunString(der.join(""), mem, consola, limiteRepeticiones)
    );
  }
  if (string.includes("<=")) {
    const [izq, ...der] = string.split("<=");
    return new MenorOIgual(
      instruccionSegunString(izq, mem, consola, limiteRepeticiones),
      instruccionSegunString(der.join(""), mem, consola, limiteRepeticiones)
    );
  }
  if (string.includes(">")) {
    const [izq, ...der] = string.split(">");
    return new Mayor(
      instruccionSegunString(izq, mem, consola, limiteRepeticiones),
      instruccionSegunString(der.join(""), mem, consola, limiteRepeticiones)
    );
  }
  if (string.includes("<")) {
    const [izq, ...der] = string.split("<");
    return new Menor(
      instruccionSegunString(izq, mem, consola, limiteRepeticiones),
      instruccionSegunString(der.join(""), mem, consola, limiteRepeticiones)
    );
  }
  if (string.includes("==")) {
    const [izq, ...der] = string.split("==");
    return new Igualdad(
      instruccionSegunString(izq, mem, consola, limiteRepeticiones),
      instruccionSegunString(der.join(""), mem, consola, limiteRepeticiones)
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

  if (mem.hayVariable(string)) return new Lectura(string);
  if (string === "}") return new FinDeBloque();

  return new ValorFijo(string);
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
    b = string[i] === "=";
    i++;
  }
  return b && string[i] !== "=";
}
