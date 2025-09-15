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

export type CodemirrorView = ReturnType<typeof createCodeMirrorView>;

type TransportHandler = (value: string) => void;

const rootBaseUri = await directories.root();
const rootUri = (project: Project) => `file://${rootBaseUri}/${project.id}`;

const supportedExtensions = ["ts", "tsx", "js", "jsx", "mjs", "cjs"];

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
        end: async () => {
            await originalRequest("shutdown");
            await lspTransport.destroy();
            client.disconnect();
        }
    };
}

export async function createLSP(project: Project) {
    await tsConfig(project);

    let clientLSP = await createClientLSP(project);

    const cachedRootUri = rootUri(project);

    const viewsWithLSP = new Map<
        string,
        {
            view: CodemirrorView;
            extension: Extension;
        }
    >();

    const bindView = (filePath: string, view: CodemirrorView) => {
        // remove previous plugin
        const activeView = viewsWithLSP.get(filePath);
        if (activeView) {
            view.extensions.remove(activeView.extension);
        }

        // add current plugin
        const extension = clientLSP.client.plugin(
            `${cachedRootUri}/${filePath}`,
            filePathToLanguageId(filePath)
        );
        view.extensions.add(extension);

        viewsWithLSP.set(filePath, { view, extension });
    };

    const fileEventsListenner = async (msg: string) => {
        const fileEvents: FileEvent[] = JSON.parse(msg);
        let restart = false;
        for (const fileEvent of fileEvents) {
            if (fileEvent.type === FileEventType.CREATED) {
                restart = true;
                break;
            }
        }
        if (restart) {
            console.log("RESTARTING");
            await clientLSP.end();
            clientLSP = await createClientLSP(project);
            Array.from(viewsWithLSP.entries()).forEach(
                ([filePath, { view }]) => {
                    bindView(filePath, view);
                }
            );
        }
    };
    core_message.addListener("file-event", fileEventsListenner);

    return {
        bindView
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
