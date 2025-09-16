import { Project } from "../../../types";
import {
    Transport,
    LSPClient,
    languageServerExtensions,
    Workspace
} from "@codemirror/lsp-client";
import * as lsp from "../../../editor_modules/lsp";
import core_message from "../../../../fullstacked_modules/core_message";
import * as directories from "../../../editor_modules/directories";
import { file } from "zod";
import fs from "../../../../fullstacked_modules/fs";
import { compilerOptions } from "./tsconfig";
import { EditorView } from "codemirror";
import { insertCompletionText } from "@codemirror/autocomplete";
import { setDiagnostics } from "@codemirror/lint";
import { FileEvent, FileEventType } from "../file-event";
import { createCodeMirrorView } from "@fullstacked/codemirror-view";
import { Extension } from "@codemirror/state";
import { vi } from "zod/v4/locales";
import { URI } from "vscode-languageserver-types";
import { d } from "../../../../core/typescript-go/testdata/tests/cases/compiler/declarationEmitBigInt";

export type CodemirrorView = ReturnType<typeof createCodeMirrorView>;

type TransportHandler = (value: string) => void;

const rootBaseUri = await directories.root();
const rootUri = (project: Project) => `file://${rootBaseUri}/${project.id}`;

const supportedExtensions = ["ts", "tsx", "js", "jsx", "cjs", "mjs"];

export function lspSupportedFile(filePath: string) {
    const ext = filePath.split(".").pop();
    return supportedExtensions.includes(ext);
}

function toSeverity(sev: number) {
    return sev == 1
        ? "error"
        : sev == 2
          ? "warning"
          : sev == 3
            ? "info"
            : "hint";
}

let transportId: string = null;

async function createTransport(project: Project): Promise<
    Transport & {
        destroy: () => Promise<void>;
    }
> {
    if (transportId) {
        await lsp.end(transportId);
    }

    transportId = await lsp.start(project);
    const handlers = new Set<TransportHandler>();
    const onResponse = (message: string) =>
        handlers.forEach((handler) => handler(message));
    core_message.addListener(`lsp-${transportId}`, onResponse);
    return {
        send(message: string) {
            lsp.request(transportId, message);
        },
        subscribe(handler: TransportHandler) {
            handlers.add(handler);
        },
        unsubscribe(handler: TransportHandler) {
            handlers.delete(handler);
        },
        async destroy() {
            await lsp.end(transportId);
            transportId = null;
            core_message.removeListener(`lsp-${transportId}`, onResponse);
        }
    };
}

async function tsConfig(project: Project) {
    fs.writeFile(
        `${project.id}/tsconfig.json`,
        JSON.stringify({ compilerOptions }, null, 4)
    );
}

async function createClientLSP(project: Project) {
    const lspTransport = await createTransport(project);

    const client = new LSPClient({
        rootUri: rootUri(project),
        extensions: languageServerExtensions()
    }).connect(lspTransport);

    const runDiagnostics = (uri: string) => {
        originalRequest("textDocument/diagnostic", {
            textDocument: { uri }
        }).then((diagnostics) => {
            const view = client.workspace.getFile(uri)?.getView();
            if (!view) return;
            view.dispatch(
                setDiagnostics(
                    view.state,
                    diagnostics.items.map((item) => ({
                        from:
                            view.state.doc.line(item.range.start.line + 1)
                                .from + item.range.start.character,
                        to:
                            view.state.doc.line(item.range.end.line + 1).from +
                            item.range.end.character,
                        severity: toSeverity(item.severity),
                        message: item.message
                    }))
                )
            );
        });
    };

    const originalRequest = client.request.bind(client);
    client.request = async (method: string, params: any) => {
        if (
            method === "textDocument/completion" &&
            params?.context?.triggerCharacter !== undefined
        ) {
            delete params.context.triggerCharacter;
        }

        if (method === "textDocument/completion") {
            const response = await originalRequest(method, params);
            if (!response?.items?.length) return response;

            const originalMap = response.items.map.bind(response.items);
            response.items.map = (cb) => {
                const options = originalMap(cb);
                return options.map((o, i) => {
                    const item = response.items[i];
                    if (item.data?.autoImport) {
                        o.apply = (view, c, from, to) => {
                            view.dispatch(
                                insertCompletionText(
                                    view.state,
                                    item.label,
                                    from,
                                    to
                                )
                            );
                            originalRequest("completionItem/resolve", {
                                label: c.label,
                                data: item.data
                            }).then((completionResolve: any) => {
                                if (!completionResolve.additionalTextEdits)
                                    return;
                                const changes =
                                    completionResolve.additionalTextEdits.map(
                                        ({ newText, range }) => {
                                            return {
                                                from:
                                                    view.state.doc.line(
                                                        range.start.line + 1
                                                    ).from +
                                                    range.start.character,
                                                to:
                                                    view.state.doc.line(
                                                        range.end.line + 1
                                                    ).from +
                                                    range.end.character,
                                                insert: newText
                                            };
                                        }
                                    );

                                view.dispatch({ changes });
                            });
                        };
                    }

                    return o;
                });
            };

            return response;
        }

        return originalRequest(method, params);
    };
    const originalNotification = client.notification.bind(client);
    client.notification = (method: string, params: any) => {
        if (method === "textDocument/didChange") {
            setTimeout(() => runDiagnostics(params.textDocument.uri), 500);
        }
        return originalNotification(method, params);
    };

    return {
        client,
        runDiagnostics,
        end: async () => {
            await originalRequest("shutdown");
            await lspTransport.destroy();
            client.disconnect();
        }
    };
}

export async function createLSP(
    project: Project,
    actions: {
        open(filePath: string, pos?: { line: number; character: number }): void;
    }
) {
    await tsConfig(project);

    let clientLSP = await createClientLSP(project);

    const projectRootUri = rootUri(project);

    const viewsWithLSP = new Map<
        string,
        {
            view: CodemirrorView;
            extensions: Extension[];
        }
    >();

    const navigateToDefinition = (filePath: string) => {
        return (e: MouseEvent, view: EditorView) => {
            if (!e.metaKey && !e.ctrlKey) return null;

            const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });

            if (!pos) return;

            const lineInfo = view.state.doc.lineAt(pos);
            const line = lineInfo.number - 1;
            const character = pos - lineInfo.from;

            clientLSP.client
                .request("textDocument/definition", {
                    textDocument: {
                        uri: `${projectRootUri}/${filePath}`
                    },
                    position: {
                        line,
                        character
                    }
                })
                .then(
                    (
                        definitions: {
                            uri: string;
                            range: {
                                start: { line: number; character: number };
                            };
                        }[]
                    ) => {
                        if (!definitions || definitions.length === 0) return;
                        const def = definitions.at(0);
                        if (!def.uri.startsWith(projectRootUri)) return;
                        const filePath = decodeURIComponent(
                            def.uri.slice(projectRootUri.length + 1)
                        );
                        actions.open(filePath, {
                            line: def.range.start.line + 1,
                            character: def.range.start.character
                        });
                    }
                );
        };
    };

    const bindView = (filePath: string, view: CodemirrorView) => {
        // remove previous plugin
        const activeView = viewsWithLSP.get(filePath);
        if (activeView) {
            activeView.extensions.forEach(view.extensions.remove);
        }

        const fileUri = `${projectRootUri}/${filePath}`;

        // add current plugin
        const extensions = [
            clientLSP.client.plugin(
                fileUri,
                filePathToLanguageId(filePath)
            ),
            EditorView.domEventHandlers({
                click: navigateToDefinition(filePath)
            })
        ];
        extensions.forEach(view.extensions.add);

        viewsWithLSP.set(filePath, { view, extensions });

        clientLSP.runDiagnostics(fileUri);
    };

    const restartClient = async () => {
        console.log("RESTARTING");
        await clientLSP.end();
        clientLSP = await createClientLSP(project);
        Array.from(viewsWithLSP.entries()).forEach(([filePath, { view }]) => {
            bindView(filePath, view);
        });
    };

    const fileEventsListenner = (msg: string) => {
        const fileEvents: FileEvent[] = JSON.parse(msg);
        let restart = false;
        for (const fileEvent of fileEvents) {
            if (
                fileEvent.type === FileEventType.CREATED ||
                fileEvent.type === FileEventType.DELETED ||
                fileEvent.type === FileEventType.RENAME
            ) {
                restart = true;
                break;
            }
        }
        if (restart) {
            restartClient()
        }
    };
    core_message.addListener("file-event", fileEventsListenner);

    return {
        bindView,
        async destroy() {
            await clientLSP.end();
            clientLSP = null;
        }
    };
}

// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocumentItem
function filePathToLanguageId(filePath: string) {
    const ext = filePath.split(".").pop();
    switch (ext) {
        case "ts":
            return "typescript";
        case "tsx":
            return "typescriptreact";
        case "js":
            return "javascript";
        case "jsx":
            return "javascriptreact";
        default:
            return ext;
    }
}
