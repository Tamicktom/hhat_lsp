## H-hat LSP (VSCode + Node + TypeScript)

This repository contains a basic Language Server Protocol (LSP) implementation for a quantum programming language.

### Structure

- `client/`: VSCode extension (Language Client)
- `server/`: Node-based Language Server

### Requirements

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Build

```bash
npm run build
```

### Debug in VSCode

- Open this workspace in VSCode
- Press `F5` to launch **Run Extension (H-hat LSP)**
- Create a file with extension `.hat` or `.hhat` to activate the language server

### How to test the LSP (manual checklist)

- **Build first**: run `npm run build` (or use the default build task)
- **Start Extension Host**: press `F5` (a new VSCode window opens)
- **Create a test file**: in the Extension Host window, create `test.hat`
- **Check it activated**:
  - Open **Output** panel
  - Select **H-hat Quantum Language Server** (or **Log (Extension Host)**) and confirm there are no startup errors
- **Test completion**:
  - Type `H` or `CNOT` and use `Ctrl+Space`
- **Test hover**:
  - Hover `H`, `CNOT`, `qubit`, or `measure`
- **Test diagnostics**:
  - Type the word `collapse` anywhere in the file and confirm a warning appears

### Packaging (VSIX)

```bash
npm run package
```
