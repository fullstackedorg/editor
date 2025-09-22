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
import { Button, Icon, Popover } from "@fullstacked/ui";
import { createDevIcon } from "../dev-icons";
import { FileEvent, FileEventType } from "../file-event";
import { Store } from "../../../store";
import { BuildError } from "../../../store/editor";
import { sassSupportedFile, sassSetDiagnostic } from "./sass";
import { createViewImage, imageSupportedFile } from "./image";
import { binarySupportedFile, createViewBinary } from "./binary";
import { file } from "zod";
import { restore } from "../../../../fullstacked_modules/git";

export type Workspace = ReturnType<typeof createWorkspace>;

const FILE_EVENT_ORIGIN = "code-editor";

function createTabs(
    project: Project,
    actions: {
        open: (filePath: string) => void;
        close: (filePath: string) => void;
    }
) {
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
            const otherTabs = Array.from(tabs.entries()).filter(
                (t) => t[0] !== tab[0]
            );
            const otherFileNames = otherTabs.map(([filePath]) =>
                filePath.split("/").pop()
            );
            const [filePath, [_, text]] = tab;
            const filePathComponents = filePath.split("/");
            if (otherFileNames.includes(filePathComponents.at(-1))) {
                text.innerHTML =
                    filePathComponents.at(-1) +
                    `<small>${
                        filePathComponents.at(-2)
                            ? `../${filePathComponents.at(-2)}`
                            : "/"
                    }</small>`;
            } else {
                text.innerText = filePathComponents.at(-1);
            }
        });
    };

    const onBuildErrors = (buildErrors: BuildError[]) => {
        Array.from(tabs.entries()).forEach(([filePath, [tab]]) => {
            if (
                buildErrors.find(
                    ({ file }) =>
                        file.split(project.id + "/").pop() === filePath
                )
            ) {
                tab.classList.add("has-error");
            } else {
                tab.classList.remove("has-error");
            }
        });
    };
    Store.editor.codeEditor.buildErrors.subscribe(onBuildErrors);

    return {
        element,
        destroy() {
            Store.editor.codeEditor.buildErrors.unsubscribe(onBuildErrors);
        },
        open(filePath: string, oldPath?: string) {
            let tab = tabs.get(filePath);

            if (!tab) {
                tab = [
                    document.createElement("div"),
                    document.createElement("span")
                ];
                tab[0].onclick = () => actions.open(filePath);
                const filePathEl = document.createElement("div");
                filePathEl.classList.add("file-path-helper");
                let popover: ReturnType<typeof Popover>;
                let popoverDelayTimeout: ReturnType<typeof setTimeout>;
                filePathEl.innerText = filePath;
                const remove = () => {
                    setTimeout(() => popover?.remove(), 500);
                    window.removeEventListener("mousemove", remove);
                };
                tab[0].onmouseenter = () => {
                    popoverDelayTimeout = setTimeout(() => {
                        const bb = tab[0].getBoundingClientRect();
                        if (bb.height === 0) return;
                        popover = Popover({
                            content: filePathEl,
                            align: {
                                x: "center",
                                y: "bottom"
                            },
                            anchor: tab[0]
                        });
                        setTimeout(() => {
                            window.addEventListener("mousemove", remove);
                        }, 500);
                    }, 1000);
                };
                tab[0].onmouseleave = () => {
                    clearTimeout(popoverDelayTimeout);
                };

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

            const hasBuildErrors = Store.editor.codeEditor.buildErrors
                .check()
                .find(
                    ({ file }) =>
                        file.split(project.id + "/").pop() === filePath
                );
            if (hasBuildErrors) {
                tab[0].classList.add("has-error");
            } else {
                tab[0].classList.remove("has-error");
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
            history = history.map((state) =>
                state.filePath === oldPath
                    ? {
                          ...state,
                          filePath: newPath
                      }
                    : state
            );
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

type ViewCode = Awaited<ReturnType<typeof createViewCode>>;
type ViewImage = ReturnType<typeof createViewImage>;
type ViewBinary = ReturnType<typeof createViewBinary>;

async function createViewCode(
    project: Project,
    projectFilePath: string,
    lsp: ReturnType<typeof createLSP>,
    history: ReturnType<typeof createHistoryNavigation>
) {
    const contents = await fs.readFile(`${project.id}/${projectFilePath}`, {
        encoding: "utf8"
    });

    const view = createCodeMirrorView({
        contents,
        extensions: [
            oneDark,
            EditorView.clickAddsSelectionRange.of((e) => e.altKey && !e.metaKey)
        ]
    });

    const save = async () => {
        if ((await fs.exists(filePath))?.isFile) {
            await fs.writeFile(filePath, view.value, FILE_EVENT_ORIGIN);
        }
    };

    const filePath = `${project.id}/${projectFilePath}`;
    view.addUpdateListener(save);

    view.setLanguage(projectFilePath.split(".").pop() as SupportedLanguage);

    const lspSupport = lspSupportedFile(projectFilePath);
    const sassSupport = sassSupportedFile(projectFilePath);

    if (lspSupport || sassSupport) {
        view.extensions.add(lintGutter());

        if (lspSupport) {
            lsp.then((l) => {
                l.bindView(projectFilePath, view);
            });
        }
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

    let scroll = {
        top: 0,
        left: 0
    };
    view.editorView.scrollDOM.addEventListener("scroll", () => {
        scroll.top = view.editorView.scrollDOM.scrollTop;
        scroll.left = view.editorView.scrollDOM.scrollLeft;
    });

    return {
        ...view,
        type: "code",
        save,
        restoreScroll(){
            view.editorView.scrollDOM.scrollTo(scroll);
        },
        reloadContents() {
            fs.readFile(`${project.id}/${projectFilePath}`, {
                encoding: "utf8"
            }).then(view.replaceContents);
        }
    };
}

export function createWorkspace(project: Project) {
    const element = document.createElement("div");
    element.classList.add("workspace");

    let activeView: ViewCode | ViewImage | ViewBinary = null;
    const views = new Map<string, typeof activeView>();

    const open = async (
        projectFilePath: string,
        pos?: { line: number; character: number } | number,
        fromHistory?: boolean,
        oldPath?: string
    ) => {
        let view = views.get(projectFilePath);

        if (!view) {
            let newView: typeof activeView;
            if (imageSupportedFile(projectFilePath)) {
                newView = createViewImage(project, projectFilePath);
            } else if (
                lspSupportedFile(projectFilePath) ||
                sassSupportedFile(projectFilePath)
            ) {
                newView = await createViewCode(
                    project,
                    projectFilePath,
                    lsp,
                    history
                );
            } else if (binarySupportedFile(projectFilePath)) {
                newView = createViewBinary(project, projectFilePath);
            } else {
                const fileSize = (
                    await fs.stat(`${project.id}/${projectFilePath}`)
                ).size;
                if (fileSize < 1e6) {
                    // 1mb
                    newView = await createViewCode(
                        project,
                        projectFilePath,
                        lsp,
                        history
                    );
                } else {
                    newView = createViewBinary(project, projectFilePath);
                }
            }

            views.set(projectFilePath, newView);
            view = newView;
        }

        if (activeView === view && !oldPath && view.type === "code") {
            (view as ViewCode).format();
        }

        if (lspSupportedFile(projectFilePath)) {
            lsp.then((l) => l.runDiagnostics(projectFilePath));
        } else if (sassSupportedFile(projectFilePath)) {
            sassSetDiagnostic(
                project,
                projectFilePath,
                (view as ViewCode).editorView
            );
        }

        if (!activeView) {
            container.append(view.element);
        } else {
            activeView.element.replaceWith(view.element);
        }

        if (pos) {
            (view as ViewCode).goTo(pos);
        }

        tabs.open(projectFilePath, oldPath);

        if (!fromHistory) {
            if (oldPath) {
                history.replace(oldPath, projectFilePath);
            } else {
                const position =
                    typeof pos === "number"
                        ? pos
                        : pos
                          ? (view as ViewCode).editorView.state.doc.line(
                                pos.line
                            ).from + pos.character
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

        if(view.type === "code") {
            (view as ViewCode).restoreScroll();
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
    const tabs = createTabs(project, { open, close });
    const topRow = document.createElement("div");
    topRow.append(history.element, tabs.element);

    const container = document.createElement("div");
    container.classList.add("view-container");

    element.append(topRow, container);

    const lsp = createLSP(project, { open });

    const closeTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
    const fileEventsListener = (msg: string) => {
        const fileEvents: FileEvent[] = JSON.parse(msg);
        for (const fileEvent of fileEvents) {
            if (fileEvent.origin === FILE_EVENT_ORIGIN) continue;

            const projectFilePath = fileEvent.paths
                .at(0)
                .split(`${project.id}/`)
                .pop();
            if (!projectFilePath) continue;

            const view = views.get(projectFilePath);
            if (!view) continue;

            switch (fileEvent.type) {
                case FileEventType.DELETED:
                    closeTimeouts.set(
                        projectFilePath,
                        setTimeout(() => {
                            close(projectFilePath);
                            history.remove(projectFilePath);
                        }, 100)
                    );
                    break;
                case FileEventType.CREATED:
                    const closeTimeout = closeTimeouts.get(projectFilePath);
                    if (closeTimeout) {
                        clearTimeout(closeTimeout);
                        view.reloadContents();
                    }
                    break;
                case FileEventType.RENAME:
                    const newPath = fileEvent.paths
                        .at(1)
                        .split(`${project.id}/`)
                        .pop();
                    open(
                        newPath,
                        (view as ViewCode)?.editorView?.state?.selection?.main
                            ?.head,
                        false,
                        projectFilePath
                    );
                    break;
            }
        }
    };
    core_message.addListener("file-event", fileEventsListener);

    const buildErrorsListener = async (buildErrors: BuildError[]) => {
        const projectFilePaths = new Set(
            buildErrors
                .filter(({ file }) => file.includes(project.id))
                .map(({ file }) => file.split(project.id + "/").pop())
        );
        const l = await lsp;
        Array.from(views.entries()).filter(([projectFilePath, view]) => {
            if (lspSupportedFile(projectFilePath)) {
                l.runDiagnostics(projectFilePath);
            } else if (sassSupportedFile(projectFilePath)) {
                sassSetDiagnostic(
                    project,
                    projectFilePath,
                    (view as ViewCode).editorView
                );
            }
        });
        projectFilePaths.forEach((f) => open(f));
    };
    Store.editor.codeEditor.buildErrors.subscribe(buildErrorsListener);

    const destroy = async () => {
        (await lsp).destroy();
        core_message.removeListener("file-event", fileEventsListener);
        Store.editor.codeEditor.buildErrors.unsubscribe(buildErrorsListener);
        tabs.destroy();
    };

    return {
        element,
        open,
        destroy,
        save: async () => {
            const codeViews = Array.from(views.values()).filter(
                ({ type }) => type === "code"
            ) as ViewCode[];
            return Promise.all(codeViews.map((v) => v.save()));
        }
    };
}
