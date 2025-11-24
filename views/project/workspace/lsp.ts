import { Project } from "../../../types";
import {
    Transport,
    LSPClient,
    languageServerExtensions
} from "@codemirror/lsp-client";
import * as lsp from "../../../editor_modules/lsp";
import core_message from "../../../../fullstacked_modules/core_message";
import * as directories from "../../../editor_modules/directories";
import fs from "../../../../fullstacked_modules/fs";
import { compilerOptions } from "../../../../platform/node/src/tsconfig";
import { EditorView } from "codemirror";
import { insertCompletionText } from "@codemirror/autocomplete";
import { setDiagnostics, Diagnostic } from "@codemirror/lint";
import { FileEvent, FileEventType } from "../file-event";
import { createCodeMirrorView } from "@fullstacked/codemirror-view";
import { Extension } from "@codemirror/state";
import { Store } from "../../../store";

export type CodemirrorView = ReturnType<typeof createCodeMirrorView>;

type TransportHandler = (value: string) => void;

const rootBaseUri = await directories.root();
const rootUri = (project: Project) => `file://${rootBaseUri}/${project.id}`;

const supportedExtensions = [
    "ts",
    "tsx",
    "js",
    "jsx",
    "cjs",
    "mjs",
    "mts",
    "cts",
    "json"
];

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

function tsConfig(project: Project) {
    return fs.writeFile(
        `${project.id}/tsconfig.json`,
        JSON.stringify({ compilerOptions }, null, 4)
    );
}

async function createClientLSP(project: Project) {
    if (!(await lsp.available())) return;

    const lspTransport = await createTransport(project);

    const client = new LSPClient({
        rootUri: rootUri(project),
        extensions: languageServerExtensions()
    }).connect(lspTransport);

    const runDiagnostics = (uri: string) => {
        const projectFilePath = uri.split(project.id + "/").pop();

        originalRequest("textDocument/diagnostic", {
            textDocument: { uri }
        }).then((lspDiagnostics) => {
            const view = client.workspace.getFile(uri)?.getView();
            if (!view) return;

            const buildErrors: Diagnostic[] =
                Store.editor.codeEditor.buildErrors
                    .check()
                    .filter(({ file }) => uri.endsWith(file))
                    .map((err) => {
                        const from =
                            view.state.doc.line(err.line).from + err.col;
                        return {
                            from,
                            to: from + err.length,
                            severity: "error",
                            message: err.message
                        } as Diagnostic;
                    });

            const diagnostics: Diagnostic[] = lspDiagnostics.items.map(
                (item) => ({
                    from:
                        view.state.doc.line(item.range.start.line + 1).from +
                        item.range.start.character,
                    to:
                        view.state.doc.line(item.range.end.line + 1).from +
                        item.range.end.character,
                    severity: toSeverity(item.severity),
                    message: item.message
                })
            );

            Store.editor.codeEditor.setFileDiagnostics(
                projectFilePath,
                diagnostics
            );

            view.dispatch(
                setDiagnostics(view.state, diagnostics.concat(buildErrors))
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

            clientLSP?.client
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
                        const fileUri = removeDriveLetter(
                            decodeURIComponent(def.uri)
                        );
                        if (!fileUri.startsWith(projectRootUri)) return;
                        const filePath = decodeURIComponent(
                            fileUri.slice(projectRootUri.length + 1)
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
            clientLSP?.client.plugin(fileUri, filePathToLanguageId(filePath)),
            EditorView.domEventHandlers({
                click: navigateToDefinition(filePath)
            })
        ];
        extensions.forEach(view.extensions.add);

        viewsWithLSP.set(filePath, { view, extensions });

        clientLSP?.runDiagnostics(`${projectRootUri}/${filePath}`);
    };

    const restartClient = async () => {
        console.log("RESTARTING");

        if (clientLSP) await clientLSP?.end();

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
                !fileEvent.paths.at(0).includes(project.id) ||
                fileEvent.paths.at(0).includes(`${project.id}/.build`) ||
                fileEvent.paths.at(0).includes(`${project.id}/.git`) ||
                fileEvent.paths.at(0).includes(`${project.id}/data`) ||
                fileEvent.paths.at(0).includes(`${project.id}/chat`)
            )
                continue;

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
            restartClient();
        }
    };
    core_message.addListener("file-event", fileEventsListenner);

    return {
        bindView,
        runDiagnostics: (projectFilePath: string) => {
            clientLSP?.runDiagnostics(`${projectRootUri}/${projectFilePath}`);
        },
        async destroy() {
            await clientLSP?.end();
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

function removeDriveLetter(fileUri: string) {
    if (!fileUri.startsWith("file:///")) return fileUri;

    const parts = fileUri.slice("file:///".length).split("/");
    if (parts.at(0).includes(":")) {
        parts.splice(0, 1);
    }

    return "file:///" + parts.join("/");
}
