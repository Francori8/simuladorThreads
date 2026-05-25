import { Lexer, TK } from "./lexer.js";
import Memoria from "./memoria.js";
import Hilo from "./hilos.js";
import {
  Sumar, Restar, Multiplicar, Dividir,
  Imprimir, ValorFijo, Literal, ListaLiteral, AccesoMetodo,
  Escritura, Lectura,
  Igualdad, Desigualdad, FinDeBloque, Condicional, Else,
  DeclaracionVariableLocal, InicializarLocal,
  While, Mayor, MayorOIgual, Menor, MenorOIgual,
  YLogico, OLogico, Repeat, For, ForEach,
  LecturaIndexada, EscrituraIndexada, Maximo, Negacion, GetId,
} from "./instrucciones.js";

// ─── Parser recursivo descendente ────────────────────────────────────────────

class Parser {
  constructor(tokens, mem, consola, limite) {
    this.tokens  = tokens;
    this.pos     = 0;
    this.mem     = mem;
    this.consola = consola;
    this.limite  = limite;
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
      throw new Error(`Parser (línea ${tok.line}): se esperaba '${type}' pero se encontró '${tok.type}' (${JSON.stringify(tok.value)})`);
    return this.advance();
  }

  isType(type) {
    return type === TK.TYPE_INT || type === TK.TYPE_BOOL ||
           type === TK.TYPE_STRING || type === TK.TYPE_LIST;
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
      } else {
        this.advance();
      }
    }

    return { globals, threads };
  }

  parseGlobalDecl() {
    this.advance(); // consume type keyword (Int, Bool, String, List)
    const name = this.expect(TK.IDENT).value;
    let value;
    if (this.match(TK.ASSIGN)) value = this.parseLiteralValue();
    this.match(TK.SEMICOLON);
    return { name, value };
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
    throw new Error(`Parser (línea ${tok.line}): literal inválido: ${tok.type}`);
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
        expr = new AccesoMetodo(expr, method, args);

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

    // Fallback: consumir y devolver null
    console.warn(`Parser: token inesperado ${tok.type} ('${tok.value}') en línea ${tok.line}`);
    this.advance();
    return new Literal(null);
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

export function parsear(textoRaw, mem, consola, limiteRepeticiones) {
  const tokens = new Lexer(textoRaw).tokenize();
  const parser = new Parser(tokens, mem, consola, limiteRepeticiones);
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
      const tokensCopia = new Lexer(textoRaw).tokenize();
      const parserCopia = new Parser(tokensCopia, mem, consola, limiteRepeticiones);
      const { threads: threadsCopia } = parserCopia.parseProgram();
      hilos.push(new Hilo(
        idThread++,
        new Memoria(),
        mem,
        threadsCopia[ti].instrucciones,
        nombre
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
