//* Libraries imports
import * as path from 'node:path';

//* VSCode imports
import * as vscode from 'vscode';

//* LSP imports
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext) {
  const serverModulePath = context.asAbsolutePath(path.join('..', 'server', 'dist', 'server.js'));

  const serverOptions: ServerOptions = {
    run: { module: serverModulePath, transport: TransportKind.ipc },
    debug: {
      module: serverModulePath,
      transport: TransportKind.ipc,
      options: {
        execArgv: ['--nolazy', '--inspect=6009'],
      },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ language: 'hhatq' }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{hat,hhat}'),
    },
  };

  client = new LanguageClient('hhatqLanguageServer', 'H-hat Quantum Language Server', serverOptions, clientOptions);
  void client.start();

  context.subscriptions.push({
    dispose() {
      void client?.stop();
      client = undefined;
    },
  });
}

export async function deactivate(): Promise<void> {
  if (!client) {
    return;
  }

  await client.stop();
  client = undefined;
}

