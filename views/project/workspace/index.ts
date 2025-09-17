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

const FILE_EVENT_ORIGIN = "code-editor";

function createTabs(actions: {
    open: (filePath: string) => void;
    close: (filePath: string) => void;
}) {
    const element = document.createElement("div");
    element.classList.add("tabs");

    const tabs = new Map<string, [HTMLElement, HTMLElement]>();

    const setActive = (filePath: string) => {
        Array.from(tabs.entries()).forEach(([f, tab]) => {
            if (filePath === f) {
                tab[0].classList.add("active");
                tab[0].scrollIntoView();
            } else {
                tab[0].classList.remove("active");
            }
        });
    };

    const displayDirectoryIfNeeded = () => {
        Array.from(tabs.entries()).forEach((tab) => {
            const otherTabs = Array.from(tabs.entries()).filter(t => t[0] !== tab[0]);
            const otherFileNames = otherTabs.map(([filePath]) => filePath.split("/").pop());
            const [filePath, [_, text]] = tab;
            const filePathComponents = filePath.split("/");
            console.log(filePathComponents.at(-1), otherFileNames)
            if (otherFileNames.includes(filePathComponents.at(-1))) {
                text.innerHTML = filePathComponents.at(-1) + 
                    `<small>${filePathComponents.at(-2) 
                        ? `../${filePathComponents.at(-2)}` 
                        : "/"
                    }</small>`
            } else {
                text.innerText = filePathComponents.at(-1);
            }
        });

    }

    return {
        element,
        open(filePath: string, oldPath?: string) {
            let tab = tabs.get(filePath);

            if (!tab) {
                tab = [document.createElement("div"), document.createElement("span")];
                tab[0].onclick = () => actions.open(filePath);

                tab[1].innerText = filePath.split("/").pop();

                const close = Button({
                    style: "icon-small",
                    iconRight: "Close"
                });

                close.onclick = (e) => {
                    e.stopPropagation();
                    actions.close(filePath);
                };

                tab[0].append(createDevIcon(filePath), tab[1], close);
                element.append(tab[0]);

                tabs.set(filePath, tab);
            }

            if (oldPath) {
                const oldTab = tabs.get(oldPath);
                if (oldTab) {
                    const wasActive = oldTab[0].classList.contains("active");
                    oldTab[0].replaceWith(tab[0]);
                    tabs.delete(oldPath);
                    if (wasActive) {
                        setActive(filePath);
                    }
                }
            } else {
                setActive(filePath);
            }

            displayDirectoryIfNeeded();
        },
        close(filePath: string) {
            const tab = tabs.get(filePath);
            tab?.at(0)?.remove();
            tabs.delete(filePath);

            displayDirectoryIfNeeded();
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
        replace(oldPath: string, newPath: string) {
            history = history.map(state => state.filePath === oldPath
                ? {
                    ...state,
                    filePath: newPath
                }
                : state)
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
        fromHistory?: boolean,
        oldPath?: string,
    ) => {
        let view = views.get(projectFilePath);

        if (!view) {
            const contents = await fs.readFile(`${project.id}/${projectFilePath}`, {
                encoding: "utf8"
            });
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

            const filePath = `${project.id}/${projectFilePath}`;
            view.addUpdateListener(async (contents) => {
                if ((await fs.exists(filePath)).isFile) {
                    await fs.writeFile(filePath, contents, FILE_EVENT_ORIGIN);
                }
            });

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

        tabs.open(projectFilePath, oldPath);

        if (!fromHistory) {
            if (oldPath) {
                history.replace(oldPath, projectFilePath)
            } else {
                const position =
                    typeof pos === "number"
                        ? pos
                        : pos
                            ? view.editorView.state.doc.line(pos.line).from +
                            pos.character
                            : null;

                history.push(projectFilePath, position || 0);
            }
            
        }

        if (oldPath) {
            const oldView = views.get(oldPath);
            if (oldView === activeView) {
                activeView = view;
            }
            views.delete(oldPath);
        } else {
            activeView = view;
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

    const closeTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
    const fileEventsListener = (msg: string) => {
        const fileEvents: FileEvent[] = JSON.parse(msg);
        for (const fileEvent of fileEvents) {
            if (fileEvent.origin === FILE_EVENT_ORIGIN) continue;

            const projectFilePath = fileEvent.paths.at(0).split(`${project.id}/`).pop();
            if (!projectFilePath) continue;

            const view = views.get(projectFilePath);
            if (!view) continue;

            switch (fileEvent.type) {
                case FileEventType.DELETED:
                    closeTimeouts.set(projectFilePath, setTimeout(() => {
                        close(projectFilePath);
                        history.remove(projectFilePath);
                    }, 100));
                    break;
                case FileEventType.CREATED:
                    const closeTimeout = closeTimeouts.get(projectFilePath);
                    if (closeTimeout) {
                        clearTimeout(closeTimeout);
                        fs.readFile(`${project.id}/${projectFilePath}`, { encoding: "utf8" })
                            .then(view.replaceContents)
                    }
                    break;
                case FileEventType.RENAME:
                    const newPath = fileEvent.paths.at(1).split(`${project.id}/`).pop();
                    open(
                        newPath, 
                        view.editorView.state.selection.main.head,
                        false,
                        projectFilePath
                    );
                    break;
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
