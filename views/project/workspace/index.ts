import { createCodeMirrorView } from "@fullstacked/codemirror-view";
import { oneDark } from "@codemirror/theme-one-dark";
import {
    Transport,
    LSPClient,
    languageServerExtensions
} from "@codemirror/lsp-client";
import { basicSetup, EditorView } from "codemirror";
import { Project } from "../../../types";
import core_message from "../../../../fullstacked_modules/core_message";
import { setDiagnostics } from "@codemirror/lint";
import { compilerOptions } from "./tsconfig";
import { insertCompletionText } from "@codemirror/autocomplete";
import { createLSP } from "./lsp";
import fs from "../../../../fullstacked_modules/fs";

export type Workspace = ReturnType<typeof createWorkspace>;

export function createWorkspace(project: Project) {
    const element = document.createElement("div");
    element.classList.add("workspace");

    const lsp = createLSP(project);

    const add = async (projectFilePath: string) => {
        console.log((await lsp).client.workspace.files)
        const contents = await fs.readFile(`${project.id}/${projectFilePath}`, {
            encoding: "utf8"
        });

        const view = createCodeMirrorView({
            contents,
            language: "typescript",
            extensions: [
                oneDark
            ]
        });

        lsp.then(l => view.extensions.add(l.plugin(projectFilePath)))

        element.append(view.element);
    };

    const destroy = async () => {
        (await lsp).destroy();
    };

    return {
        element,
        add,
        destroy
    };
}
