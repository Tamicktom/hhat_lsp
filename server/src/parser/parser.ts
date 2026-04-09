//* ------------------------------------------------------------------ *
//* Recursive descent parser for H-hat.
//*
//* Each parse method corresponds to an EBNF production from the
//* grammar files. On parse errors, a diagnostic is recorded and the
//* parser attempts to recover by skipping to the next statement
//* boundary.
//* ------------------------------------------------------------------ *

//* Types imports
import {
  type Token,
  type SourceRange,
  type ParseDiagnostic,
  type ProgramNode,
  type MainBlockNode,
  type StatementNode,
  type DeclarationNode,
  type AssignmentNode,
  type ExpressionNode,
  type CallExpressionNode,
  type IdentifierNode,
  type TypeAnnotationNode,
  type IntegerLiteralNode,
  type FloatLiteralNode,
  type BooleanLiteralNode,
  type StringLiteralNode,
  type ArrayLiteralNode,
  type CastExpressionNode,
  type FunctionDefNode,
  type ConstDefNode,
  type TypeDefNode,
  type TypeMemberNode,
  type ParameterNode,
  type TopLevelDefinition,
  type ReturnNode,
  type ImportNode,
  type ImportCategoryNode,
  type ParseResult,
  TokenKind,
  KEYWORDS,
} from './types';

export class Parser {
  private tokens: Token[];
  private pos = 0;
  private diagnostics: ParseDiagnostic[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  // ── Public API ─────────────────────────────────────────────────

  parse(): ParseResult {
    try {
      const ast = this.parseProgram();
      return { ast, diagnostics: this.diagnostics };
    } catch {
      return { ast: null, diagnostics: this.diagnostics };
    }
  }

  // ── program ────────────────────────────────────────────────────
  // program = imports* ( type_def | consts | group_fns )* main? EOF

  private parseProgram(): ProgramNode {
    const start = this.currentRange().start;
    const imports: ImportNode[] = [];
    const definitions: TopLevelDefinition[] = [];
    let main: MainBlockNode | null = null;

    while (!this.isAtEnd()) {
      if (this.checkKeyword('use')) {
        imports.push(this.parseImport());
      } else if (this.checkKeyword('main')) {
        main = this.parseMainBlock();
      } else if (this.checkKeyword('fn') || this.checkKeyword('metafn') || this.checkKeyword('modifier') || this.checkKeyword('super-type')) {
        definitions.push(this.parseFunctionDef());
      } else if (this.checkKeyword('const')) {
        definitions.push(this.parseConstDef());
      } else if (this.checkKeyword('type')) {
        definitions.push(this.parseTypeDef());
      } else {
        this.error(`Unexpected token "${this.current().value}". Expected a top-level construct (main, fn, type, const, use).`);
        this.advance();
      }
    }

    return {
      type: 'Program',
      imports,
      definitions,
      main,
      range: { start, end: this.currentRange().end },
    };
  }

  // ── imports ────────────────────────────────────────────────────
  // imports = "use" "(" ( type_import | fn_import | ... )+ ")"

  private parseImport(): ImportNode {
    const start = this.currentRange().start;
    this.expectKeyword('use');
    this.expect(TokenKind.LeftParen);

    const categories: ImportCategoryNode[] = [];
    while (!this.check(TokenKind.RightParen) && !this.isAtEnd()) {
      categories.push(this.parseImportCategory());
    }

    this.expect(TokenKind.RightParen);

    return {
      type: 'Import',
      categories,
      range: { start, end: this.previousRange().end },
    };
  }

  private parseImportCategory(): ImportCategoryNode {
    const start = this.currentRange().start;
    const category = this.current().value;
    this.advance(); // category keyword (type, fn, metafn, modifier, super-type, const)
    this.expect(TokenKind.Colon);

    const paths: IdentifierNode[] = [];

    if (this.check(TokenKind.LeftBracket)) {
      this.advance();
      while (!this.check(TokenKind.RightBracket) && !this.isAtEnd()) {
        paths.push(this.parseIdentifier());
        if (this.check(TokenKind.Dot)) {
          this.advance();
          if (this.check(TokenKind.LeftBrace)) {
            this.skipBalanced(TokenKind.LeftBrace, TokenKind.RightBrace);
          }
        }
      }
      this.expect(TokenKind.RightBracket);
    } else {
      paths.push(this.parseIdentifier());
      if (this.check(TokenKind.Dot)) {
        this.advance();
        if (this.check(TokenKind.LeftBrace)) {
          this.skipBalanced(TokenKind.LeftBrace, TokenKind.RightBrace);
        }
      }
    }

    return {
      type: 'ImportCategory',
      category,
      paths,
      range: { start, end: this.previousRange().end },
    };
  }

  // ── main ───────────────────────────────────────────────────────
  // main = "main" body

  private parseMainBlock(): MainBlockNode {
    const start = this.currentRange().start;
    this.expectKeyword('main');
    const body = this.parseBody();

    return {
      type: 'MainBlock',
      body,
      range: { start, end: this.previousRange().end },
    };
  }

  // ── body ───────────────────────────────────────────────────────
  // body = "{" ( declareassign | declare | assign | expr )* "}"

  private parseBody(): StatementNode[] {
    this.expect(TokenKind.LeftBrace);
    const statements: StatementNode[] = [];

    while (!this.check(TokenKind.RightBrace) && !this.isAtEnd()) {
      try {
        statements.push(this.parseStatement());
      } catch {
        this.synchronize();
      }
    }

    this.expect(TokenKind.RightBrace);
    return statements;
  }

  // ── statement ──────────────────────────────────────────────────

  private parseStatement(): StatementNode {
    if (this.check(TokenKind.DoubleColon)) {
      return this.parseReturn();
    }

    if (this.check(TokenKind.Identifier) && !this.isKeywordAt(this.pos)) {
      return this.parseDeclarationOrAssignmentOrExpr();
    }

    return this.parseExpression();
  }

  // declareassign = simple_id modifier? ":" type_id "=" expr
  // declare       = simple_id modifier? ":" type_id
  // assign        = full_id "=" expr
  // (or bare expression)
  private parseDeclarationOrAssignmentOrExpr(): StatementNode {
    const start = this.currentRange().start;
    const id = this.parseIdentifier();

    // Declaration: name : type (= expr)?
    if (this.check(TokenKind.Colon)) {
      this.advance();
      const typeAnn = this.parseTypeAnnotation();

      if (this.check(TokenKind.Equals)) {
        this.advance();
        const init = this.parseExpression();
        return {
          type: 'Declaration',
          name: id,
          typeAnnotation: typeAnn,
          initializer: init,
          range: { start, end: this.previousRange().end },
        } satisfies DeclarationNode;
      }

      return {
        type: 'Declaration',
        name: id,
        typeAnnotation: typeAnn,
        initializer: null,
        range: { start, end: this.previousRange().end },
      } satisfies DeclarationNode;
    }

    // Assignment: name = expr
    if (this.check(TokenKind.Equals)) {
      this.advance();
      const value = this.parseExpression();
      return {
        type: 'Assignment',
        target: id,
        value,
        range: { start, end: this.previousRange().end },
      } satisfies AssignmentNode;
    }

    // Call expression: name ( args )
    if (this.check(TokenKind.LeftParen)) {
      return this.parseCallExpression(id);
    }

    // Bare identifier (expression statement)
    return id;
  }

  // ── fn_return ──────────────────────────────────────────────────
  // fn_return = "::" expr

  private parseReturn(): ReturnNode {
    const start = this.currentRange().start;
    this.expect(TokenKind.DoubleColon);
    const value = this.parseExpression();

    return {
      type: 'Return',
      value,
      range: { start, end: this.previousRange().end },
    };
  }

  // ── expression ─────────────────────────────────────────────────
  // expr = cast | call | array | full_id | literal

  private parseExpression(): ExpressionNode {
    let expr = this.parsePrimaryExpression();

    // cast: expr "*" type_id
    if (this.check(TokenKind.Asterisk)) {
      const start = expr.range.start;
      this.advance();
      const targetType = this.parseTypeAnnotation();
      expr = {
        type: 'CastExpression',
        expression: expr,
        targetType,
        range: { start, end: this.previousRange().end },
      } satisfies CastExpressionNode;
    }

    return expr;
  }

  private parsePrimaryExpression(): ExpressionNode {
    // Array literal: [ ... ]
    if (this.check(TokenKind.LeftBracket)) {
      return this.parseArrayLiteral();
    }

    // String literal
    if (this.check(TokenKind.String)) {
      return this.parseStringLiteral();
    }

    // Boolean literal
    if (this.check(TokenKind.Boolean)) {
      return this.parseBooleanLiteral();
    }

    // Numeric literal (possibly negative: Minus + Integer/Float)
    if (this.check(TokenKind.Minus) && (this.peekIs(1, TokenKind.Integer) || this.peekIs(1, TokenKind.Float))) {
      return this.parseNumericLiteral();
    }

    if (this.check(TokenKind.Integer) || this.check(TokenKind.Float)) {
      return this.parseNumericLiteral();
    }

    // Identifier (possibly followed by a call)
    if (this.check(TokenKind.Identifier)) {
      const id = this.parseIdentifier();
      if (this.check(TokenKind.LeftParen)) {
        return this.parseCallExpression(id);
      }
      return id;
    }

    this.error(`Unexpected token "${this.current().value}". Expected an expression.`);
    const bad = this.current();
    this.advance();
    return {
      type: 'Identifier',
      name: bad.value,
      range: bad.range,
    };
  }

  // ── call ───────────────────────────────────────────────────────
  // call = full_id "(" args* ")"

  private parseCallExpression(callee: IdentifierNode): CallExpressionNode {
    const start = callee.range.start;
    this.expect(TokenKind.LeftParen);
    const args: ExpressionNode[] = [];

    while (!this.check(TokenKind.RightParen) && !this.isAtEnd()) {
      args.push(this.parseExpression());
      // Allow optional comma separators
      if (this.check(TokenKind.Identifier) && this.current().value === ',') {
        this.advance();
      }
    }

    this.expect(TokenKind.RightParen);

    // call_bdn: call followed by body
    if (this.check(TokenKind.LeftBrace)) {
      this.skipBalanced(TokenKind.LeftBrace, TokenKind.RightBrace);
    }

    return {
      type: 'CallExpression',
      callee,
      arguments: args,
      range: { start, end: this.previousRange().end },
    };
  }

  // ── literals ───────────────────────────────────────────────────

  private parseNumericLiteral(): IntegerLiteralNode | FloatLiteralNode {
    let negative = false;
    const start = this.currentRange().start;

    if (this.check(TokenKind.Minus)) {
      negative = true;
      this.advance();
    }

    const token = this.current();
    this.advance();

    const raw = negative ? `-${token.value}` : token.value;
    const numericValue = Number(raw);

    if (token.kind === TokenKind.Float) {
      return {
        type: 'FloatLiteral',
        value: numericValue,
        raw,
        range: { start, end: this.previousRange().end },
      };
    }

    return {
      type: 'IntegerLiteral',
      value: numericValue,
      raw,
      range: { start, end: this.previousRange().end },
    };
  }

  private parseBooleanLiteral(): BooleanLiteralNode {
    const token = this.current();
    this.advance();
    return {
      type: 'BooleanLiteral',
      value: token.value === 'true',
      range: token.range,
    };
  }

  private parseStringLiteral(): StringLiteralNode {
    const token = this.current();
    this.advance();
    return {
      type: 'StringLiteral',
      value: token.value,
      range: token.range,
    };
  }

  private parseArrayLiteral(): ArrayLiteralNode {
    const start = this.currentRange().start;
    this.expect(TokenKind.LeftBracket);
    const elements: ExpressionNode[] = [];

    while (!this.check(TokenKind.RightBracket) && !this.isAtEnd()) {
      elements.push(this.parseExpression());
    }

    this.expect(TokenKind.RightBracket);
    return {
      type: 'ArrayLiteral',
      elements,
      range: { start, end: this.previousRange().end },
    };
  }

  // ── type_id ────────────────────────────────────────────────────
  // type_id = ( "[" full_id "]" ) | full_id

  private parseTypeAnnotation(): TypeAnnotationNode {
    const start = this.currentRange().start;

    if (this.check(TokenKind.LeftBracket)) {
      this.advance();
      const name = this.current().value;
      this.expect(TokenKind.Identifier);
      this.expect(TokenKind.RightBracket);
      return {
        type: 'TypeAnnotation',
        name,
        isArray: true,
        range: { start, end: this.previousRange().end },
      };
    }

    const name = this.current().value;
    this.expect(TokenKind.Identifier);
    return {
      type: 'TypeAnnotation',
      name,
      isArray: false,
      range: { start, end: this.previousRange().end },
    };
  }

  // ── identifier ─────────────────────────────────────────────────

  private parseIdentifier(): IdentifierNode {
    const token = this.current();
    this.expect(TokenKind.Identifier);
    return {
      type: 'Identifier',
      name: token.value,
      range: token.range,
    };
  }

  // ── function definitions ───────────────────────────────────────
  // fn_def = "fn" ( simple_id | pointer ) fn_args type_id? fn_body

  private parseFunctionDef(): FunctionDefNode {
    const start = this.currentRange().start;
    const kindToken = this.current();
    const kind = kindToken.value as FunctionDefNode['kind'];
    this.advance(); // fn | metafn | modifier | super-type

    const name = this.parseIdentifier();

    let params: ParameterNode[] = [];
    if (this.check(TokenKind.LeftParen)) {
      params = this.parseFnArgs();
    }

    let returnType: TypeAnnotationNode | null = null;
    if (this.check(TokenKind.Identifier) && !this.isAtEnd()) {
      const next = this.current();
      if (next.kind === TokenKind.Identifier && !this.check(TokenKind.LeftBrace)) {
        returnType = this.parseTypeAnnotation();
      }
    }

    const body = this.parseBody();

    return {
      type: 'FunctionDef',
      kind,
      name,
      params,
      returnType,
      body,
      range: { start, end: this.previousRange().end },
    };
  }

  // fn_args = "(" argtype* ")"
  // argtype = full_id ":" type_id

  private parseFnArgs(): ParameterNode[] {
    this.expect(TokenKind.LeftParen);
    const params: ParameterNode[] = [];

    while (!this.check(TokenKind.RightParen) && !this.isAtEnd()) {
      // Skip "self" keyword in modifier args
      if (this.current().value === 'self') {
        this.advance();
        continue;
      }

      const paramStart = this.currentRange().start;
      const name = this.parseIdentifier();
      this.expect(TokenKind.Colon);
      const typeAnn = this.parseTypeAnnotation();

      params.push({
        type: 'Parameter',
        name,
        typeAnnotation: typeAnn,
        range: { start: paramStart, end: this.previousRange().end },
      });
    }

    this.expect(TokenKind.RightParen);
    return params;
  }

  // ── const definition ───────────────────────────────────────────
  // consts = "const" simple_id ":" type_id "=" expr

  private parseConstDef(): ConstDefNode {
    const start = this.currentRange().start;
    this.expectKeyword('const');
    const name = this.parseIdentifier();
    this.expect(TokenKind.Colon);
    const typeAnn = this.parseTypeAnnotation();
    this.expect(TokenKind.Equals);
    const init = this.parseExpression();

    return {
      type: 'ConstDef',
      name,
      typeAnnotation: typeAnn,
      initializer: init,
      range: { start, end: this.previousRange().end },
    };
  }

  // ── type definition ────────────────────────────────────────────
  // type_def = "type" ( type_struct | type_enum )

  private parseTypeDef(): TypeDefNode {
    const start = this.currentRange().start;
    this.expectKeyword('type');
    const name = this.parseIdentifier();
    this.expect(TokenKind.LeftBrace);

    const members: TypeMemberNode[] = [];
    while (!this.check(TokenKind.RightBrace) && !this.isAtEnd()) {
      const memberStart = this.currentRange().start;
      const memberName = this.parseIdentifier();
      let typeAnn: TypeAnnotationNode | null = null;

      if (this.check(TokenKind.Colon)) {
        this.advance();
        typeAnn = this.parseTypeAnnotation();
      }

      members.push({
        type: 'TypeMember',
        name: memberName,
        typeAnnotation: typeAnn,
        range: { start: memberStart, end: this.previousRange().end },
      });
    }

    this.expect(TokenKind.RightBrace);

    return {
      type: 'TypeDef',
      name,
      members,
      range: { start, end: this.previousRange().end },
    };
  }

  // ── Token helpers ──────────────────────────────────────────────

  private current(): Token {
    return this.tokens[this.pos] ?? this.tokens[this.tokens.length - 1]!;
  }

  private previous(): Token {
    return this.tokens[this.pos - 1] ?? this.tokens[0]!;
  }

  private currentRange(): SourceRange {
    return this.current().range;
  }

  private previousRange(): SourceRange {
    return this.previous().range;
  }

  private advance(): Token {
    const token = this.current();
    if (!this.isAtEnd()) this.pos++;
    return token;
  }

  private check(kind: TokenKind): boolean {
    return this.current().kind === kind;
  }

  private checkKeyword(keyword: string): boolean {
    const t = this.current();
    return t.kind === TokenKind.Identifier && t.value === keyword;
  }

  private isKeywordAt(index: number): boolean {
    const t = this.tokens[index];
    return t !== undefined && t.kind === TokenKind.Identifier && KEYWORDS.has(t.value);
  }

  private peekIs(offset: number, kind: TokenKind): boolean {
    const t = this.tokens[this.pos + offset];
    return t !== undefined && t.kind === kind;
  }

  private isAtEnd(): boolean {
    return this.current().kind === TokenKind.EOF;
  }

  private expect(kind: TokenKind): Token {
    if (this.check(kind)) {
      return this.advance();
    }
    this.error(`Expected ${kind}, got "${this.current().value}" (${this.current().kind}).`);
    return this.current();
  }

  private expectKeyword(keyword: string): Token {
    if (this.checkKeyword(keyword)) {
      return this.advance();
    }
    this.error(`Expected keyword "${keyword}", got "${this.current().value}".`);
    return this.current();
  }

  private error(message: string): void {
    this.diagnostics.push({
      message,
      range: this.currentRange(),
      severity: 'error',
    });
  }

  private synchronize(): void {
    while (!this.isAtEnd()) {
      if (this.check(TokenKind.RightBrace)) return;
      if (this.isKeywordAt(this.pos)) return;
      if (this.check(TokenKind.Identifier) && this.peekIs(1, TokenKind.Colon)) return;
      if (this.check(TokenKind.Identifier) && this.peekIs(1, TokenKind.Equals)) return;
      if (this.check(TokenKind.Identifier) && this.peekIs(1, TokenKind.LeftParen)) return;
      this.advance();
    }
  }

  private skipBalanced(open: TokenKind, close: TokenKind): void {
    let depth = 0;
    if (this.check(open)) {
      depth = 1;
      this.advance();
    }
    while (depth > 0 && !this.isAtEnd()) {
      if (this.check(open)) depth++;
      if (this.check(close)) depth--;
      this.advance();
    }
  }
}
