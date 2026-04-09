//* Libraries imports
import { describe, it, expect } from 'vitest';

//* Parser imports
import { Lexer } from '../lexer';
import { TokenKind } from '../types';

function kinds(source: string): TokenKind[] {
  return new Lexer(source).tokenize().map((t) => t.kind);
}

function values(source: string): string[] {
  return new Lexer(source).tokenize().map((t) => t.value);
}

describe('Lexer', () => {
  it('tokenizes an empty string as just EOF', () => {
    expect(kinds('')).toEqual([TokenKind.EOF]);
  });

  it('tokenizes identifiers', () => {
    expect(values('hello world')).toEqual(['hello', 'world', '']);
    expect(kinds('hello world')).toEqual([
      TokenKind.Identifier,
      TokenKind.Identifier,
      TokenKind.EOF,
    ]);
  });

  it('tokenizes integer literals', () => {
    expect(values('0 42 100')).toEqual(['0', '42', '100', '']);
    expect(kinds('0 42 100')).toEqual([
      TokenKind.Integer,
      TokenKind.Integer,
      TokenKind.Integer,
      TokenKind.EOF,
    ]);
  });

  it('tokenizes float literals', () => {
    expect(values('3.14 0.5')).toEqual(['3.14', '0.5', '']);
    expect(kinds('3.14 0.5')).toEqual([
      TokenKind.Float,
      TokenKind.Float,
      TokenKind.EOF,
    ]);
  });

  it('tokenizes boolean literals', () => {
    expect(values('true false')).toEqual(['true', 'false', '']);
    expect(kinds('true false')).toEqual([
      TokenKind.Boolean,
      TokenKind.Boolean,
      TokenKind.EOF,
    ]);
  });

  it('tokenizes string literals', () => {
    const tokens = new Lexer('"hello" "world"').tokenize();
    expect(tokens[0]!.kind).toBe(TokenKind.String);
    expect(tokens[0]!.value).toBe('hello');
    expect(tokens[1]!.kind).toBe(TokenKind.String);
    expect(tokens[1]!.value).toBe('world');
  });

  it('tokenizes punctuation', () => {
    expect(kinds('{ } ( ) [ ] : = . < > & *')).toEqual([
      TokenKind.LeftBrace,
      TokenKind.RightBrace,
      TokenKind.LeftParen,
      TokenKind.RightParen,
      TokenKind.LeftBracket,
      TokenKind.RightBracket,
      TokenKind.Colon,
      TokenKind.Equals,
      TokenKind.Dot,
      TokenKind.LessThan,
      TokenKind.GreaterThan,
      TokenKind.Ampersand,
      TokenKind.Asterisk,
      TokenKind.EOF,
    ]);
  });

  it('tokenizes double-colon', () => {
    expect(kinds('::')).toEqual([TokenKind.DoubleColon, TokenKind.EOF]);
  });

  it('tokenizes ellipsis', () => {
    expect(kinds('...')).toEqual([TokenKind.Ellipsis, TokenKind.EOF]);
  });

  it('skips line comments', () => {
    expect(values('a // comment\nb')).toEqual(['a', 'b', '']);
  });

  it('skips block comments', () => {
    expect(values('a /* block */ b')).toEqual(['a', 'b', '']);
  });

  it('tracks line positions across newlines', () => {
    const tokens = new Lexer('a\nb\nc').tokenize();
    expect(tokens[0]!.range.start.line).toBe(0);
    expect(tokens[1]!.range.start.line).toBe(1);
    expect(tokens[2]!.range.start.line).toBe(2);
  });

  it('tokenizes a declaration: x:i32 = 10', () => {
    expect(kinds('x:i32 = 10')).toEqual([
      TokenKind.Identifier,
      TokenKind.Colon,
      TokenKind.Identifier,
      TokenKind.Equals,
      TokenKind.Integer,
      TokenKind.EOF,
    ]);
  });

  it('tokenizes a call expression: print(x)', () => {
    expect(kinds('print(x)')).toEqual([
      TokenKind.Identifier,
      TokenKind.LeftParen,
      TokenKind.Identifier,
      TokenKind.RightParen,
      TokenKind.EOF,
    ]);
  });

  it('tokenizes main block opening', () => {
    expect(values('main {')).toEqual(['main', '{', '']);
  });

  it('tokenizes negative number as minus + integer', () => {
    expect(kinds('-42')).toEqual([
      TokenKind.Minus,
      TokenKind.Integer,
      TokenKind.EOF,
    ]);
  });
});
