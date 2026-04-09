//* ------------------------------------------------------------------ *
//* Lexer for H-hat source files.
//* Tokenizes source text into a flat array of Token values.
//* ------------------------------------------------------------------ *

//* Types imports
import {
  type Token,
  type SourcePosition,
  TokenKind,
} from './types';

const SIGILS = new Set(['#', '!', '%', '@']);

export class Lexer {
  private source: string;
  private pos = 0;
  private line = 0;
  private column = 0;

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.source.length) {
      this.skipWhitespaceAndComments();
      if (this.pos >= this.source.length) break;

      const token = this.readToken();
      if (token) tokens.push(token);
    }

    tokens.push({
      kind: TokenKind.EOF,
      value: '',
      range: {
        start: this.position(),
        end: this.position(),
      },
    });

    return tokens;
  }

  // ── Private helpers ──────────────────────────────────────────────

  private readToken(): Token | null {
    const ch = this.current();

    if (ch === '"') return this.readString();

    if (this.isDigit(ch)) return this.readNumber();

    if (this.isIdentStart(ch)) return this.readIdentifierOrKeyword();

    if (SIGILS.has(ch) && this.isAlpha(this.peek(1))) {
      return this.readIdentifierOrKeyword();
    }

    if (SIGILS.has(ch) && this.isDigit(this.peek(1))) {
      return this.readNumber();
    }

    return this.readPunctuation();
  }

  // ── String literal ─────────────────────────────────────────────

  private readString(): Token {
    const start = this.position();
    this.advance(); // opening "

    let value = '';
    while (this.pos < this.source.length && this.current() !== '"') {
      if (this.current() === '\\' && this.pos + 1 < this.source.length) {
        this.advance();
        value += this.current();
      } else {
        value += this.current();
      }
      this.advance();
    }

    if (this.pos < this.source.length) {
      this.advance(); // closing "
    }

    return {
      kind: TokenKind.String,
      value,
      range: { start, end: this.position() },
    };
  }

  // ── Numbers ────────────────────────────────────────────────────

  private readNumber(): Token {
    const start = this.position();
    let raw = '';
    let isFloat = false;

    if (SIGILS.has(this.current())) {
      raw += this.current();
      this.advance();
    }

    while (this.pos < this.source.length && this.isDigit(this.current())) {
      raw += this.current();
      this.advance();
    }

    if (
      this.pos < this.source.length &&
      this.current() === '.' &&
      this.isDigit(this.peek(1))
    ) {
      isFloat = true;
      raw += this.current();
      this.advance(); // .
      while (this.pos < this.source.length && this.isDigit(this.current())) {
        raw += this.current();
        this.advance();
      }
    }

    return {
      kind: isFloat ? TokenKind.Float : TokenKind.Integer,
      value: raw,
      range: { start, end: this.position() },
    };
  }

  // ── Identifiers and keywords ───────────────────────────────────

  private readIdentifierOrKeyword(): Token {
    const start = this.position();
    let value = '';

    if (SIGILS.has(this.current())) {
      value += this.current();
      this.advance();
    }

    while (this.pos < this.source.length && this.isIdentContinue(this.current())) {
      value += this.current();
      this.advance();
    }

    // `super-type` is a hyphenated keyword: if we just read "super" and
    // the next chars are "-type", consume them as part of the identifier.
    if (value === 'super' && this.current() === '-') {
      const saved = this.pos;
      const rest = this.source.slice(this.pos, this.pos + 5);
      if (rest === '-type') {
        value += '-type';
        for (let i = 0; i < 5; i++) this.advance();
      } else {
        this.pos = saved;
      }
    }

    if (value === 'true' || value === 'false') {
      return {
        kind: TokenKind.Boolean,
        value,
        range: { start, end: this.position() },
      };
    }

    return {
      kind: TokenKind.Identifier,
      value,
      range: { start, end: this.position() },
    };
  }

  // ── Punctuation ────────────────────────────────────────────────

  private readPunctuation(): Token {
    const start = this.position();
    const ch = this.current();
    this.advance();

    // Multi-character tokens
    if (ch === ':' && this.current() === ':') {
      this.advance();
      return { kind: TokenKind.DoubleColon, value: '::', range: { start, end: this.position() } };
    }

    if (ch === '.' && this.current() === '.' && this.peek(1) === '.') {
      this.advance();
      this.advance();
      return { kind: TokenKind.Ellipsis, value: '...', range: { start, end: this.position() } };
    }

    const SINGLE_CHAR_TOKENS: Record<string, TokenKind> = {
      '{': TokenKind.LeftBrace,
      '}': TokenKind.RightBrace,
      '(': TokenKind.LeftParen,
      ')': TokenKind.RightParen,
      '[': TokenKind.LeftBracket,
      ']': TokenKind.RightBracket,
      ':': TokenKind.Colon,
      '=': TokenKind.Equals,
      '.': TokenKind.Dot,
      '<': TokenKind.LessThan,
      '>': TokenKind.GreaterThan,
      '&': TokenKind.Ampersand,
      '*': TokenKind.Asterisk,
      '-': TokenKind.Minus,
    };

    const kind = SINGLE_CHAR_TOKENS[ch];
    if (kind) {
      return { kind, value: ch, range: { start, end: this.position() } };
    }

    return {
      kind: TokenKind.Identifier,
      value: ch,
      range: { start, end: this.position() },
    };
  }

  // ── Whitespace and comments ────────────────────────────────────

  private skipWhitespaceAndComments(): void {
    while (this.pos < this.source.length) {
      const ch = this.current();

      if (ch === ' ' || ch === '\t' || ch === '\r') {
        this.advance();
        continue;
      }

      if (ch === '\n') {
        this.advance();
        continue;
      }

      if (ch === '/' && this.peek(1) === '/') {
        while (this.pos < this.source.length && this.current() !== '\n') {
          this.advance();
        }
        continue;
      }

      if (ch === '/' && this.peek(1) === '*') {
        this.advance(); // /
        this.advance(); // *
        while (
          this.pos < this.source.length &&
          !(this.current() === '*' && this.peek(1) === '/')
        ) {
          this.advance();
        }
        if (this.pos < this.source.length) this.advance(); // *
        if (this.pos < this.source.length) this.advance(); // /
        continue;
      }

      break;
    }
  }

  // ── Character helpers ──────────────────────────────────────────

  private current(): string {
    return this.source[this.pos] ?? '\0';
  }

  private peek(offset: number): string {
    return this.source[this.pos + offset] ?? '\0';
  }

  private advance(): void {
    if (this.pos < this.source.length) {
      if (this.source[this.pos] === '\n') {
        this.line++;
        this.column = 0;
      } else {
        this.column++;
      }
      this.pos++;
    }
  }

  private position(): SourcePosition {
    return { line: this.line, column: this.column, offset: this.pos };
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isAlpha(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
  }

  private isIdentStart(ch: string): boolean {
    return this.isAlpha(ch) || ch === '_';
  }

  private isIdentContinue(ch: string): boolean {
    return this.isAlpha(ch) || this.isDigit(ch) || ch === '_';
  }
}
