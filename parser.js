import { Lexer, TK } from "./lexer.js";
import Memoria from "./memoria.js";
import Hilo from "./hilos.js";
import { Semaphore } from "./semaforo.js";
import { ErrorSimulador } from "./errores.js";
import {
  Sumar, Restar, Multiplicar, Dividir,
  Imprimir, ValorFijo, Literal, ListaLiteral, AccesoMetodo,
  Escritura, Lectura,
  Igualdad, Desigualdad, FinDeBloque, Condicional, Else,
  DeclaracionVariableLocal, InicializarLocal,
  While, Mayor, MayorOIgual, Menor, MenorOIgual,
  YLogico, OLogico, Repeat, For, ForEach,
  LecturaIndexada, EscrituraIndexada, Maximo, Negacion, GetId,
  LlamadaFuncion, Return,
  Acquire, Release,
} from "./instrucciones.js";

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
  constructor(tokens, mem, consola, limite, funciones = {}) {
    this.tokens    = tokens;
    this.pos       = 0;
    this.mem       = mem;
    this.consola   = consola;
    this.limite    = limite;
    this.funciones = funciones; // tabla compartida: nombre -> { params, instrucciones }
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
           type === TK.TYPE_SEMAPHORE;
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
      } else {
        this.advance();
      }
    }

    return { globals, threads };
  }

  parseGlobalDecl() {
    const typeTok = this.advance(); // consume type keyword

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

    const name = this.expect(TK.IDENT).value;
    let value;
    if (this.match(TK.ASSIGN)) value = this.parseLiteralValue();
    this.match(TK.SEMICOLON);
    return { name, value };
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

    // Consume tipo opcional
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
        if (this.match(TK.LPAREN)) {
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
        } else {
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
  // Primera pasada: obtener globals, threads y construir la tabla de funciones
  const tokens = new Lexer(textoRaw).tokenize();
  const funciones = {}; // tabla compartida entre todos los hilos
  const parser = new Parser(tokens, mem, consola, limiteRepeticiones, funciones);
  const { globals, threads } = parser.parseProgram();

  // Inicializar variables globales
  for (const { name, value } of globals) {
    if (value !== undefined) mem.agregarVariable(name, value);
  }

  // Crear hilos
  let idThread = 0;
  const hilos = [];

  for (let ti = 0; ti < threads.length; ti++) {
    const { rawNum, nombre } = threads[ti];
    const num = (typeof rawNum === 'number' || !isNaN(Number(rawNum)))
      ? Number(rawNum)
      : mem.verValor(rawNum);

    for (let i = 0; i < num; i++) {
      // Re-parsear por cada hilo para que cada uno tenga sus propias
      // instancias de instrucción y no compartan estado (resuelto, resultado, etc.)
      // Se pasa la misma tabla de funciones para que las llamadas la encuentren,
      // pero cada hilo re-parsea las instrucciones de su bloque Thread.
      const tokensCopia = new Lexer(textoRaw).tokenize();
      const funcionesCopia = {}; // las instrucciones de funciones también se re-parsean
      const parserCopia = new Parser(tokensCopia, mem, consola, limiteRepeticiones, funcionesCopia);
      const { threads: threadsCopia } = parserCopia.parseProgram();
      hilos.push(new Hilo(
        idThread++,
        new Memoria(),
        mem,
        threadsCopia[ti].instrucciones,
        funcionesCopia,  // cada hilo tiene su propia copia de las instrucciones de funciones
        nombre ?? null
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
