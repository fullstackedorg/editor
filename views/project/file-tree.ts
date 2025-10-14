import { createFileTree } from "@fullstacked/file-tree";
import { Project } from "../../types";
import { createElement } from "../../components/element";
import fs from "../../../fullstacked_modules/fs";
import { NEW_FILE_ID } from "../../constants";
import { Store } from "../../store";
import core_message from "../../../fullstacked_modules/core_message";
import { FileEvent, FileEventType } from "./file-event";
import { Button, ButtonGroup, Icon, InputText, Popover } from "@fullstacked/ui";
import { Workspace } from "./workspace";
import { createDevIcon } from "./dev-icons";
import { promptNewChat } from "../prompt";

const directoryIconOpen = Icon("Caret");
directoryIconOpen.classList.add("open");
const directoryIconClose = Icon("Caret");

const hide = ["/.build", "/.git", "/tsconfig.json"];

export function hideChatExtension(filePath: string) {
    if (filePath.endsWith(".chat")) {
        return filePath.slice(0, -".chat".length);
    } else {
        return filePath;
    }
}

export function FileTree(project: Project, workspace: Workspace) {
    const container = createElement("div");
    container.classList.add("file-tree-container");

    let creating: "file" | "directory" = null;
    let renaming = null;

    const fileTree = createFileTree({
        readDirectory: async (path: string) => {
            const content = await fs.readdir(project.id + "/" + path, {
                withFileTypes: true
            });
            return content.filter(
                (i) => !hide.find((h) => (path + "/" + i.name).startsWith(h))
            );
        },
        isDirectory: async (path: string) => {
            if (creating && (!path || path.endsWith("/"))) {
                return creating === "directory";
            }
            return !(await fs.exists(project.id + "/" + path))?.isFile;
        },
        indentWidth: 15,
        directoryIcons: {
            open: directoryIconOpen,
            close: directoryIconClose
        },
        prefix: (path) => {
            return createDevIcon(path);
        },
        name: (path) => {
            if (creating && (!path || path.endsWith("/"))) {
                return fileItemInput(project.id + "/" + path, creating, () => {
                    creating = null;
                    fileTree.removeItem(path);
                });
            } else if (path !== renaming) {
                if (path.endsWith(".chat")) {
                    const span = document.createElement("span");
                    span.innerText = hideChatExtension(path.split("/").pop());
                    return span;
                }
                return null;
            }

            return fileItemInput(project.id + "/" + path, null, () => {
                renaming = null;
                fileTree.refreshItem(path);
            });
        },
        suffix: (path) => {
            const button = Button({
                style: "icon-small",
                iconLeft: "Options"
            });

            button.onclick = (e) => {
                e.stopPropagation();

                const renameButton = Button({
                    text: "Rename",
                    iconLeft: "Edit"
                });

                renameButton.onclick = () => {
                    renaming = path;
                    fileTree.refreshItem(path);
                };

                const deleteButton = Button({
                    text: "Delete",
                    iconLeft: "Trash",
                    color: "red"
                });

                deleteButton.onclick = () => {
                    const pathAbs = project.id + "/" + path;
                    fs.exists(pathAbs).then((exists) => {
                        if (!exists) return;

                        if (exists.isFile) {
                            fs.unlink(pathAbs);
                        } else {
                            fs.rmdir(pathAbs);
                        }
                    });
                };

                const buttonGroup = ButtonGroup([renameButton, deleteButton]);

                Popover({
                    anchor: button,
                    content: buttonGroup,
                    align: {
                        x: "left",
                        y: "top"
                    }
                });
            };

            return button;
        },
        onSelect: (path) => {
            const pathAbs = project.id + "/" + path;
            fs.exists(pathAbs).then(async (exists) => {
                if (!exists?.isFile) return;
                workspace.open(path);
            });
        },
        onRename: async (oldPath, newPath) => {
            const oldPathAbs = project.id + "/" + oldPath;
            const newPathAbs = project.id + "/" + newPath;
            if (await fs.exists(newPathAbs)) return;

            await fs.rename(oldPathAbs, newPathAbs);
            fileTree.removeItem(oldPath);
            fileTree.addItem(newPath);
        }
    });

    const pathAbsToRelative = (p: string) => {
        const pathComponents = p.split(project.id + "/");
        if (pathComponents.length !== 2) {
            return null;
        }
        return pathComponents.at(-1);
    };

    const onFileEvents = (e: string) => {
        let fileEvents = (JSON.parse(e) as FileEvent[])
            .map((e) => {
                e.paths = e.paths.map(pathAbsToRelative);
                return e;
            })
            .filter(
                (e) =>
                    !e.paths.some(
                        (p) =>
                            p === null ||
                            hide.find((h) => ("/" + p).startsWith(h))
                    )
            );

        for (const event of fileEvents) {
            switch (event.type) {
                case FileEventType.CREATED:
                    fileTree.addItem(event.paths.at(0));
                    break;
                case FileEventType.RENAME:
                    fileTree.removeItem(event.paths.at(0));
                    fileTree.addItem(event.paths.at(1));
                    break;
                case FileEventType.DELETED:
                    fileTree.removeItem(event.paths.at(0));
                    break;
            }
        }
    };

    core_message.addListener("file-event", onFileEvents);
    container.ondestroy = () => {
        core_message.removeListener("file-event", onFileEvents);
    };

    const createFile = (parent: string) => {
        creating = "file";
        fileTree.addItem(parent + "");
    };
    const createDirectory = (parent: string) => {
        creating = "directory";
        fileTree.addItem(parent + "");
    };
    const create = async (directory: boolean) => {
        const activeItem = Array.from(fileTree.getActiveItems()).at(0);
        let parent = "";
        if (activeItem) {
            const exists = await fs.exists(project.id + "/" + activeItem);
            const pathComponents = exists.isFile
                ? activeItem.split("/").slice(0, -1)
                : activeItem.split("/");
            parent =
                pathComponents.length > 0 ? pathComponents.join("/") + "/" : "";
        }

        return directory ? createDirectory(parent) : createFile(parent);
    };

    container.append(TopActions(project, fileTree, create), fileTree.container);

    return container;
}

function TopActions(
    project: Project,
    fileTree: ReturnType<typeof createFileTree>,
    create: (directory: boolean) => void
) {
    const container = createElement("div");

    const left = document.createElement("div");
    const toggleSidePanel = Button({
        style: "icon-small",
        iconLeft: "Side Panel"
    });
    toggleSidePanel.onclick = () => {
        Store.editor.setSidePanelClosed(true);
    };
    left.append(toggleSidePanel);

    const right = document.createElement("div");
    const newChatButton = Button({
        style: "icon-small",
        iconLeft: "Glitter"
    });
    newChatButton.onclick = () => promptNewChat();

    const newFileButton = Button({
        style: "icon-small",
        iconLeft: "File Add"
    });
    newFileButton.id = NEW_FILE_ID;
    newFileButton.onclick = () => create(false);

    const newDirectoryButton = Button({
        style: "icon-small",
        iconLeft: "Directory Add"
    });
    newDirectoryButton.onclick = () => create(true);

    const uploadButton = Button({
        style: "icon-small",
        iconLeft: "Upload"
    });
    uploadButton.classList.add("import-file");
    const form = document.createElement("form");
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.onchange = async () => {
        const file = fileInput.files[0];
        if (!file) {
            form.reset();
            return;
        }

        const activeItem = Array.from(fileTree.getActiveItems()).at(0);

        let filePath = "";
        if (activeItem) {
            const exists = await fs.exists(project.id + "/" + activeItem);
            if (!exists) {
                throw Error("trying to upload under unknown file");
            }
            const components = exists.isFile
                ? activeItem.split("/").slice(0, -1)
                : activeItem.split("/");
            filePath += components.length > 0 ? components.join("/") + "/" : "";
        }
        filePath += file.name;

        const path = project.id + "/" + filePath;
        const data = new Uint8Array(await file.arrayBuffer());

        fs.writeFile(path, data, "file-tree");
        form.reset();
    };
    form.append(fileInput);
    uploadButton.append(form);
    uploadButton.onclick = (e) => {
        e.stopPropagation();
        fileInput.click();
    };

    right.append(
        newChatButton,
        newFileButton,
        newDirectoryButton,
        uploadButton
    );

    container.append(left, right);

    return container;
}

function fileItemInput(
    path: string,
    create: "file" | "directory",
    onSubmit: () => void
) {
    const pathComponents = path.split("/");
    const name = pathComponents.pop();
    const parent = pathComponents.join("/");

    const submit = async () => {
        if (inputText.input.value !== name) {
            if (create === "directory") {
                await fs.mkdir(parent + "/" + inputText.input.value);
            } else if (create === "file") {
                await fs.writeFile(parent + "/" + inputText.input.value, "\n");
            } else {
                await fs.rename(path, parent + "/" + inputText.input.value);
            }
        }
        onSubmit();
    };

    const form = document.createElement("form");

    form.onsubmit = (e) => {
        e.preventDefault();
        submit();
    };

    const inputText = InputText();
    inputText.input.value = name;
    inputText.input.onclick = (e) => e.stopPropagation();
    inputText.input.onblur = submit;

    form.append(inputText.container);

    const dotIndex = name.lastIndexOf(".");
    setTimeout(() => {
        inputText.input.focus();

        if (inputText.input.value) {
            inputText.input.setSelectionRange(
                0,
                dotIndex === -1 ? name.length : dotIndex
            );
        }
    });

    return form;
}
