//* ------------------------------------------------------------------ *
//* Token and AST type definitions for the H-hat parser.
//* ------------------------------------------------------------------ *

// ── Source locations ──────────────────────────────────────────────────

export interface SourcePosition {
  line: number;
  column: number;
  offset: number;
}

export interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}

// ── Tokens ───────────────────────────────────────────────────────────

export enum TokenKind {
  // Literals
  Integer = 'Integer',
  Float = 'Float',
  String = 'String',
  Boolean = 'Boolean',

  // Identifiers (keywords resolved by the parser)
  Identifier = 'Identifier',

  // Punctuation
  LeftBrace = 'LeftBrace',
  RightBrace = 'RightBrace',
  LeftParen = 'LeftParen',
  RightParen = 'RightParen',
  LeftBracket = 'LeftBracket',
  RightBracket = 'RightBracket',
  Colon = 'Colon',
  DoubleColon = 'DoubleColon',
  Equals = 'Equals',
  Dot = 'Dot',
  LessThan = 'LessThan',
  GreaterThan = 'GreaterThan',
  Ampersand = 'Ampersand',
  Asterisk = 'Asterisk',
  Ellipsis = 'Ellipsis',
  Minus = 'Minus',

  // Special
  EOF = 'EOF',
}

export interface Token {
  kind: TokenKind;
  value: string;
  range: SourceRange;
}

// ── Keywords ─────────────────────────────────────────────────────────

export const KEYWORDS = new Set([
  'main',
  'fn',
  'metafn',
  'modifier',
  'super-type',
  'type',
  'const',
  'use',
  'self',
]);

// ── AST nodes ────────────────────────────────────────────────────────

export interface ProgramNode {
  type: 'Program';
  imports: ImportNode[];
  definitions: TopLevelDefinition[];
  main: MainBlockNode | null;
  range: SourceRange;
}

export interface ImportNode {
  type: 'Import';
  categories: ImportCategoryNode[];
  range: SourceRange;
}

export interface ImportCategoryNode {
  type: 'ImportCategory';
  category: string;
  paths: IdentifierNode[];
  range: SourceRange;
}

export interface MainBlockNode {
  type: 'MainBlock';
  body: StatementNode[];
  range: SourceRange;
}

export interface DeclarationNode {
  type: 'Declaration';
  name: IdentifierNode;
  typeAnnotation: TypeAnnotationNode;
  initializer: ExpressionNode | null;
  range: SourceRange;
}

export interface AssignmentNode {
  type: 'Assignment';
  target: IdentifierNode;
  value: ExpressionNode;
  range: SourceRange;
}

export interface FunctionDefNode {
  type: 'FunctionDef';
  kind: 'fn' | 'metafn' | 'modifier' | 'super-type';
  name: IdentifierNode;
  params: ParameterNode[];
  returnType: TypeAnnotationNode | null;
  body: StatementNode[];
  range: SourceRange;
}

export interface ConstDefNode {
  type: 'ConstDef';
  name: IdentifierNode;
  typeAnnotation: TypeAnnotationNode;
  initializer: ExpressionNode;
  range: SourceRange;
}

export interface TypeDefNode {
  type: 'TypeDef';
  name: IdentifierNode;
  members: TypeMemberNode[];
  range: SourceRange;
}

export interface TypeMemberNode {
  type: 'TypeMember';
  name: IdentifierNode;
  typeAnnotation: TypeAnnotationNode | null;
  range: SourceRange;
}

export interface ParameterNode {
  type: 'Parameter';
  name: IdentifierNode;
  typeAnnotation: TypeAnnotationNode;
  range: SourceRange;
}

export interface TypeAnnotationNode {
  type: 'TypeAnnotation';
  name: string;
  isArray: boolean;
  range: SourceRange;
}

export interface CallExpressionNode {
  type: 'CallExpression';
  callee: IdentifierNode;
  arguments: ExpressionNode[];
  range: SourceRange;
}

export interface IdentifierNode {
  type: 'Identifier';
  name: string;
  range: SourceRange;
}

export interface IntegerLiteralNode {
  type: 'IntegerLiteral';
  value: number;
  raw: string;
  range: SourceRange;
}

export interface FloatLiteralNode {
  type: 'FloatLiteral';
  value: number;
  raw: string;
  range: SourceRange;
}

export interface BooleanLiteralNode {
  type: 'BooleanLiteral';
  value: boolean;
  range: SourceRange;
}

export interface StringLiteralNode {
  type: 'StringLiteral';
  value: string;
  range: SourceRange;
}

export interface ArrayLiteralNode {
  type: 'ArrayLiteral';
  elements: ExpressionNode[];
  range: SourceRange;
}

export interface CastExpressionNode {
  type: 'CastExpression';
  expression: ExpressionNode;
  targetType: TypeAnnotationNode;
  range: SourceRange;
}

export interface ReturnNode {
  type: 'Return';
  value: ExpressionNode;
  range: SourceRange;
}

// ── Union types ──────────────────────────────────────────────────────

export type ExpressionNode =
  | CallExpressionNode
  | IdentifierNode
  | IntegerLiteralNode
  | FloatLiteralNode
  | BooleanLiteralNode
  | StringLiteralNode
  | ArrayLiteralNode
  | CastExpressionNode;

export type StatementNode =
  | DeclarationNode
  | AssignmentNode
  | ReturnNode
  | ExpressionNode;

export type TopLevelDefinition =
  | FunctionDefNode
  | ConstDefNode
  | TypeDefNode;

// ── Parse result ─────────────────────────────────────────────────────

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface ParseDiagnostic {
  message: string;
  range: SourceRange;
  severity: DiagnosticSeverity;
}

export interface ParseResult {
  ast: ProgramNode | null;
  diagnostics: ParseDiagnostic[];
}
