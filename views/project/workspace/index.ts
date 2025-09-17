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
import { FileEvent, FileEventType } from "../file-event";

export type Workspace = ReturnType<typeof createWorkspace>;

function createTabs(actions: {
    open: (filePath: string) => void;
    close: (filePath: string) => void;
}) {
    const element = document.createElement("div");
    element.classList.add("tabs");

    const tabs = new Map<string, HTMLElement>();

    const setActive = (filePath: string) => {
        Array.from(tabs.entries()).forEach(([f, tab]) => {
            if (filePath === f) {
                tab.classList.add("active");
                tab.scrollIntoView();
            } else {
                tab.classList.remove("active");
            }
        });
    };

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

function createHistoryNavigation(actions: {
    open: (filePath: string, pos: number, fromHistory: true) => void;
}) {
    let history: {
        filePath: string;
        pos: number;
    }[] = [];

    const element = document.createElement("div");
    element.classList.add("history");

    const back = Button({
        style: "icon-small",
        iconRight: "Arrow 2"
    });
    back.disabled = true;
    back.onclick = () => {
        cursor--;
        const { filePath, pos } = history.at(cursor);
        actions.open(filePath, pos, true);
        refreshState();
    };
    const next = Button({
        style: "icon-small",
        iconRight: "Arrow 2"
    });
    next.onclick = () => {
        cursor++;
        const { filePath, pos } = history.at(cursor);
        actions.open(filePath, pos, true);
        refreshState();
    };
    next.disabled = true;
    element.append(back, next);

    let cursor = 0;

    const refreshState = () => {
        back.disabled = cursor <= 0;
        next.disabled = cursor >= history.length - 1;
    };

    return {
        element,
        push(filePath: string, pos: number) {
            const lastState = history.at(cursor);
            if (lastState?.filePath === filePath && lastState?.pos === pos)
                return;

            history = history.slice(0, cursor + 1);
            history.push({ filePath, pos });
            cursor = history.length - 1;
            refreshState();
        },
        close(filePath: string, openedFiles: string[]) {
            if (
                !history.at(cursor)?.filePath ||
                history.at(cursor).filePath !== filePath
            )
                return;

            const restoreState = (i: number) => {
                const state = history.at(i);
                if (
                    state.filePath !== filePath &&
                    openedFiles.includes(state.filePath)
                ) {
                    actions.open(state.filePath, state.pos, true);
                    cursor = i;
                    refreshState();
                    return true;
                }
                return false;
            };

            for (let i = cursor; i >= 0; i--) {
                if (restoreState(i)) return;
            }

            for (let i = history.length - 1; i > cursor; i--) {
                if (restoreState(i)) return;
            }
        },
        remove(filePath: string) {
            for (let i = history.length - 1; i >= 0; i--) {
                if (history.at(i).filePath === filePath) {
                    history.splice(i, 1);
                    if (i <= cursor) {
                        cursor--;
                    }
                }
            }
            const lastState = history.at(cursor);
            if (lastState) {
                actions.open(lastState.filePath, lastState.pos, true);
            }
            refreshState();
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
        pos?: { line: number; character: number } | number,
        fromHistory?: boolean
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

            view.setLanguage(
                projectFilePath.split(".").pop() as SupportedLanguage
            );

            if (lspSupportedFile(projectFilePath)) {
                view.extensions.add(lintGutter());
                lsp.then((l) => {
                    l.bindView(projectFilePath, view);
                });
            }

            view.extensions.add(
                EditorView.domEventHandlers({
                    click: (e: MouseEvent) => {
                        if (e.ctrlKey || e.metaKey) return;
                        const pos = view.editorView.posAtCoords({
                            x: e.clientX,
                            y: e.clientY
                        });
                        history.push(projectFilePath, pos);
                    }
                })
            );
        }

        if (!activeView) {
            container.append(view.element);
        } else {
            activeView.element.replaceWith(view.element);
        }

        if (pos) {
            view.goTo(pos);
        }

        if (!fromHistory) {
            const position =
                typeof pos === "number"
                    ? pos
                    : pos
                      ? view.editorView.state.doc.line(pos.line).from +
                        pos.character
                      : null;

            history.push(projectFilePath, position || 0);
        }

        activeView = view;
    };

    const close = (filePath: string) => {
        tabs.close(filePath);

        const view = views.get(filePath);
        view?.remove();
        if (view === activeView) {
            activeView = null;
        }
        views.delete(filePath);

        history.close(filePath, Array.from(views.keys()));
    };

    const history = createHistoryNavigation({ open });
    const tabs = createTabs({ open, close });
    const topRow = document.createElement("div");
    topRow.append(history.element, tabs.element);

    const container = document.createElement("div");
    container.classList.add("code-view");

    element.append(topRow, container);

    const lsp = createLSP(project, { open });

    const fileEventsListener = (msg: string) => {
        const fileEvents: FileEvent[] = JSON.parse(msg);
        for (const fileEvent of fileEvents) {
            switch (fileEvent.type) {
                case FileEventType.DELETED:
                    const filePathAbs = fileEvent.paths.at(0);
                    if (filePathAbs.includes(project.id)) {
                        const projectFilePath = filePathAbs
                            .split(project.id)
                            .pop()
                            .slice(1);
                        if (projectFilePath) {
                            close(projectFilePath);
                            history.remove(projectFilePath);
                        }
                    }
                    return;
                case FileEventType.RENAME:
            }
        }
    };
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
