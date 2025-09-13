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
import { setDiagnostics, lintGutter } from "@codemirror/lint";
import { compilerOptions } from "./tsconfig";
import { insertCompletionText } from "@codemirror/autocomplete";
import { createLSP } from "./lsp";
import fs from "../../../../fullstacked_modules/fs";
import { SupportedLanguage } from "@fullstacked/codemirror-view/languages";
import { gutter } from "@codemirror/view";

export type Workspace = ReturnType<typeof createWorkspace>;

export function createWorkspace(project: Project) {
    const element = document.createElement("div");
    element.classList.add("workspace");

    const container = document.createElement("div");
    element.append(container);

    const cmContainer = document.createElement("div");
    container.append(cmContainer);

    const lsp = createLSP(project);

    const add = async (projectFilePath: string) => {
        const contents = await fs.readFile(`${project.id}/${projectFilePath}`, {
            encoding: "utf8"
        });

        const view = createCodeMirrorView({
            contents,
            extensions: [oneDark, lintGutter()]
        });

        view.setLanguage(projectFilePath.split(".").pop() as SupportedLanguage);

        lsp.then((l) => {
            view.extensions.add(l.plugin(projectFilePath));
            l.runDiagnostics(projectFilePath);
        });

        cmContainer.append(view.element);
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
