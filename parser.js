import { Lexer, TK } from "./lexer.js";
import Memoria from "./memoria.js";
import Hilo from "./hilos.js";
import { Semaphore } from "./semaforo.js";
import { ErrorSimulador } from "./errores.js";
import { Clase } from "./clase.js";
import { Monitor } from "./monitor.js";
import {
  Sumar, Restar, Multiplicar, Dividir,
  Imprimir, ValorFijo, Literal, ListaLiteral, AccesoMetodo,
  Escritura, Lectura,
  Igualdad, Desigualdad, FinDeBloque, Condicional, Else,
  DeclaracionVariableLocal, InicializarLocal,
  While, Mayor, MayorOIgual, Menor, MenorOIgual,
  YLogico, OLogico, Repeat, For, ForEach,
  LecturaIndexada, EscrituraIndexada, Maximo, Negacion, GetId,
  LlamadaFuncion, LlamadaMetodo, NuevaInstancia, LecturaThis, Return,
  Acquire, Release,
  EntradaMonitor, SalidaMonitor, Wait, Notify, NotifyAll, LecturaCondicion,
  Send, Receive, NuevoCanal, NuevoRequest, LecturaCampo, EscrituraCampo,
} from "./instrucciones.js";
import { Canal } from "./canal.js";

// ─── Nombres legibles para tokens ────────────────────────────────────────────

const NOMBRES_TOKEN = {
  LPAREN:         '"("',
  RPAREN:         '")"',
  LBRACE:         '"{"',
  RBRACE:         '"}"',
  LBRACKET:       '"["',
  RBRACKET:       '"]"',
  COMMA:          '","',
  DOT:            '"."',
  SEMICOLON:      '";"',
  ASSIGN:         '"="',
  EQ:             '"=="',
  NEQ:            '"!="',
  LT:             '"<"',
  GT:             '">"',
  LTE:            '"<="',
  GTE:            '">="',
  PLUS:           '"+"',
  MINUS:          '"-"',
  STAR:           '"*"',
  SLASH:          '"/"',
  AND:            '"&&"',
  OR:             '"||"',
  NOT:            '"!"',
  IDENT:          "un identificador",
  NUMBER:         "un número",
  STRING:         "un texto",
  BOOL:           '"true" o "false"',
  TYPE_INT:       '"Int"',
  TYPE_BOOL:      '"Bool"',
  TYPE_STRING:    '"String"',
  TYPE_LIST:      '"List"',
  TYPE_SEMAPHORE: '"Semaphore"',
  NEW:            '"new"',
  GLOBAL:         '"global"',
  LOCAL:          '"local"',
  IF:             '"if"',
  ELSE:           '"else"',
  WHILE:          '"while"',
  FOR:            '"for"',
  REPEAT:         '"repeat"',
  RETURN:         '"return"',
  THREAD:         '"Thread"',
  FUNCTION:       '"function"',
  EOF:            "fin del programa",
};

function legible(tipo) {
  return NOMBRES_TOKEN[tipo] ?? `'${tipo}'`;
}

// ─── Parser recursivo descendente ────────────────────────────────────────────

class Parser {
  constructor(tokens, mem, consola, limite, funciones = {}, clases = {}, monitores = {}) {
    this.tokens    = tokens;
    this.pos       = 0;
    this.mem       = mem;
    this.consola   = consola;
    this.limite    = limite;
    this.funciones = funciones; // tabla compartida: nombre -> { params, instrucciones }
    this.clases    = clases;    // tabla compartida: nombre -> Clase
    this.monitores = monitores; // tabla compartida: nombre -> Monitor
  }

  // ── Utilidades de navegación ───────────────────────────────────────────────

  peek()    { return this.tokens[this.pos]; }
  peekAt(n) { return this.tokens[this.pos + n]; }
  advance() { return this.tokens[this.pos++]; }
  check(type) { return this.peek().type === type; }

  match(...types) {
    if (types.includes(this.peek().type)) return this.advance();
    return null;
  }

  expect(type) {
    const tok = this.peek();
    if (tok.type !== type)
      throw ErrorSimulador.parse(
        `Se esperaba ${legible(type)} pero se encontró ${legible(tok.type)} (${JSON.stringify(tok.value)})`,
        tok.line
      );
    return this.advance();
  }

  isType(type) {
    return type === TK.TYPE_INT || type === TK.TYPE_BOOL ||
           type === TK.TYPE_STRING || type === TK.TYPE_LIST ||
           type === TK.TYPE_SEMAPHORE || type === TK.TYPE_CHANNEL;
  }

  isSemaphoreType() {
    return this.check(TK.TYPE_SEMAPHORE);
  }

  // ── Top-level ──────────────────────────────────────────────────────────────

  parseProgram() {
    const globals  = [];
    const threads  = [];

    while (!this.check(TK.EOF)) {
      if (this.check(TK.GLOBAL)) {
        this.advance();
        globals.push(this.parseGlobalDecl());
      } else if (this.check(TK.THREAD)) {
        threads.push(this.parseThread());
      } else if (this.check(TK.FUNCTION)) {
        this.parseFunction();
      } else if (this.check(TK.CLASS)) {
        this.parseClass();
      } else if (this.check(TK.MONITOR)) {
        this.parseMonitor();
      } else if (this.check(TK.PROCESS)) {
        threads.push(this.parseProcess());
      } else {
        this.advance();
      }
    }

    return { globals, threads };
  }

  // class NombreClase { atributos, constructor, métodos }
  parseClass() {
    this.expect(TK.CLASS);
    const nombre = this.expect(TK.IDENT).value;
    this.expect(TK.LBRACE);

    const atributosDefault = {};
    const metodos = {};
    let constructorDef = null;

    while (!this.check(TK.RBRACE) && !this.check(TK.EOF)) {
      if (this.check(TK.LOCAL)) {
        // Atributo: local Tipo nombre = valorDefault
        // El tipo puede ser primitivo (Int, Bool, etc.) o el nombre de una clase
        this.advance();
        let tipoClaseAtributo = null;
        if (this.isType(this.peek().type)) {
          this.advance(); // tipo primitivo, ignorar
        } else if (this.check(TK.IDENT) && this.clases[this.peek().value]) {
          tipoClaseAtributo = this.peek().value; // nombre de clase
          this.advance();
        }
        const attrNombre = this.expect(TK.IDENT).value;
        let valorDefault = null;
        if (this.match(TK.ASSIGN)) {
          if (tipoClaseAtributo && this.check(TK.NEW)) {
            // local NombreClase attr = new NombreClase(args)
            valorDefault = this._parseNewInstanciaEager(this.clases[tipoClaseAtributo]);
          } else {
            valorDefault = this.parseLiteralValue();
          }
        }
        this.match(TK.SEMICOLON);
        atributosDefault[attrNombre] = valorDefault;

      } else if (this.check(TK.CONSTRUCTOR)) {
        // constructor(params) { cuerpo }
        this.advance();
        this.expect(TK.LPAREN);
        const params = [];
        while (!this.check(TK.RPAREN) && !this.check(TK.EOF)) {
          if (this.isType(this.peek().type)) this.advance();
          params.push(this.expect(TK.IDENT).value);
          this.match(TK.COMMA);
        }
        this.expect(TK.RPAREN);
        this.expect(TK.LBRACE);
        const instrucciones = this.parseBody();
        constructorDef = { params, instrucciones };

      } else if (this.check(TK.FUNCTION)) {
        // function TipoOpc nombreMetodo(params) { cuerpo }
        this.advance();
        if (this.isType(this.peek().type)) this.advance();
        const metodoNombre = this.expect(TK.IDENT).value;
        this.expect(TK.LPAREN);
        const params = [];
        while (!this.check(TK.RPAREN) && !this.check(TK.EOF)) {
          if (this.isType(this.peek().type)) this.advance();
          params.push(this.expect(TK.IDENT).value);
          this.match(TK.COMMA);
        }
        this.expect(TK.RPAREN);
        this.expect(TK.LBRACE);
        const instrucciones = this.parseBody();
        metodos[metodoNombre] = { params, instrucciones };

      } else {
        this.advance(); // ignorar tokens desconocidos dentro de la clase
      }
    }
    this.expect(TK.RBRACE);

    this.clases[nombre] = new Clase(nombre, atributosDefault, metodos, constructorDef);
  }

  // monitor NombreMonitor { condition cond; atributos; constructor; métodos }
  parseMonitor() {
    this.expect(TK.MONITOR);
    const nombre = this.expect(TK.IDENT).value;
    this.expect(TK.LBRACE);

    const atributosDefault = {};
    const metodos          = {};
    const condiciones      = []; // nombres de variables de condición explícitas
    let   constructorDef   = null;

    while (!this.check(TK.RBRACE) && !this.check(TK.EOF)) {
      if (this.check(TK.CONDITION)) {
        // condition nombreVar
        this.advance();
        condiciones.push(this.expect(TK.IDENT).value);
        this.match(TK.SEMICOLON);

      } else if (this.check(TK.LOCAL)) {
        this.advance();
        if (this.isType(this.peek().type)) this.advance();
        const attrNombre = this.expect(TK.IDENT).value;
        let valorDefault = null;
        if (this.match(TK.ASSIGN)) valorDefault = this.parseLiteralValue();
        this.match(TK.SEMICOLON);
        atributosDefault[attrNombre] = valorDefault;

      } else if (this.check(TK.CONSTRUCTOR)) {
        this.advance();
        this.expect(TK.LPAREN);
        const params = [];
        while (!this.check(TK.RPAREN) && !this.check(TK.EOF)) {
          if (this.isType(this.peek().type)) this.advance();
          params.push(this.expect(TK.IDENT).value);
          this.match(TK.COMMA);
        }
        this.expect(TK.RPAREN);
        this.expect(TK.LBRACE);
        constructorDef = { params, instrucciones: this.parseBody() };

      } else if (this.check(TK.FUNCTION)) {
        this.advance();
        if (this.isType(this.peek().type)) this.advance();
        const metodoNombre = this.expect(TK.IDENT).value;
        this.expect(TK.LPAREN);
        const params = [];
        while (!this.check(TK.RPAREN) && !this.check(TK.EOF)) {
          if (this.isType(this.peek().type)) this.advance();
          params.push(this.expect(TK.IDENT).value);
          this.match(TK.COMMA);
        }
        this.expect(TK.RPAREN);
        this.expect(TK.LBRACE);
        metodos[metodoNombre] = { params, instrucciones: this.parseBody() };

      } else {
        this.advance();
      }
    }
    this.expect(TK.RBRACE);

    this.monitores[nombre] = new Monitor(nombre, atributosDefault, metodos, constructorDef, condiciones);
  }

  parseGlobalDecl() {
    const typeTok = this.advance(); // consume type keyword

    // global Channel c = new Channel()
    if (typeTok.type === TK.TYPE_CHANNEL) {
      const name = this.expect(TK.IDENT).value;
      this.expect(TK.ASSIGN);
      this.expect(TK.NEW);
      this.expect(TK.TYPE_CHANNEL);
      this.expect(TK.LPAREN);
      this.expect(TK.RPAREN);
      this.match(TK.SEMICOLON);
      return { name, value: new Canal() };
    }

    // global Semaphore s = new Semaphore(n, bool?)
    // global Semaphore[] sems = new Semaphore[k](n, bool?)
    if (typeTok.type === TK.TYPE_SEMAPHORE) {
      const esArray = !!this.match(TK.LBRACKET);
      if (esArray) this.expect(TK.RBRACKET);
      const name = this.expect(TK.IDENT).value;
      this.expect(TK.ASSIGN);
      const value = esArray
        ? this.parseNewSemaphoreArray()
        : this.parseNewSemaphore();
      this.match(TK.SEMICOLON);
      return { name, value };
    }

    // global NombreClase c = new NombreClase(args)
    if (typeTok.type === TK.IDENT && this.clases[typeTok.value]) {
      const nombreClase = typeTok.value;
      const clase       = this.clases[nombreClase];
      const name        = this.expect(TK.IDENT).value;
      this.expect(TK.ASSIGN);
      const instancia = this._parseNewInstanciaEager(clase);
      this.match(TK.SEMICOLON);
      return { name, value: instancia };
    }

    // global NombreMonitor m = new NombreMonitor(args)
    if (typeTok.type === TK.IDENT && this.monitores[typeTok.value]) {
      const nombreMonitor = typeTok.value;
      const monitor       = this.monitores[nombreMonitor];
      const name          = this.expect(TK.IDENT).value;
      this.expect(TK.ASSIGN);
      const instancia = this._parseNewMonitorEager(monitor);
      this.match(TK.SEMICOLON);
      return { name, value: instancia };
    }

    const name = this.expect(TK.IDENT).value;
    let value;
    if (this.match(TK.ASSIGN)) value = this.parseLiteralValue();
    this.match(TK.SEMICOLON);
    return { name, value };
  }

  // Parsea new NombreClase(args) de forma eager (para variables globales).
  // El constructor no se ejecuta aquí — los atributos quedan en su valor default.
  // Los args del constructor se evalúan como literales.
  _parseNewInstanciaEager(clase) {
    this.expect(TK.NEW);
    this.expect(TK.IDENT); // consume el nombre de la clase otra vez
    this.expect(TK.LPAREN);
    const args = [];
    while (!this.check(TK.RPAREN) && !this.check(TK.EOF)) {
      args.push(this.parseLiteralValue());
      this.match(TK.COMMA);
    }
    this.expect(TK.RPAREN);
    // Crear instancia con atributos default. El constructor se saltea para globales
    // porque se ejecuta antes de que los hilos existan. Para la semántica educativa
    // esto es aceptable: el constructor puede usarse en locales donde hay interleaving.
    const instancia = clase.instanciar();
    // Aplicar constructor en forma eager si existe y solo usa literales
    if (clase.constructorDef) {
      const ctor = clase.constructorDef;
      // Ejecutar las instrucciones del constructor de forma eager (sin hilo)
      // usando una mini-memoria para los parámetros
      const miniMem = new Memoria();
      ctor.params.forEach((p, i) => miniMem.agregarVariable(p, args[i] ?? null));
      this._ejecutarConstructorEager(ctor.instrucciones, instancia.memoriaInstancia, miniMem);
    }
    return instancia;
  }

  // Ejecuta instrucciones simples de un constructor en forma eager (sin scheduler).
  // Solo soporta asignaciones directas de literales o parámetros — suficiente para inicialización.
  _ejecutarConstructorEager(instrucciones, memInstancia, memParams) {
    for (const instr of instrucciones) {
      // Solo procesamos Escritura o InicializarLocal simples
      const s = instr.toString();
      // Estrategia simple: evaluar cada instrucción con un mini-evaluador
      if (instr.constructor.name === 'Escritura' || instr.constructor.name === 'InicializarLocal') {
        const nombre = instr.nombre ?? instr.nombre;
        // Intentar resolver el valor como literal o parámetro
        const expr = instr.valor ?? instr.expresion;
        const valor = this._resolverExprEager(expr, memInstancia, memParams);
        if (valor !== undefined) {
          memInstancia.agregarVariable(nombre, valor);
        }
      }
    }
  }

  _resolverExprEager(expr, memInstancia, memParams) {
    if (!expr) return undefined;
    const tipo = expr.constructor.name;
    if (tipo === 'Literal') return expr.valor;
    if (tipo === 'Lectura') {
      const n = expr.variable;
      if (memParams.hayVariable(n)) return memParams.verValor(n);
      if (memInstancia.hayVariable(n)) return memInstancia.verValor(n);
      return undefined;
    }
    if (tipo === 'Sumar') {
      const a = this._resolverExprEager(expr.izq, memInstancia, memParams);
      const b = this._resolverExprEager(expr.der, memInstancia, memParams);
      return (a !== undefined && b !== undefined) ? a + b : undefined;
    }
    if (tipo === 'Restar') {
      const a = this._resolverExprEager(expr.izq, memInstancia, memParams);
      const b = this._resolverExprEager(expr.der, memInstancia, memParams);
      return (a !== undefined && b !== undefined) ? a - b : undefined;
    }
    return undefined;
  }

  // new NombreMonitor(args) eager — crea la instancia antes de lanzar hilos
  _parseNewMonitorEager(monitor) {
    this.expect(TK.NEW);
    this.expect(TK.IDENT); // consume el nombre del monitor
    this.expect(TK.LPAREN);
    const args = [];
    while (!this.check(TK.RPAREN) && !this.check(TK.EOF)) {
      args.push(this.parseLiteralValue());
      this.match(TK.COMMA);
    }
    this.expect(TK.RPAREN);
    return monitor.instanciar();
  }

  // new Semaphore(permisos, fuerte?)
  parseNewSemaphore() {
    this.expect(TK.NEW);
    this.expect(TK.TYPE_SEMAPHORE);
    this.expect(TK.LPAREN);
    const permisos = this.expect(TK.NUMBER).value;
    let fuerte = false;
    if (this.match(TK.COMMA)) {
      fuerte = this.expect(TK.BOOL).value;
    }
    this.expect(TK.RPAREN);
    return new Semaphore(permisos, fuerte);
  }

  // new Semaphore[k](permisos, fuerte?)
  parseNewSemaphoreArray() {
    this.expect(TK.NEW);
    this.expect(TK.TYPE_SEMAPHORE);
    this.expect(TK.LBRACKET);
    const cantidad = this.expect(TK.NUMBER).value;
    this.expect(TK.RBRACKET);
    this.expect(TK.LPAREN);
    const permisos = this.expect(TK.NUMBER).value;
    let fuerte = false;
    if (this.match(TK.COMMA)) {
      fuerte = this.expect(TK.BOOL).value;
    }
    this.expect(TK.RPAREN);
    return Array.from({ length: cantidad }, () => new Semaphore(permisos, fuerte));
  }

  // Evalúa un literal de forma eager (para inicialización de globales)
  parseLiteralValue() {
    const tok = this.peek();
    if (tok.type === TK.NUMBER) { this.advance(); return tok.value; }
    if (tok.type === TK.STRING) { this.advance(); return tok.value; }
    if (tok.type === TK.BOOL)   { this.advance(); return tok.value; }
    if (tok.type === TK.MINUS)  { this.advance(); return -this.parseLiteralValue(); }
    if (tok.type === TK.LBRACKET) {
      this.advance();
      const items = [];
      while (!this.check(TK.RBRACKET) && !this.check(TK.EOF)) {
        items.push(this.parseLiteralValue());
        this.match(TK.COMMA);
      }
      this.expect(TK.RBRACKET);
      return items;
    }
    if (tok.type === TK.IDENT) {
      this.advance();
      return this.mem.hayVariable(tok.value) ? this.mem.verValor(tok.value) : tok.value;
    }
    throw ErrorSimulador.parse(`Valor inválido: '${tok.value}'`, tok.line);
  }

  parseFunction() {
    this.expect(TK.FUNCTION);

    // Tipo de retorno opcional: function Int foo(...) o function foo(...)
    if (this.isType(this.peek().type)) this.advance();

    const nombre = this.expect(TK.IDENT).value;
    this.expect(TK.LPAREN);

    // Parámetros: tipo? nombre, tipo? nombre, ...
    const params = [];
    while (!this.check(TK.RPAREN) && !this.check(TK.EOF)) {
      if (this.isType(this.peek().type)) this.advance(); // consume tipo opcional
      params.push(this.expect(TK.IDENT).value);
      this.match(TK.COMMA);
    }
    this.expect(TK.RPAREN);
    this.expect(TK.LBRACE);

    const instrucciones = this.parseBody(); // sin FinDeBloque — el Return lo termina

    this.funciones[nombre] = { params, instrucciones };
  }

  // process Nombre(c1, c2) { ... }
  // Crea exactamente 1 hilo con los canales pasados como variables locales
  parseProcess() {
    this.expect(TK.PROCESS);
    const nombre = this.expect(TK.IDENT).value;
    this.expect(TK.LPAREN);
    const params = [];
    while (!this.check(TK.RPAREN) && !this.check(TK.EOF)) {
      params.push(this.expect(TK.IDENT).value);
      this.match(TK.COMMA);
    }
    this.expect(TK.RPAREN);
    this.expect(TK.LBRACE);
    const instrucciones = this.parseBlock();
    return { tipo: 'process', nombre, params, instrucciones };
  }

  parseThread() {
    this.expect(TK.THREAD);
    this.expect(TK.LPAREN);

    const numTok = this.advance();
    const rawNum = numTok.value;

    let nombre = null;
    if (this.match(TK.COMMA)) {
      nombre = this.advance().value; // STRING o IDENT
    }

    this.expect(TK.RPAREN);
    this.expect(TK.LBRACE);
    const instrucciones = this.parseBlock(); // FinDeBloque sentinel al final
    return { rawNum, nombre, instrucciones };
  }

  // Parsea statements hasta RBRACE, consume el RBRACE
  parseBody() {
    const result = [];
    while (!this.check(TK.RBRACE) && !this.check(TK.EOF)) {
      result.push(...this.parseStatement());
    }
    this.match(TK.RBRACE);
    return result;
  }

  // Como parseBody pero agrega FinDeBloque al final (para bloques de control)
  parseBlock() {
    const result = this.parseBody();
    result.push(new FinDeBloque());
    return result;
  }

  // ── Statements ─────────────────────────────────────────────────────────────

  parseStatement() {
    const tok = this.peek();

    switch (tok.type) {
      case TK.LOCAL:   return this.parseLocal();
      case TK.IF:      return this.parseIf();
      case TK.ELSE:    return this.parseElse();
      case TK.WHILE:   return this.parseWhile();
      case TK.FOR:     return this.parseFor();
      case TK.FOREACH: return this.parseForeach();
      case TK.REPEAT:  return this.parseRepeat();
      case TK.RETURN:  return this.parseReturn();
      default:         return this.parseExprStatement();
    }
  }

  parseLocal() {
    this.expect(TK.LOCAL);

    // local Channel c = new Channel()
    if (this.check(TK.TYPE_CHANNEL)) {
      this.advance();
      const name = this.expect(TK.IDENT).value;
      this.expect(TK.ASSIGN);
      this.expect(TK.NEW);
      this.expect(TK.TYPE_CHANNEL);
      this.expect(TK.LPAREN);
      this.expect(TK.RPAREN);
      this.match(TK.SEMICOLON);
      return [new InicializarLocal(name, new NuevoCanal())];
    }

    // Detectar si el tipo es un nombre de clase: local NombreClase c = new NombreClase(args)
    if (this.check(TK.IDENT) && this.clases[this.peek().value]) {
      const nombreClase = this.advance().value;
      const name        = this.expect(TK.IDENT).value;
      this.expect(TK.ASSIGN);
      const expr = this._parseNewInstanciaExpr(nombreClase);
      this.match(TK.SEMICOLON);
      return [new InicializarLocal(name, expr)];
    }

    // Consume tipo simple opcional
    if (this.isType(this.peek().type)) this.advance();

    const name = this.expect(TK.IDENT).value;

    if (this.match(TK.ASSIGN)) {
      const expr = this.parseExpr();
      this.match(TK.SEMICOLON);
      return [new InicializarLocal(name, expr)];
    }

    this.match(TK.SEMICOLON);
    return [new InicializarLocal(name, new Literal(0))];
  }

  // Parsea new NombreClase(args) como expresión con interleaving.
  _parseNewInstanciaExpr(nombreClase) {
    this.expect(TK.NEW);
    this.expect(TK.IDENT); // consume el nombre de la clase
    this.expect(TK.LPAREN);
    const args = [];
    while (!this.check(TK.RPAREN) && !this.check(TK.EOF)) {
      args.push(this.parseExpr());
      this.match(TK.COMMA);
    }
    this.expect(TK.RPAREN);
    return new NuevaInstancia(nombreClase, args);
  }

  parseIf() {
    this.expect(TK.IF);
    this.expect(TK.LPAREN);
    const cond = this.parseExpr();
    this.expect(TK.RPAREN);
    this.expect(TK.LBRACE);
    return [new Condicional(cond), ...this.parseBlock()];
  }

  parseElse() {
    this.expect(TK.ELSE);
    this.expect(TK.LBRACE);
    return [new Else(), ...this.parseBlock()];
  }

  parseWhile() {
    this.expect(TK.WHILE);
    this.expect(TK.LPAREN);
    const cond = this.parseExpr();
    this.expect(TK.RPAREN);
    this.expect(TK.LBRACE);
    return [new While(cond, this.limite), ...this.parseBlock()];
  }

  parseFor() {
    this.expect(TK.FOR);
    this.expect(TK.LPAREN);

    // Detectar foreach: IDENT ':' expr  (sin tipo declarado)
    if (this.check(TK.IDENT) && this.peekAt(1)?.type === TK.COLON) {
      const varName = this.advance().value;
      this.advance(); // COLON
      const listaExpr = this.parseExpr();
      this.expect(TK.RPAREN);
      this.expect(TK.LBRACE);
      return [new ForEach(varName, listaExpr, this.limite), ...this.parseBlock()];
    }

    // for clásico: init ; cond ; incr
    const init = this.parseForInit();
    this.expect(TK.SEMICOLON);
    const cond = this.parseExpr();
    this.expect(TK.SEMICOLON);
    const incr = this.parseExpr();
    this.expect(TK.RPAREN);
    this.expect(TK.LBRACE);
    return [new For(init, cond, incr, this.limite), ...this.parseBlock()];
  }

  parseForeach() {
    // Si el lexer emite FOREACH como keyword separado
    this.advance();
    this.expect(TK.LPAREN);
    const varName = this.expect(TK.IDENT).value;
    this.expect(TK.COLON);
    const listaExpr = this.parseExpr();
    this.expect(TK.RPAREN);
    this.expect(TK.LBRACE);
    return [new ForEach(varName, listaExpr, this.limite), ...this.parseBlock()];
  }

  parseForInit() {
    if (this.check(TK.LOCAL)) {
      this.advance();
      if (this.isType(this.peek().type)) this.advance();
      const name = this.expect(TK.IDENT).value;
      this.expect(TK.ASSIGN);
      return new InicializarLocal(name, this.parseExpr());
    }
    return this.parseExpr();
  }

  parseReturn() {
    this.expect(TK.RETURN);
    // return sin expresión es válido (retorna null)
    if (this.check(TK.SEMICOLON) || this.check(TK.RBRACE) || this.check(TK.EOF)) {
      this.match(TK.SEMICOLON);
      return [new Return(new Literal(null))];
    }
    const expr = this.parseExpr();
    this.match(TK.SEMICOLON);
    return [new Return(expr)];
  }

  parseRepeat() {
    this.expect(TK.REPEAT);
    this.expect(TK.LPAREN);
    const expr = this.parseExpr();
    this.expect(TK.RPAREN);
    this.expect(TK.LBRACE);
    return [new Repeat(expr, this.limite), ...this.parseBlock()];
  }

  parseExprStatement() {
    const expr = this.parseExpr();
    this.match(TK.SEMICOLON);
    return [expr];
  }

  // ── Expresiones (precedencia de baja a alta) ───────────────────────────────

  parseExpr() { return this.parseAssignment(); }

  parseAssignment() {
    const saved = this.pos;

    if (this.check(TK.IDENT)) {
      const name = this.advance().value;

      // name[idx] = expr
      if (this.check(TK.LBRACKET)) {
        this.advance();
        const idx = this.parseExpr();
        this.expect(TK.RBRACKET);
        if (this.check(TK.ASSIGN)) {
          this.advance();
          return new EscrituraIndexada(name, idx, this.parseExpr());
        }
        this.pos = saved;
      // name.campo = expr  (escritura de campo de Request)
      } else if (this.check(TK.DOT)) {
        this.advance();
        const campo = this.expect(TK.IDENT).value;
        if (this.check(TK.ASSIGN)) {
          this.advance();
          return new EscrituraCampo(new Lectura(name), campo, this.parseExpr());
        }
        this.pos = saved;
      // name = expr  (solo = simple, no ==)
      } else if (this.check(TK.ASSIGN)) {
        this.advance();
        return new Escritura(name, this.parseExpr());
      } else {
        this.pos = saved;
      }
    }

    return this.parseOr();
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.match(TK.OR)) left = new OLogico(left, this.parseAnd());
    return left;
  }

  parseAnd() {
    let left = this.parseEquality();
    while (this.match(TK.AND)) left = new YLogico(left, this.parseEquality());
    return left;
  }

  parseEquality() {
    let left = this.parseComparison();
    let tok;
    while ((tok = this.match(TK.EQ, TK.NEQ))) {
      const right = this.parseComparison();
      left = tok.type === TK.EQ ? new Igualdad(left, right) : new Desigualdad(left, right);
    }
    return left;
  }

  parseComparison() {
    let left = this.parseAdditive();
    let tok;
    while ((tok = this.match(TK.LT, TK.GT, TK.LTE, TK.GTE))) {
      const right = this.parseAdditive();
      if      (tok.type === TK.LT)  left = new Menor(left, right);
      else if (tok.type === TK.GT)  left = new Mayor(left, right);
      else if (tok.type === TK.LTE) left = new MenorOIgual(left, right);
      else                          left = new MayorOIgual(left, right);
    }
    return left;
  }

  parseAdditive() {
    let left = this.parseMultiplicative();
    let tok;
    while ((tok = this.match(TK.PLUS, TK.MINUS))) {
      const right = this.parseMultiplicative();
      left = tok.type === TK.PLUS ? new Sumar(left, right) : new Restar(left, right);
    }
    return left;
  }

  parseMultiplicative() {
    let left = this.parseUnary();
    let tok;
    while ((tok = this.match(TK.STAR, TK.SLASH))) {
      const right = this.parseUnary();
      left = tok.type === TK.STAR ? new Multiplicar(left, right) : new Dividir(left, right);
    }
    return left;
  }

  parseUnary() {
    if (this.match(TK.NOT))   return new Negacion(this.parseUnary());
    if (this.match(TK.MINUS)) return new Restar(new Literal(0), this.parseUnary());
    return this.parsePostfix();
  }

  parsePostfix() {
    let expr = this.parsePrimary();

    while (true) {
      if (this.check(TK.DOT)) {
        this.advance();
        const method = this.expect(TK.IDENT).value;
        let args = [];
        const tieneLlamada = !!this.match(TK.LPAREN);
        if (tieneLlamada) {
          while (!this.check(TK.RPAREN) && !this.check(TK.EOF)) {
            args.push(this.parseExpr());
            this.match(TK.COMMA);
          }
          this.expect(TK.RPAREN);
        }
        if (method === 'acquire') {
          expr = new Acquire(expr);
        } else if (method === 'release') {
          expr = new Release(expr);
        } else if (method === 'send') {
          const arg = args.length > 0 ? args[0] : new Literal(null);
          expr = new Send(expr, arg);
        } else if (method === 'receive') {
          expr = new Receive(expr);
        } else if (method === 'wait') {
          // condicion.wait() o this.wait() — la expr es la condición o el monitor
          expr = new Wait(new LecturaCondicion('_default'));
        } else if (method === 'notify') {
          expr = new Notify(new LecturaCondicion('_default'));
        } else if (method === 'notifyAll') {
          expr = new NotifyAll(new LecturaCondicion('_default'));
        } else if (tieneLlamada) {
          // Con paréntesis: puede ser método de instancia o método built-in (length, etc.)
          // LlamadaMetodo hace dispatch en runtime según el tipo del objeto
          expr = new LlamadaMetodo(expr, method, args);
        } else {
          // Sin paréntesis: propiedad (ej: lista.length)
          expr = new AccesoMetodo(expr, method, args);
        }

      } else if (this.check(TK.LBRACKET)) {
        // Lectura indexada: solo llega acá si parseAssignment no tomó el control
        this.advance();
        const idx = this.parseExpr();
        this.expect(TK.RBRACKET);
        const nombre = expr instanceof Lectura ? expr.variable : expr.toString();
        expr = new LecturaIndexada(nombre, idx);

      } else {
        break;
      }
    }

    return expr;
  }

  parsePrimary() {
    const tok = this.peek();

    if (tok.type === TK.NUMBER) { this.advance(); return new Literal(tok.value); }
    if (tok.type === TK.STRING) { this.advance(); return new Literal(tok.value); }
    if (tok.type === TK.BOOL)   { this.advance(); return new Literal(tok.value); }

    if (tok.type === TK.LPAREN) {
      this.advance();
      const expr = this.parseExpr();
      this.expect(TK.RPAREN);
      return expr;
    }

    if (tok.type === TK.THIS) {
      this.advance();
      return new LecturaThis();
    }

    // new Request()
    if (tok.type === TK.NEW) {
      this.advance();
      const typeTok = this.peek();
      if (typeTok.type === TK.IDENT && typeTok.value === 'Request') {
        this.advance();
        this.expect(TK.LPAREN);
        this.expect(TK.RPAREN);
        return new NuevoRequest();
      }
      // new Channel() como expresión (para local Channel c = new Channel() ya manejado,
      // pero por si acaso se usa en otro contexto)
      if (typeTok.type === TK.TYPE_CHANNEL) {
        this.advance();
        this.expect(TK.LPAREN);
        this.expect(TK.RPAREN);
        return new NuevoCanal();
      }
      throw ErrorSimulador.parse(`Se esperaba Request o Channel después de 'new'`, typeTok.line);
    }

    if (tok.type === TK.LBRACKET) {
      this.advance();
      const items = [];
      while (!this.check(TK.RBRACKET) && !this.check(TK.EOF)) {
        items.push(this.parseExpr());
        this.match(TK.COMMA);
      }
      this.expect(TK.RBRACKET);
      return new ListaLiteral(items);
    }

    if (tok.type === TK.IDENT) {
      this.advance();
      const name = tok.value;

      // Built-ins que se parsean como expresión
      if (this.check(TK.LPAREN)) {
        this.advance();
        if (name === 'print') {
          const arg = this.parseExpr();
          this.expect(TK.RPAREN);
          return new Imprimir(arg, this.consola);
        }
        if (name === 'maximum') {
          const arg = this.parseExpr();
          this.expect(TK.RPAREN);
          return new Maximo(arg);
        }
        if (name === 'getId') {
          this.expect(TK.RPAREN);
          return new GetId();
        }
        // wait/notify/notifyAll sin receptor explícito — usan condición default
        if (name === 'wait') {
          this.expect(TK.RPAREN);
          return new Wait(new LecturaCondicion('_default'));
        }
        if (name === 'notify') {
          this.expect(TK.RPAREN);
          return new Notify(new LecturaCondicion('_default'));
        }
        if (name === 'notifyAll') {
          this.expect(TK.RPAREN);
          return new NotifyAll(new LecturaCondicion('_default'));
        }
        // Función definida por el usuario
        if (this.funciones[name]) {
          const args = [];
          while (!this.check(TK.RPAREN) && !this.check(TK.EOF)) {
            args.push(this.parseExpr());
            this.match(TK.COMMA);
          }
          this.expect(TK.RPAREN);
          return new LlamadaFuncion(name, args, this.funciones);
        }
        // Función desconocida: consumir args y devolver null
        while (!this.check(TK.RPAREN) && !this.check(TK.EOF)) {
          this.parseExpr();
          this.match(TK.COMMA);
        }
        this.expect(TK.RPAREN);
        return new Literal(null);
      }

      return new Lectura(name);
    }

    throw ErrorSimulador.parse(
      `Token inesperado: '${tok.value}'`,
      tok.line
    );
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

export function parsear(textoRaw, mem, consola, limiteRepeticiones) {
  // Primera pasada: obtener globals, threads, funciones y clases
  const tokens    = new Lexer(textoRaw).tokenize();
  const funciones = {};
  const clases    = {};
  const monitores = {};
  const parser = new Parser(tokens, mem, consola, limiteRepeticiones, funciones, clases, monitores);
  const { globals, threads } = parser.parseProgram();

  // Inicializar variables globales (incluye instancias creadas eager)
  for (const { name, value } of globals) {
    if (value !== undefined) mem.agregarVariable(name, value);
  }

  // Crear hilos
  let idThread = 0;
  const hilos = [];

  for (let ti = 0; ti < threads.length; ti++) {
    const threadDef = threads[ti];

    // process Nombre(c1, c2) { ... } — 1 hilo, canales inyectados como locales
    if (threadDef.tipo === 'process') {
      const { nombre, params } = threadDef;
      const tokensCopia   = new Lexer(textoRaw).tokenize();
      const funcionesCopia = {};
      const clasesCopia    = {};
      const monitoresCopia = {};
      const parserCopia    = new Parser(tokensCopia, mem, consola, limiteRepeticiones, funcionesCopia, clasesCopia, monitoresCopia);
      const { threads: threadsCopia } = parserCopia.parseProgram();
      const memLocal = new Memoria();
      // Inyectar cada canal como variable local con el mismo nombre
      for (const p of params) {
        if (mem.hayVariable(p)) memLocal.agregarVariable(p, mem.verValor(p));
      }
      hilos.push(new Hilo(
        idThread++,
        memLocal,
        mem,
        threadsCopia[ti].instrucciones,
        funcionesCopia,
        nombre ?? null,
        clasesCopia,
        monitoresCopia,
      ));
      continue;
    }

    // Thread(N) o Thread(N, 'nombre') — N hilos
    const { rawNum, nombre } = threadDef;
    const num = (typeof rawNum === 'number' || !isNaN(Number(rawNum)))
      ? Number(rawNum)
      : mem.verValor(rawNum);

    for (let i = 0; i < num; i++) {
      // Re-parsear por cada hilo para que cada uno tenga sus propias
      // instancias de instrucción y no compartan estado (resuelto, resultado, etc.)
      // Tanto funciones como clases se re-parsean: sus instrucciones son estado mutable.
      const tokensCopia    = new Lexer(textoRaw).tokenize();
      const funcionesCopia  = {};
      const clasesCopia     = {};
      const monitoresCopia  = {};
      const parserCopia     = new Parser(tokensCopia, mem, consola, limiteRepeticiones, funcionesCopia, clasesCopia, monitoresCopia);
      const { threads: threadsCopia } = parserCopia.parseProgram();
      hilos.push(new Hilo(
        idThread++,
        new Memoria(),
        mem,
        threadsCopia[ti].instrucciones,
        funcionesCopia,
        nombre ?? null,
        clasesCopia,
        monitoresCopia,
      ));
    }
  }

  return hilos;
}

// Mantenida para compatibilidad con DeclaracionVariableLocal
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
    mem.agregarVariable(vari[0], vari[1] === "true");
  }
  if (string.startsWith("List")) {
    const vari = string.substring(4).replace(";", "").split("=");
    mem.agregarVariable(vari[0], eval(vari[1]));
  }
}
