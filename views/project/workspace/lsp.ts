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

type TransportHandler = (value: string) => void;

const rootBaseUri = await directories.root();


const supportedExtensions = [
    "ts",
    "tsx",
    "js",
    "jsx",
    "mjs",
    "cjs"
]

export function lspSupportedFile(filePath: string){
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

async function createTransport(
    project: Project
): Promise<Transport & { destroy: () => void }> {
    const transportId = await lsp.start(project);
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
        destroy() {
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

export async function createLSP(project: Project) {
    await tsConfig(project);
    const lspTransport = await createTransport(project);

    const rootUri = `file://${rootBaseUri}/${project.id}`;

    const client = new LSPClient({
        rootUri,
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
        runDiagnostics: (filePath: string) =>
            runDiagnostics(`${rootUri}/${filePath}`),
        plugin: (filePath: string) =>
            client.plugin(
                `${rootUri}/${filePath}`,
                filePathToLanguageId(filePath)
            ),
        destroy: () => {
            client.disconnect();
            lspTransport?.destroy();
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
