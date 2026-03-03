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

const KEYWORDS: Array<{ label: string; detail: string; documentation: string; kind: CompletionItemKind }> = [
  {
    label: 'qubit',
    detail: 'Quantum declaration',
    documentation: 'Declares a qubit variable.',
    kind: CompletionItemKind.Keyword,
  },
  {
    label: 'measure',
    detail: 'Quantum measurement',
    documentation: 'Measures a qubit and collapses its state.',
    kind: CompletionItemKind.Function,
  },
  {
    label: 'H',
    detail: 'Hadamard gate',
    documentation: 'Creates superposition: |0> -> (|0> + |1>)/sqrt(2).',
    kind: CompletionItemKind.Function,
  },
  {
    label: 'CNOT',
    detail: 'Controlled-NOT gate',
    documentation: 'Flips target qubit when control qubit is |1>.',
    kind: CompletionItemKind.Function,
  },
];

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
  return KEYWORDS.map((item) => {
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

  const known = KEYWORDS.find((k) => k.label === word);
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

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const text = textDocument.getText();
  const diagnostics: Diagnostic[] = [];

  const forbidden = 'collapse';
  let index = text.indexOf(forbidden);
  while (index !== -1) {
    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Warning,
      range: {
        start: textDocument.positionAt(index),
        end: textDocument.positionAt(index + forbidden.length),
      },
      message: 'Avoid using the word "collapse" directly. Prefer the "measure" keyword.',
      source: 'hhatq',
    };

    diagnostics.push(diagnostic);
    index = text.indexOf(forbidden, index + forbidden.length);
  }

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

function getWordAt(text: string, offset: number): string | null {
  if (offset < 0 || offset > text.length) {
    return null;
  }

  const isWordChar = (char: string) => /[A-Za-z_]/.test(char);

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

