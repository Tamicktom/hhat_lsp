//* ------------------------------------------------------------------ *
//* Public API for the H-hat parser.
//* ------------------------------------------------------------------ *

//* Parser imports
import { Lexer } from './lexer';
import { Parser } from './parser';

//* Types imports
import type { ParseResult } from './types';

export function parse(source: string): ParseResult {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

export { Lexer } from './lexer';
export { Parser } from './parser';
export type {
  ParseResult,
  ParseDiagnostic,
  ProgramNode,
  MainBlockNode,
  StatementNode,
  DeclarationNode,
  AssignmentNode,
  ExpressionNode,
  CallExpressionNode,
  IdentifierNode,
  TypeAnnotationNode,
  IntegerLiteralNode,
  FloatLiteralNode,
  BooleanLiteralNode,
  StringLiteralNode,
  ArrayLiteralNode,
  CastExpressionNode,
  FunctionDefNode,
  ConstDefNode,
  TypeDefNode,
  Token,
  SourceRange,
  SourcePosition,
} from './types';

export { TokenKind } from './types';
