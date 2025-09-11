import { createCodeMirrorView } from "@fullstacked/codemirror-view";
import { oneDark } from "@codemirror/theme-one-dark"
import { Transport, LSPClient, languageServerExtensions } from "@codemirror/lsp-client"
import { basicSetup, EditorView } from "codemirror"
import { Project } from "../../../types";
import fs from "../../../../fullstacked_modules/fs";
import * as directories from "../../../editor_modules/directories";
import * as lsp from "../../../editor_modules/lsp";

export type Workspace = ReturnType<typeof createWorkspace>;

type TransportHandler = (value: string) => void;

function createTransport(): Transport & { destroy: () => void } {
    const handlers = new Set<TransportHandler>();

    // core: callback LSP RESPONSE
    // sock.onmessage = e => { for (let h of handlers) h(e.data.toString()) }
    return {
        send(message: string) { 
            // core: LSP REQUEST
            lsp.request(message);
        },
        subscribe(handler: TransportHandler) { handlers.add(handler) },
        unsubscribe(handler: TransportHandler) { handlers.delete(handler) },
        destroy() { }
    }
}



// core: GET ROOT DIRECTORY
const rootBaseUri = await directories.root();

export function createWorkspace(project: Project) {
    const element = document.createElement("div");
    element.classList.add("editor");

    const rootUri = `file://${rootBaseUri}/${project.id}`;

    const lspTransport = createTransport()

    const client = new LSPClient({ 
        rootUri,
        extensions: languageServerExtensions()
    }).connect(lspTransport)

    const add = async (projectFilePath: string) => {
        const contents = await fs.readFile(`${project.id}/${projectFilePath}`, { encoding: "utf8" });

        const filePathUri = `${rootUri}/${projectFilePath}`;
        const view = createCodeMirrorView({
            contents,
            language: "typescript",
            extensions: [
                oneDark,
                client.plugin(filePathUri),
            ]
        })

        element.append(view.element);
    }

    const destroy = () => {
        lspTransport.destroy();
    }

    return {
        element,
        add,
        destroy
    }
} 