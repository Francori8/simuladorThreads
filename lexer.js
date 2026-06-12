// ─── Token ───────────────────────────────────────────────────────────────────

export const TK = Object.freeze({
  // Puntuación extra
  COLON: "COLON",
  // Literales
  NUMBER: "NUMBER",
  STRING: "STRING",
  BOOL:   "BOOL",

  // Tipos / keywords
  TYPE_INT:       "TYPE_INT",
  TYPE_BOOL:      "TYPE_BOOL",
  TYPE_STRING:    "TYPE_STRING",
  TYPE_LIST:      "TYPE_LIST",
  TYPE_SEMAPHORE: "TYPE_SEMAPHORE",
  TYPE_CHANNEL:   "TYPE_CHANNEL",
  PROCESS:        "PROCESS",

  // Keywords de control
  IF:      "IF",
  ELSE:    "ELSE",
  WHILE:   "WHILE",
  FOR:     "FOR",
  FOREACH: "FOREACH",
  REPEAT:  "REPEAT",
  RETURN:  "RETURN",

  // Keywords de scope
  GLOBAL: "GLOBAL",
  LOCAL:  "LOCAL",

  // Keywords OOP
  CLASS:       "CLASS",
  NEW:         "NEW",
  THIS:        "THIS",
  CONSTRUCTOR: "CONSTRUCTOR",
  MONITOR:     "MONITOR",
  CONDITION:   "CONDITION",

  // Keywords Thread / Function
  THREAD:   "THREAD",
  FUNCTION: "FUNCTION",

  // Identificador genérico
  IDENT: "IDENT",

  // Operadores aritméticos
  PLUS:    "PLUS",
  MINUS:   "MINUS",
  STAR:    "STAR",
  SLASH:   "SLASH",
  PERCENT: "PERCENT",

  // Operadores de comparación
  EQ:  "EQ",   // ==
  NEQ: "NEQ",  // !=
  LT:  "LT",   // <
  GT:  "GT",   // >
  LTE: "LTE",  // <=
  GTE: "GTE",  // >=

  // Operadores lógicos
  AND: "AND",  // &&
  OR:  "OR",   // ||
  NOT: "NOT",  // !

  // Asignación
  ASSIGN: "ASSIGN",  // =

  // Delimitadores
  LPAREN:   "LPAREN",    // (
  RPAREN:   "RPAREN",    // )
  LBRACKET: "LBRACKET",  // [
  RBRACKET: "RBRACKET",  // ]
  LBRACE:   "LBRACE",    // {
  RBRACE:   "RBRACE",    // }

  // Puntuación
  COMMA:     "COMMA",      // ,
  DOT:       "DOT",        // .
  SEMICOLON: "SEMICOLON",  // ;

  EOF: "EOF",
});

const KEYWORDS = {
  "Int":       TK.TYPE_INT,
  "Bool":      TK.TYPE_BOOL,
  "String":    TK.TYPE_STRING,
  "List":      TK.TYPE_LIST,
  "Semaphore": TK.TYPE_SEMAPHORE,
  "Channel":   TK.TYPE_CHANNEL,
  "process":   TK.PROCESS,
  "Request":   TK.IDENT, // se maneja como IDENT, el parser lo detecta por nombre
  "acquire":   TK.IDENT,
  "release":   TK.IDENT,
  "if":      TK.IF,
  "else":    TK.ELSE,
  "while":   TK.WHILE,
  "for":     TK.FOR,
  "foreach": TK.FOREACH,
  "repeat":  TK.REPEAT,
  "return":  TK.RETURN,
  "global":  TK.GLOBAL,
  "local":   TK.LOCAL,
  "class":       TK.CLASS,
  "new":         TK.NEW,
  "this":        TK.THIS,
  "constructor": TK.CONSTRUCTOR,
  "monitor":     TK.MONITOR,
  "condition":   TK.CONDITION,
  "Thread":   TK.THREAD,
  "function": TK.FUNCTION,
  "true":    TK.BOOL,
  "false":   TK.BOOL,
};

export class Token {
  constructor(type, value, line) {
    this.type  = type;
    this.value = value;
    this.line  = line;
  }

  toString() {
    return `Token(${this.type}, ${JSON.stringify(this.value)}, line:${this.line})`;
  }
}

// ─── Lexer ────────────────────────────────────────────────────────────────────

export class Lexer {
  constructor(source) {
    this.source  = source;
    this.pos     = 0;
    this.line    = 1;
    this.tokens  = [];
  }

  // ── Helpers de navegación ──────────────────────────────────────────────────

  /** Carácter actual sin consumir */
  peek() {
    return this.pos < this.source.length ? this.source[this.pos] : null;
  }

  /** Carácter siguiente sin consumir (lookahead de 1) */
  peekNext() {
    return this.pos + 1 < this.source.length ? this.source[this.pos + 1] : null;
  }

  /** Consume y devuelve el carácter actual */
  advance() {
    const ch = this.source[this.pos++];
    if (ch === "\n") this.line++;
    return ch;
  }

  /** Consume solo si el carácter actual coincide con `expected` */
  match(expected) {
    if (this.peek() !== expected) return false;
    this.advance();
    return true;
  }

  emit(type, value) {
    this.tokens.push(new Token(type, value, this.line));
  }

  // ── Escaneo de tipos concretos ─────────────────────────────────────────────

  readNumber() {
    let start = this.pos - 1;  // ya consumimos el primer dígito
    while (this.peek() !== null && /\d/.test(this.peek())) this.advance();
    const raw = this.source.slice(start, this.pos);
    this.emit(TK.NUMBER, parseInt(raw, 10));
  }

  readString(closeChar = '"') {
    let value = "";
    while (this.peek() !== null && this.peek() !== closeChar) {
      value += this.advance();
    }
    if (this.peek() === closeChar) this.advance();
    this.emit(TK.STRING, value);
  }

  readIdent() {
    let start = this.pos - 1;
    while (this.peek() !== null && /[\w]/.test(this.peek())) this.advance();
    const word = this.source.slice(start, this.pos);
    const type = KEYWORDS[word] ?? TK.IDENT;
    // Para BOOL guardamos el valor booleano directamente
    const value = type === TK.BOOL ? word === "true" : word;
    this.emit(type, value);
  }

  // ── Punto de entrada ───────────────────────────────────────────────────────

  tokenize() {
    while (this.pos < this.source.length) {
      const ch = this.advance();

      // Espacios y saltos de línea
      if (/\s/.test(ch)) continue;

      // Comentarios de línea: //
      if (ch === "/" && this.peek() === "/") {
        while (this.peek() !== null && this.peek() !== "\n") this.advance();
        continue;
      }

      // Números
      if (/\d/.test(ch)) { this.readNumber(); continue; }

      // Strings
      if (ch === '"') { this.readString('"'); continue; }
      if (ch === "'") { this.readString("'"); continue; }

      // Identificadores y keywords
      if (/[a-zA-Z_]/.test(ch)) { this.readIdent(); continue; }

      // Operadores y delimitadores
      switch (ch) {
        case "+": this.emit(TK.PLUS,    ch); break;
        case "-": this.emit(TK.MINUS,   ch); break;
        case "*": this.emit(TK.STAR,    ch); break;
        case "/": this.emit(TK.SLASH,   ch); break;
        case "%": this.emit(TK.PERCENT, ch); break;

        case "=": this.emit(this.match("=") ? TK.EQ     : TK.ASSIGN, ch); break;
        case "!": this.emit(this.match("=") ? TK.NEQ    : TK.NOT,    ch); break;
        case "<": this.emit(this.match("=") ? TK.LTE    : TK.LT,     ch); break;
        case ">": this.emit(this.match("=") ? TK.GTE    : TK.GT,     ch); break;
        case "&": if (this.match("&")) this.emit(TK.AND, "&&"); break;
        case "|": if (this.match("|")) this.emit(TK.OR,  "||"); break;

        case "(": this.emit(TK.LPAREN,   ch); break;
        case ")": this.emit(TK.RPAREN,   ch); break;
        case "[": this.emit(TK.LBRACKET, ch); break;
        case "]": this.emit(TK.RBRACKET, ch); break;
        case "{": this.emit(TK.LBRACE,   ch); break;
        case "}": this.emit(TK.RBRACE,   ch); break;

        case ",": this.emit(TK.COMMA,     ch); break;
        case ".": this.emit(TK.DOT,       ch); break;
        case ";": this.emit(TK.SEMICOLON, ch); break;
        case ":": this.emit(TK.COLON,     ch); break;

        default:
          console.warn(`Lexer: carácter desconocido '${ch}' en línea ${this.line}`);
      }
    }

    this.emit(TK.EOF, null);
    return this.tokens;
  }
}
