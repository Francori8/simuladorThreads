import { test } from "node:test";
import assert from "node:assert/strict";
import { Lexer, TK } from "../lexer.js";

function tipos(codigo) {
  return new Lexer(codigo).tokenize().map(t => t.type);
}

test("tokeniza una declaración global simple", () => {
  const tokens = tipos("global Int n = 0");
  assert.deepEqual(tokens, [TK.GLOBAL, TK.TYPE_INT, TK.IDENT, TK.ASSIGN, TK.NUMBER, TK.EOF]);
});

test("distingue operadores de uno y dos caracteres", () => {
  assert.deepEqual(tipos("=="), [TK.EQ, TK.EOF]);
  assert.deepEqual(tipos("="), [TK.ASSIGN, TK.EOF]);
  assert.deepEqual(tipos("!="), [TK.NEQ, TK.EOF]);
  assert.deepEqual(tipos("!"), [TK.NOT, TK.EOF]);
  assert.deepEqual(tipos("&&"), [TK.AND, TK.EOF]);
  assert.deepEqual(tipos("||"), [TK.OR, TK.EOF]);
});

test("ignora comentarios de línea", () => {
  const tokens = tipos("global Int n = 1 // esto es un comentario\n");
  assert.deepEqual(tokens, [TK.GLOBAL, TK.TYPE_INT, TK.IDENT, TK.ASSIGN, TK.NUMBER, TK.EOF]);
});

test("lee strings con comillas simples y dobles", () => {
  const conDobles = new Lexer('"hola"').tokenize();
  const conSimples = new Lexer("'hola'").tokenize();
  assert.equal(conDobles[0].type, TK.STRING);
  assert.equal(conDobles[0].value, "hola");
  assert.equal(conSimples[0].value, "hola");
});

test("reconoce booleanos como valores literales, no identificadores", () => {
  const [tok] = new Lexer("true").tokenize();
  assert.equal(tok.type, TK.BOOL);
  assert.equal(tok.value, true);
});

test("lleva la cuenta de líneas para reportar errores con contexto", () => {
  const tokens = new Lexer("global Int n = 0\nglobal Int m = 1").tokenize();
  const segundoGlobal = tokens.find((t, i) => t.type === TK.GLOBAL && i > 0);
  assert.equal(segundoGlobal.line, 2);
});
