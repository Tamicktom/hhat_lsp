# EBNF Grammar & Parser Roadmap for H-hat LSP

This document describes the phased plan for building a proper parser from the
EBNF grammar files and wiring it into the H-hat Language Server.

---

## 1. Goals

- **Derive syntax validation from the formal grammar** instead of ad-hoc regex
  and hardcoded lists.
- **Produce an AST** that enables rich LSP features: diagnostics with precise
  ranges, completions, hover, and eventually go-to-definition.
- **Single source of truth**: the `.ebnf` files define what is valid H-hat
  syntax; the parser and LSP capabilities follow from them.
- **Testability**: every grammar construct has fixture files and automated
  assertions so regressions are caught early.

## 2. Non-goals (Phase 1)

- Full semantic analysis (type checking, scope resolution, overload resolution).
- Incremental / error-recovery parsing at the token level (basic statement-level
  recovery is in scope).
- Auto-generating the TextMate grammar from EBNF (the tmLanguage stays manually
  maintained; cross-referenced after grammar changes).

---

## 3. Current state

| Artifact | Location | Status |
|----------|----------|--------|
| LSP server | `server/src/server.ts` | Completions, hover, and diagnostics driven by static arrays and regex. No parser. |
| EBNF grammars | `grammar/types.ebnf`, `grammar/constants.ebnf`, `grammar/group-functions..ebnf` | Three files, each declaring its own `program` rule. ~20 shared productions duplicated across all three. File `group-functions..ebnf` has a typo in its name (double dot). |
| TextMate grammar | `client/syntaxes/hhatq.tmLanguage.json` | Basic syntax highlighting; independent of the EBNF. |
| Example file | `example.hat` | Exercises the `main` block from `group-functions` grammar. |

### Known grammar issues

- **`option`** is referenced in `call_optn` and `call_optbdn` but never defined.
- **`assign_s`** is referenced in `fn_body` but never defined (likely typo for
  `assign_ds`).
- **`declareassign_ds`** references `simple` instead of `simple_id`.
- Negative signs for numeric literals (`int_t`, `float_t`) are embedded in the
  regex pattern; this makes them ambiguous with a hypothetical unary minus
  operator.

---

## 4. Grammar architecture

### 4.1 File layout (target)

```
grammar/
  core.ebnf          Shared rules: imports, identifiers, modifiers, literals,
                     expressions, type_id.
  types.ebnf         Type-specific rules: type_def, type_struct, type_enum.
  constants.ebnf     Constant-specific rules: consts.
  functions.ebnf     Function definitions + main block.
  hhat.ebnf          Unified `program` rule that composes everything.
```

`core.ebnf` is the foundation referenced by every other file. Each domain file
contains only the rules unique to that domain. `hhat.ebnf` is the top-level
entry point for the parser.

### 4.2 Unified `program` rule

```ebnf
program = imports* ( type_def | consts | fn_def | metafn_def | modifier_def | supertype_def )* main? EOF
```

This allows top-level constructs to appear in any order, with an optional `main`
block.

### 4.3 Regex terminals

The EBNF files use `r"..."` for regex-based terminals (e.g. `simple_id`,
`int_t`). The parser must either:

- Compile these patterns directly into the lexer, or
- Preprocess them into a form the chosen tool understands.

The current approach compiles them as JavaScript `RegExp` in the hand-written
lexer.

---

## 5. Tooling decision (ADR)

### Criteria

| Criterion | Weight |
|-----------|--------|
| TypeScript / Node.js native | High |
| Quality of parse-error messages (positions, context) | High |
| Maintainability (grammar changes = localized code changes) | High |
| No external build step | Medium |
| Support for error recovery | Medium |

### Decision

**Hand-written recursive descent parser in TypeScript.**

A hand-written parser gives the best control over error messages and recovery,
which is critical for an LSP that must report useful diagnostics on incomplete
code. It requires no build step and the parsing logic maps directly to the EBNF
productions.

The trade-off is more code to maintain compared to a generated parser, but the
grammar is small enough (~50 productions) that this is manageable.

### Alternatives considered

| Alternative | Reason not chosen |
|-------------|-------------------|
| `peggy` (PEG generator) | Limited error recovery; `r"..."` regex terminals need pre-processing; adds a build step. |
| `tree-sitter` | Excellent for editors, but generates C/WASM; heavy for a Node LSP at this stage. |
| `chevrotain` | Good error messages, but the grammar DSL is verbose and doesn't map as naturally to the EBNF. |

---

## 6. Phased implementation

### Phase 0 — Repository hygiene

**Goal**: Clean up the grammar directory so subsequent phases start from a
consistent foundation.

- Rename `grammar/group-functions..ebnf` to `grammar/functions.ebnf`.
- Extract shared rules into `grammar/core.ebnf`.
- Remove duplicated rules from domain files (`types.ebnf`, `constants.ebnf`).
- Create `grammar/hhat.ebnf` with the unified `program` rule.
- Document the file layout convention.

**Done when**: `grammar/` has the five files listed in section 4.1 with no rule
duplication.

### Phase 1 — Canonical grammar

**Goal**: Agree on a single, complete grammar and validate it statically.

- Resolve undefined symbols (`option`, `assign_s`, `declareassign_ds` typos).
- Verify every non-terminal is reachable from `program`.
- Freeze the grammar for Phase 2 implementation (further changes go through
  review).

**Done when**: No undefined or unreachable symbols in the combined grammar.

### Phase 2 — Minimal parser

**Goal**: A TypeScript parser module with the API `parse(source: string): ParseResult`.

- Lexer that tokenizes all H-hat token types (keywords, identifiers with sigils,
  literals, punctuation).
- Recursive descent parser covering at minimum: `main` block, variable
  declarations, assignments, function calls, literals, and type annotations.
- `ParseResult` contains an AST and a list of diagnostics with
  line/column/offset positions.
- Basic error recovery: on a parse error inside a block, skip to the next
  statement boundary and continue.

**Done when**: `parse(source)` returns a correct AST for `example.hat` and
meaningful errors for intentionally broken inputs.

### Phase 3 — Parser tests

**Goal**: Automated test suite that locks in parser behavior.

- Test runner (`vitest`) integrated into the `server` workspace package.
- Fixture `.hat` files in `server/src/parser/__tests__/fixtures/`.
- Lexer tests: token sequences for representative inputs.
- Parser tests: AST structure assertions for valid inputs; diagnostic assertions
  for invalid inputs.
- `npm test` at the workspace root runs all tests.

**Done when**: `npm test` passes with coverage of the core constructs.

### Phase 4 — LSP diagnostics integration

**Goal**: Replace ad-hoc regex validation with parser-driven diagnostics.

- `validateTextDocument` calls `parse()` and maps `ParseDiagnostic[]` to LSP
  `Diagnostic[]`.
- Preserve the existing "unknown type" warning as a semantic check layered on
  top of the parse result (the grammar does not enforce type validity).
- Remove the regex-based `main { ... }` check (the parser handles this).

**Done when**: Opening a `.hat` file with syntax errors shows accurate,
positioned diagnostics in the editor.

### Phase 5 — Completions and hover from grammar (future)

**Goal**: Reduce duplication between the static `KEYWORDS_AND_BUILTINS` /
`TYPES` arrays and the grammar.

- Derive keyword list from the parser's keyword set.
- Use AST context to offer context-sensitive completions (e.g. types only after
  `:`).
- Enhance hover to show inferred information from the AST (variable type, etc.).

**Done when**: `KEYWORDS_AND_BUILTINS` and `TYPES` arrays are removed from
`server.ts`; completions and hover are driven by the parser.

---

## 7. Testing strategy

| Level | What | Tool |
|-------|------|------|
| Unit — lexer | Tokenize short snippets, assert token kinds and values. | `vitest` |
| Unit — parser | Parse fixture `.hat` files, assert AST shape or diagnostics. | `vitest` |
| Snapshot (optional) | Serialize AST to JSON, compare against golden files. | `vitest` snapshots |
| Integration — LSP | Spin up the server in-memory, send `textDocument/didOpen`, assert `publishDiagnostics`. | Future (Phase 5+). |

### Fixture conventions

- One fixture per construct or error scenario.
- File names: `valid-<construct>.hat`, `invalid-<scenario>.hat`.
- Located in `server/src/parser/__tests__/fixtures/`.

---

## 8. LSP feature dependency map

| LSP capability | Depends on |
|----------------|------------|
| `textDocument/publishDiagnostics` | `ParseResult.diagnostics` (Phase 4) |
| `textDocument/completion` | Keyword list from parser + AST context (Phase 5) |
| `textDocument/hover` | AST node lookup at cursor position (Phase 5) |
| `textDocument/definition` | Symbol table built from AST (future) |

---

## 9. Risks

| Risk | Mitigation |
|------|------------|
| Expression precedence conflicts (`expr` has many alternatives) | Refactor the EBNF to use explicit precedence levels before implementing the parser. In the recursive descent parser, encode precedence in the call hierarchy. |
| Three divergent `program` rules | Unified rule agreed in Phase 0; subsequent grammar changes require updating `hhat.ebnf`. |
| Grammar has undefined symbols | Resolve in Phase 1 before the parser is written. |
| Hand-written parser drift from EBNF | Each parser method references the EBNF rule it implements; tests lock behavior. |

---

## 10. Glossary

| Term | Meaning |
|------|---------|
| **EBNF** | Extended Backus-Naur Form — a notation for describing context-free grammars. |
| **CST** | Concrete Syntax Tree — preserves every token including whitespace and punctuation. |
| **AST** | Abstract Syntax Tree — a simplified tree that omits syntactic noise (brackets, keywords used only for grouping). |
| **Fixture** | A small, self-contained input file used by tests to exercise a specific construct or error case. |
| **Golden file** | A snapshot of expected output stored alongside a test; the test fails if actual output differs. |
| **ADR** | Architecture Decision Record — a short document capturing a significant technical decision and its rationale. |
| **PEG** | Parsing Expression Grammar — a grammar formalism that uses ordered choice instead of ambiguous alternatives. |
