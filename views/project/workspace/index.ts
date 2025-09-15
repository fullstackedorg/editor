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
import { FileEvent, FileEventType } from "../file-event";

export type Workspace = ReturnType<typeof createWorkspace>;

function createTabs(actions: { 
    open: (filePath: string) => void,
    close: (filePath: string) => void
}) {
    const element = document.createElement("div");
    element.classList.add("tabs");

    const tabs = new Map<string, HTMLElement>();

    const setActive = (filePath: string) => {
        Array.from(tabs.entries()).forEach(([f, tab]) => {
            if (filePath === f) {
                tab.classList.add("active");
            } else {
                tab.classList.remove("active");
            }
        })
    }

    return {
        element,
        open(filePath: string) {
            let tab = tabs.get(filePath);

            if (!tab) {
                tab = document.createElement("div");
                tab.onclick = () => actions.open(filePath);

                const text = document.createElement("span");
                text.innerText = filePath;

                const close = Button({
                    style: "icon-small",
                    iconRight: "Close"
                });

                close.onclick = (e) => {
                    e.stopPropagation();
                    actions.close(filePath);
                };

                tab.append(createDevIcon(filePath), text, close);
                element.append(tab);

                tabs.set(filePath, tab);
            }

            setActive(filePath);
        },
        close(filePath: string) {
            const tab = tabs.get(filePath);
            tab?.remove();
            tabs.delete(filePath);
        }
    };
}

export function createWorkspace(project: Project) {
    const element = document.createElement("div");
    element.classList.add("workspace");

    let activeView: ReturnType<typeof createCodeMirrorView> = null;
    const views = new Map<string, typeof activeView>();

    const open = async (
        projectFilePath: string,
        pos?: { line: number; character: number }
    ) => {
        const contents = await fs.readFile(`${project.id}/${projectFilePath}`, {
            encoding: "utf8"
        });

        tabs.open(projectFilePath);

        let view = views.get(projectFilePath);
        if (!view) {
            view = createCodeMirrorView({
                contents,
                extensions: [
                    oneDark,
                    EditorView.clickAddsSelectionRange.of(
                        (e) => e.altKey && !e.metaKey
                    )
                ]
            });
            views.set(projectFilePath, view);

            view.setLanguage(projectFilePath.split(".").pop() as SupportedLanguage);

            if (lspSupportedFile(projectFilePath)) {
                view.extensions.add(lintGutter());
                lsp.then((l) => {
                    l.bindView(projectFilePath, view);
                });
            }

            view.extensions.add(EditorView.updateListener.of((update) => {
                if (update.selectionSet && !update.docChanged) {
                    const head = update.state.selection.main.head;
                    console.log("Navigation:", head);
                }
            }))
        }

        if (!activeView) {
            container.append(view.element);
        } else {
            activeView.element.replaceWith(view.element);
        }

        activeView = view;

        if (pos) {
            view.goTo(pos.line, pos.character);
        }
    };

    const close = (filePath: string) => {
        tabs.close(filePath);

        const view = views.get(filePath);
        view?.remove();
        if (view === activeView) {
            activeView = null;

        }
        views.delete(filePath);
    };

    const tabs = createTabs({ open, close });
    const container = document.createElement("div");
    container.classList.add("code-view");

    element.append(tabs.element, container);

    const lsp = createLSP(project, { open });

    const fileEventsListener = (msg: string) => {
        const fileEvents: FileEvent[] = JSON.parse(msg);
        for (const fileEvent of fileEvents) {
            switch (fileEvent.type) {
                case FileEventType.DELETED:
                    const filePathAbs = fileEvent.paths.at(0);
                    if (filePathAbs.includes(project.id)) {
                        const projectFilePath = filePathAbs.split(project.id).pop().slice(1);
                        if (projectFilePath) {
                            close(projectFilePath);
                        }
                    }
                    return;
                case FileEventType.RENAME:

            }
        }
    }
    core_message.addListener("file-event", fileEventsListener);

    const destroy = async () => {
        (await lsp).destroy();
        core_message.removeListener("file-event", fileEventsListener);
    };

    return {
        element,
        open,
        destroy
    };
}
