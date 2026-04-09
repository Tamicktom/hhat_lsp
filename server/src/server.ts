//* LSP imports
import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  type InitializeParams,
  type InitializeResult,
  TextDocumentSyncKind,
  type Diagnostic,
  DiagnosticSeverity,
  type CompletionItem,
  CompletionItemKind,
  type Hover,
  MarkupKind,
} from 'vscode-languageserver/node';

//* TextDocument imports
import { TextDocument } from 'vscode-languageserver-textdocument';

//* Parser imports
import { parse } from './parser';
import type { ParseDiagnostic, DeclarationNode, StatementNode } from './parser';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

interface KnownSymbol {
  label: string;
  detail: string;
  documentation: string;
  kind: CompletionItemKind;
}

const KEYWORDS_AND_BUILTINS: KnownSymbol[] = [
  {
    label: 'main',
    detail: 'Entry block',
    documentation: 'Entry point. Defines the main block that runs when the program starts. Syntax: `main { ... }`.',
    kind: CompletionItemKind.Keyword,
  },
  {
    label: 'print',
    detail: 'Built-in function',
    documentation: 'Prints a value. Example: `print(x)`.',
    kind: CompletionItemKind.Function,
  },
];

const TYPES: KnownSymbol[] = [
  { label: 'i8', detail: '8-bit signed integer', documentation: 'Signed 8-bit integer type.', kind: CompletionItemKind.TypeParameter },
  { label: 'i16', detail: '16-bit signed integer', documentation: 'Signed 16-bit integer type.', kind: CompletionItemKind.TypeParameter },
  { label: 'i32', detail: '32-bit signed integer', documentation: 'Signed 32-bit integer type.', kind: CompletionItemKind.TypeParameter },
  { label: 'i64', detail: '64-bit signed integer', documentation: 'Signed 64-bit integer type.', kind: CompletionItemKind.TypeParameter },
  { label: 'u8', detail: '8-bit unsigned integer', documentation: 'Unsigned 8-bit integer type.', kind: CompletionItemKind.TypeParameter },
  { label: 'u16', detail: '16-bit unsigned integer', documentation: 'Unsigned 16-bit integer type.', kind: CompletionItemKind.TypeParameter },
  { label: 'u32', detail: '32-bit unsigned integer', documentation: 'Unsigned 32-bit integer type.', kind: CompletionItemKind.TypeParameter },
  { label: 'u64', detail: '64-bit unsigned integer', documentation: 'Unsigned 64-bit integer type.', kind: CompletionItemKind.TypeParameter },
  { label: 'f32', detail: '32-bit float', documentation: '32-bit floating-point type.', kind: CompletionItemKind.TypeParameter },
  { label: 'f64', detail: '64-bit float', documentation: '64-bit floating-point type.', kind: CompletionItemKind.TypeParameter },
];

const ALL_KNOWN: KnownSymbol[] = [...KEYWORDS_AND_BUILTINS, ...TYPES];

connection.onInitialize((params: InitializeParams): InitializeResult => {
  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
      },
      hoverProvider: true,
    },
  };

  connection.console.info(`Initialized for ${params.clientInfo?.name ?? 'unknown client'}.`);
  return result;
});

documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

documents.onDidOpen((event) => {
  validateTextDocument(event.document);
});

connection.onCompletion((): CompletionItem[] => {
  return ALL_KNOWN.map((item) => {
    const completionItem: CompletionItem = {
      label: item.label,
      kind: item.kind,
      detail: item.detail,
      documentation: {
        kind: MarkupKind.Markdown,
        value: item.documentation,
      },
    };

    return completionItem;
  });
});

connection.onHover((params): Hover | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  const offset = document.offsetAt(params.position);
  const text = document.getText();

  const word = getWordAt(text, offset);
  if (!word) {
    return null;
  }

  const known = ALL_KNOWN.find((k) => k.label === word);
  if (!known) {
    return null;
  }

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: `**${known.label}**\n\n${known.documentation}\n`,
    },
  };
});

const LSP_SEVERITY_MAP: Record<ParseDiagnostic['severity'], DiagnosticSeverity> = {
  error: DiagnosticSeverity.Error,
  warning: DiagnosticSeverity.Warning,
  info: DiagnosticSeverity.Information,
};

const KNOWN_TYPES = new Set(['i8', 'i16', 'i32', 'i64', 'u8', 'u16', 'u32', 'u64', 'f32', 'f64']);

function validateTextDocument(textDocument: TextDocument): void {
  const text = textDocument.getText();
  const result = parse(text);
  const diagnostics: Diagnostic[] = [];

  for (const d of result.diagnostics) {
    diagnostics.push({
      severity: LSP_SEVERITY_MAP[d.severity],
      range: {
        start: { line: d.range.start.line, character: d.range.start.column },
        end: { line: d.range.end.line, character: d.range.end.column },
      },
      message: d.message,
      source: 'hhat',
    });
  }

  // Semantic check: unknown types on declarations (grammar does not enforce type validity)
  if (result.ast?.main) {
    checkUnknownTypes(result.ast.main.body, diagnostics);
  }
  for (const def of result.ast?.definitions ?? []) {
    if (def.type === 'FunctionDef') {
      checkUnknownTypes(def.body, diagnostics);
    }
  }

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

function checkUnknownTypes(statements: StatementNode[], diagnostics: Diagnostic[]): void {
  for (const stmt of statements) {
    if (stmt.type !== 'Declaration') continue;
    const decl = stmt as DeclarationNode;
    const typeName = decl.typeAnnotation.name;
    if (!KNOWN_TYPES.has(typeName)) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: {
          start: { line: decl.typeAnnotation.range.start.line, character: decl.typeAnnotation.range.start.column },
          end: { line: decl.typeAnnotation.range.end.line, character: decl.typeAnnotation.range.end.column },
        },
        message: `Unknown type "${typeName}". Known types: ${[...KNOWN_TYPES].join(', ')}.`,
        source: 'hhat',
      });
    }
  }
}

function getWordAt(text: string, offset: number): string | null {
  if (offset < 0 || offset > text.length) {
    return null;
  }

  const isWordChar = (char: string) => /[A-Za-z0-9_]/.test(char);

  let start = offset;
  while (start > 0 && isWordChar(text[start - 1] ?? '')) {
    start -= 1;
  }

  let end = offset;
  while (end < text.length && isWordChar(text[end] ?? '')) {
    end += 1;
  }

  const word = text.slice(start, end);
  return word.length > 0 ? word : null;
}

documents.listen(connection);
connection.listen();
