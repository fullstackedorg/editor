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
import { createLSP, lspSupportedFile } from "./lsp";
import fs from "../../../../fullstacked_modules/fs";
import { SupportedLanguage } from "@fullstacked/codemirror-view/languages";
import { gutter } from "@codemirror/view";
import { Button, Icon } from "@fullstacked/ui";
import { createDevIcon } from "../dev-icons";
import { file } from "zod";

export type Workspace = ReturnType<typeof createWorkspace>;

function createTabs(opts: { close: (filePath: string) => void }) {
    const element = document.createElement("div");
    element.classList.add("tabs");

    return {
        element,
        add(filePath: string) {
            const tab = document.createElement("div");

            const close = Button({
                style: "icon-small",
                iconRight: "Close"
            });

            close.onclick = () => {
                opts.close(filePath);
                tab.remove();
            };

            tab.append(createDevIcon(filePath), filePath, close);
            element.append(tab);
        }
    };
}

export function createWorkspace(project: Project) {
    const element = document.createElement("div");
    element.classList.add("workspace");

    let activeView: ReturnType<typeof createCodeMirrorView> = null;
    const views = new Map<string, typeof activeView>();

    const close = (filePath: string) => {
        const view = views.get(filePath);
        view?.remove();
        if (view === activeView) {
            activeView = null;
        }
        views.delete(filePath);
    };

    const tabs = createTabs({ close });
    const container = document.createElement("div");
    container.classList.add("code-view");

    element.append(tabs.element, container);

    const cmContainer = document.createElement("div");
    container.append(cmContainer);

    const lsp = createLSP(project);

    const add = async (projectFilePath: string) => {
        const contents = await fs.readFile(`${project.id}/${projectFilePath}`, {
            encoding: "utf8"
        });

        let view = views.get(projectFilePath);
        if (!view) {
            view = createCodeMirrorView({
                contents,
                extensions: [oneDark]
            });
            views.set(projectFilePath, view);
            tabs.add(projectFilePath);
        }

        view.setLanguage(projectFilePath.split(".").pop() as SupportedLanguage);

        if (lspSupportedFile(projectFilePath)) {
            view.extensions.add(lintGutter());
            lsp.then((l) => {
                view.extensions.add(l.plugin(projectFilePath));
                l.runDiagnostics(projectFilePath);
            });
        }

        if (!activeView) {
            cmContainer.append(view.element);
        } else {
            activeView.element.replaceWith(view.element);
        }

        activeView = view;
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
