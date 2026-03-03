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

function validateTextDocument(textDocument: TextDocument): void {
  const text = textDocument.getText();
  const diagnostics: Diagnostic[] = [];

  if (!/\bmain\s*\{/.test(text)) {
    diagnostics.push({
      severity: DiagnosticSeverity.Information,
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
      message: 'H-hat programs should have a main block: main { ... }',
      source: 'hhat',
    });
  }

  const knownTypes = ['i8', 'i16', 'i32', 'i64', 'u8', 'u16', 'u32', 'u64', 'f32', 'f64'];
  const declarationWithType = /\b[a-zA-Z_][a-zA-Z0-9_]*\s*:\s*([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let match: RegExpExecArray | null;
  while ((match = declarationWithType.exec(text)) !== null) {
    const typeName = match[1];
    if (!knownTypes.includes(typeName)) {
      const typeStart = match.index + (match[0].length - typeName.length);
      const start = textDocument.positionAt(typeStart);
      const end = textDocument.positionAt(typeStart + typeName.length);
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: { start, end },
        message: `Unknown type "${typeName}". Known types: ${knownTypes.join(', ')}.`,
        source: 'hhat',
      });
    }
  }

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
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
