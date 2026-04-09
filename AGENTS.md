# AGENTS.md — H-hat LSP Project Guide

## What is this project?

A VS Code language extension and Language Server Protocol (LSP) implementation
for **H-hat**, a quantum programming language. The extension provides syntax
highlighting, diagnostics, completions, and hover information for `.hat` /
`.hhat` files.

---

## Repository structure

```
hhat_lsp/
├── client/                     VS Code extension (LSP client)
│   ├── src/extension.ts        Extension entry point — starts the LSP client
│   ├── syntaxes/               TextMate grammar for syntax highlighting
│   ├── language-configuration.json
│   └── package.json            Extension manifest (activation, contributes)
│
├── server/                     Language server (LSP server)
│   ├── src/
│   │   ├── server.ts           LSP lifecycle — completions, hover, diagnostics
│   │   └── parser/             Hand-written recursive descent parser
│   │       ├── index.ts        Public API: parse(source) → ParseResult
│   │       ├── lexer.ts        Tokenizer (identifiers, literals, punctuation)
│   │       ├── parser.ts       Recursive descent parser → AST + diagnostics
│   │       ├── types.ts        Token kinds, AST node interfaces, ParseResult
│   │       └── __tests__/      Vitest test suite
│   │           ├── lexer.test.ts
│   │           ├── parser.test.ts
│   │           └── fixtures/   .hat files used by tests
│   ├── vitest.config.ts
│   └── package.json
│
├── grammar/                    Formal EBNF grammar (source of truth)
│   ├── core.ebnf               Shared rules: imports, identifiers, literals, expressions
│   ├── types.ebnf              Type definitions (struct, enum)
│   ├── constants.ebnf          Constant declarations
│   ├── functions.ebnf          Function definitions + main block
│   └── hhat.ebnf               Unified program entry point
│
├── examples/                   Example .hat programs (01 through 15)
├── docs/
│   └── ebnf-lsp-roadmap.md    Phased roadmap for grammar → parser → LSP
│
├── .vscode/
│   ├── launch.json             "Run Extension" debug config
│   └── tasks.json              Build tasks
│
├── example.hat                 Minimal example program
├── package.json                Workspace root (npm workspaces: client + server)
└── package-lock.json
```

---

## How to set up

```bash
# Install all dependencies (both client and server workspaces)
npm install
```

---

## How to build

```bash
# Build both client and server
npm run build

# Or build individually
npm run build -w client
npm run build -w server
```

---

## How to run (development)

1. Open this folder in VS Code / Cursor.
2. Press **F5** (or Run → Start Debugging).
   - This uses the `"Run Extension (H-hat LSP)"` launch configuration.
   - A new Extension Development Host window opens with the extension active.
3. Open any `.hat` file in the new window to see diagnostics, completions, and
   hover.

Alternatively, run the watch mode for live recompilation:

```bash
npm run watch
```

---

## How to test

```bash
# Run all tests (from workspace root)
npm test

# Run tests in watch mode (server only)
npm run test:watch -w server
```

Tests use **vitest** and live in `server/src/parser/__tests__/`. There are two
test files:

- `lexer.test.ts` — tokenization of identifiers, literals, punctuation,
  comments, and source positions.
- `parser.test.ts` — parsing of fixture `.hat` files (valid and invalid),
  expression types, and AST structure assertions.

Test fixtures are `.hat` files in `__tests__/fixtures/`. Naming convention:
`valid-<construct>.hat` for programs that should parse without errors,
`invalid-<scenario>.hat` for programs that should produce diagnostics.

---

## How to lint

```bash
npm run lint
```

---

## Key conventions

- **Language**: all code, comments, variable names, and documentation are in
  English.
- **Import organization**: group imports with section comments
  (`//* Libraries imports`, `//* Parser imports`, etc.).
- **No prop destructuring** in React components (not applicable yet, but noted
  for future UI work).
- **Tests**: always run a test both isolated and together with the full suite.

---

## Grammar files

The EBNF files in `grammar/` are the **single source of truth** for H-hat
syntax. They are not consumed at runtime — they serve as the specification that
the hand-written parser implements.

- `core.ebnf` — Shared building blocks (imports, identifiers, modifiers,
  literals, expressions, type references). Every other file depends on this.
- `types.ebnf` — `type_def`, `type_struct`, `type_enum`.
- `constants.ebnf` — `consts` (top-level const declarations).
- `functions.ebnf` — `fn_def`, `metafn_def`, `modifier_def`, `supertype_def`,
  `main`, `body`, declarations, assignments.
- `hhat.ebnf` — The unified `program` rule:
  `program = imports* ( type_def | consts | group_fns )* main? EOF`

When updating the grammar, update the corresponding parser method and add or
update test fixtures.

---

## Parser architecture

The parser is a hand-written recursive descent parser in TypeScript with no
external dependencies. It lives in `server/src/parser/`.

**Pipeline**: source string → `Lexer.tokenize()` → `Token[]` → `Parser.parse()`
→ `ParseResult { ast, diagnostics }`.

- **Lexer** (`lexer.ts`): produces a flat array of tokens. Handles whitespace,
  line/block comments, string escapes, sigiled identifiers (`#`, `!`, `%`, `@`),
  multi-character punctuation (`::`, `...`).
- **Parser** (`parser.ts`): each method maps to an EBNF production. On error, a
  `ParseDiagnostic` is recorded and the parser attempts to recover by skipping
  to the next statement boundary (`synchronize()`).
- **AST types** (`types.ts`): node interfaces (`ProgramNode`, `MainBlockNode`,
  `DeclarationNode`, `CallExpressionNode`, etc.) and `ParseResult`.
- **Public API** (`index.ts`): `parse(source: string): ParseResult`.

The LSP server (`server.ts`) calls `parse()` in `validateTextDocument` and maps
`ParseDiagnostic[]` to LSP `Diagnostic[]`. A separate semantic pass checks for
unknown types.

---

## Roadmap

See `docs/ebnf-lsp-roadmap.md` for the full phased plan covering grammar
unification, parser implementation, testing, and LSP integration.
