import { createCodeMirrorView } from "@fullstacked/codemirror-view";
import { oneDark } from "@codemirror/theme-one-dark";
import {
    Transport,
    LSPClient,
    languageServerExtensions
} from "@codemirror/lsp-client";
import { basicSetup, EditorView } from "codemirror";
import { Project } from "../../../types";
import fs from "../../../../fullstacked_modules/fs";
import * as directories from "../../../editor_modules/directories";
import * as lsp from "../../../editor_modules/lsp";
import core_message from "../../../../fullstacked_modules/core_message";
import { setDiagnostics } from "@codemirror/lint";

export type Workspace = ReturnType<typeof createWorkspace>;

type TransportHandler = (value: string) => void;

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

const rootBaseUri = await directories.root();

function toSeverity(sev: number) {
    return sev == 1
        ? "error"
        : sev == 2
          ? "warning"
          : sev == 3
            ? "info"
            : "hint";
}

export function createWorkspace(project: Project) {
    const element = document.createElement("div");
    element.classList.add("editor");

    const rootUri = `file://${rootBaseUri}/${project.id}`;

    let lspTransport: Awaited<ReturnType<typeof createTransport>>;

    const add = async (projectFilePath: string) => {
        const contents = await fs.readFile(`${project.id}/${projectFilePath}`, {
            encoding: "utf8"
        });

        lspTransport = await createTransport(project);

        const client = new LSPClient({
            rootUri,
            extensions: languageServerExtensions()
        }).connect(lspTransport);

        const runDiagnostics = () => {
            originalRequest("textDocument/diagnostic", {
                textDocument: {
                    uri: filePathUri
                }
            }).then((diagnostics) => {
                view.editorView.dispatch(
                    setDiagnostics(
                        view.editorView.state,
                        diagnostics.items.map((item) => ({
                            from:
                                view.editorView.state.doc.line(
                                    item.range.start.line + 1
                                ).from + item.range.start.character,
                            to:
                                view.editorView.state.doc.line(
                                    item.range.end.line + 1
                                ).from + item.range.end.character,
                            severity: toSeverity(item.severity),
                            message: item.message
                        }))
                    )
                );
            });
        };

        client.initializing.then(runDiagnostics);

        const originalRequest = client.request.bind(client);
        client.request = (method: string, params: any) => {
            if (
                method === "textDocument/completion" &&
                params?.context?.triggerCharacter !== undefined
            ) {
                delete params.context.triggerCharacter;
            }
            return originalRequest(method, params);
        };
        const originalNotification = client.notification.bind(client);
        client.notification = (method: string, params: any) => {
            if (method === "textDocument/didChange") {
                setTimeout(runDiagnostics, 500);
            }
            return originalNotification(method, params);
        };

        const filePathUri = `${rootUri}/${projectFilePath}`;
        const view = createCodeMirrorView({
            contents,
            language: "typescript",
            extensions: [oneDark, client.plugin(filePathUri, "typescript")]
        });

        element.append(view.element);
    };

    const destroy = () => {
        lspTransport.destroy();
    };

    return {
        element,
        add,
        destroy
    };
}
