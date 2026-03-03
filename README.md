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
- Create a file with extension `.qpl` or `.hhatq` to activate the language server

### Packaging (VSIX)

```bash
npm run package
```
