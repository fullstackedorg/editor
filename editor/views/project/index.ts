import "./index.css";
import { Editor } from "../editor";
import { FileTree } from "../file-tree";
import { Console } from "../console";
import {
    DELETE_ALL_PACKAGES_ID,
    PROJECT_TITLE_ID,
    RUN_PROJECT_ID
} from "../../constants";
import GitWidget from "./git-widget";
import type esbuild from "esbuild";
import type { Project as TypeProject } from "../../api/projects/types";
import rpc from "../../rpc";
import api from "../../api";

export class Project {
    backAction: () => void;
    packagesView: boolean = false;

    private container: HTMLDivElement;
    private project: TypeProject;

    fileTree: {
        instance: FileTree;
        element: Awaited<ReturnType<FileTree["render"]>> | null;
    } = {
        instance: new FileTree(),
        element: null
    };
    console = new Console();

    private gitWidget = new GitWidget(
        this.reloadContent.bind(this),
        this.openFiles.bind(this)
    );

    private tabsContainer = document.createElement("ul");
    private editorsContainer = document.createElement("div");

    private currentFile: string;
    private editors: Editor[] = [];

    private runButton: HTMLButtonElement;

    constructor() {
        this.fileTree.instance.onItemSelect = (item) => {
            if (!item || item.isDirectory) return;

            const joinedPath = item.path.join("/");
            if (
                !this.editors.find(
                    ({ filePath }) => filePath.join("/") === joinedPath
                )
            ) {
                this.editors.push(new Editor(item.path));
            }

            this.currentFile = joinedPath;

            this.renderEditors();
        };

        const openConsole = () => {
            this.console.fitAddon.fit();
            this.container.classList.add("console-opened");
            setTimeout(() => {
                this.console.fitAddon.fit();
            }, 350);
        };

        const writeParagraph = (contents: string) => {
            contents.split("\n").forEach((ln) => this.console.term.writeln(ln));
        };

        (window as any).onPush["log"] = (message: string) => {
            const logs = JSON.parse(message);
            if (logs.length) {
                openConsole();
            }
            const str = logs
                .map((log) =>
                    typeof log === "string" ? log : JSON.stringify(log, null, 2)
                )
                .join("  ");
            writeParagraph(str);
        };
        (window as any).onPush["error"] = (message: string) => {
            openConsole();
            const error: { message: string; name: string; stack: string } =
                JSON.parse(message);
            writeParagraph(error.message);
            writeParagraph(error.name);
            writeParagraph(error.stack);
        };
    }

    openFiles(filepaths: string[]) {
        const editors = filepaths.map(
            (file) =>
                new Editor((this.project.location + "/" + file).split("/"))
        );
        this.editors = editors;
        this.currentFile = this.project.location + "/" + filepaths;
        this.renderEditors();
    }

    async reloadContent() {
        const fileTree = this.fileTree.element;
        this.fileTree.element = await this.fileTree.instance.render();
        fileTree.replaceWith(this.fileTree.element);

        const editors = [];
        const removeOrUpdate = (editor: Editor) =>
            new Promise<void>(async (resolve) => {
                const exists = await rpc().fs.exists(editor.filePath.join("/"));
                if (exists) {
                    editors.push(editor);
                    await editor.loadFileContents();
                }
                resolve();
            });
        const removeOrUpdatePromises = this.editors.map(removeOrUpdate);
        await Promise.all(removeOrUpdatePromises);
        this.editors = editors;
        return this.renderEditors();
    }

    setProject(project: TypeProject) {
        if (project === this.project) return;

        this.project = project;
        this.gitWidget.project = project;

        this.packagesView = false;

        this.fileTree.instance.setBaseDirectory(project.location);

        this.editors = [];
        this.renderEditors();
    }

    private installPackages(packagesToInstall: Map<string, Set<string>>) {
        const dialog = document.createElement("div");
        dialog.classList.add("dialog");

        const container = document.createElement("div");
        container.innerHTML = `<h1>Dependencies</h1>`;

        const packagesContainer = document.createElement("dl");
        const installPromises: Promise<void>[] = [];
        for (const [
            packageName,
            filesRequiringPackage
        ] of packagesToInstall.entries()) {
            const dt = document.createElement("dt");
            dt.innerText = packageName;
            const dd = document.createElement("dd");
            const ul = document.createElement("ul");
            for (const file of filesRequiringPackage) {
                const li = document.createElement("li");
                li.innerText = file;
                ul.append(li);
            }
            dd.append(ul);

            const status = document.createElement("div");
            status.innerText = "installing...";
            container.append(status);

            const installPromise = new Promise<void>((resolve) => {
                api
                    .packages.install(packageName)
                    .then(() => {
                        status.innerText = "installed";
                        resolve();
                    });
            });
            installPromises.push(installPromise);

            packagesContainer.append(dt, dd, status);
        }

        container.append(packagesContainer);
        dialog.append(container);
        this.container.append(dialog);

        Promise.all(installPromises).then(() => {
            dialog.remove();
            this.runProject();
        });
    }

    private processBuildErrors(errors: esbuild.BuildResult["errors"]){
        const packagesMissing = new Map<string, Set<string>>();
        errors.forEach((error) => {
            error = uncapitalizeKeys(error);

            const file = error.location?.file;

            const filename = file.split(this.project.location).pop();
            let filePath = this.project.location + filename;

            const message = error.text;

            if (message.startsWith("Could not resolve")) {
                const moduleName: string[] = message
                    .match(/\".*\"/)
                    ?.at(0)
                    ?.slice(1, -1)
                    .split("/");

                if (!moduleName.at(0)?.startsWith(".")) {
                    const dependency = moduleName.at(0)?.startsWith("@")
                        ? moduleName.slice(0, 2).join("/")
                        : moduleName.at(0);

                    if (dependency) {
                        let fileRequiringPackage =
                            packagesMissing.get(dependency);
                        if (!fileRequiringPackage)
                            fileRequiringPackage = new Set();
                        fileRequiringPackage.add(
                            filename.includes("node_modules")
                                ? "node_modules" +
                                        filename.split("node_modules").pop()
                                : filename.slice(1)
                        );
                        packagesMissing.set(
                            dependency,
                            fileRequiringPackage
                        );
                    }

                    return;
                }
            }

            let editor = this.editors.find(
                (activeEditor) =>
                    activeEditor.filePath.join("/") === filePath
            );
            if (!editor) {
                editor = new Editor(filePath.split("/"));
                this.editors.push(editor);
            }

            editor.addBuildError({
                line: error.location?.line,
                col: error.location?.column,
                length: error.location?.length,
                message
            });

            this.currentFile = filename;
        });

        this.renderEditors();

        console.log(packagesMissing);

        if (packagesMissing.size > 0) {
            this.installPackages(packagesMissing);
        }
    }

    async runProject() {
        if (this.runButton.getAttribute("loading")) return;

        this.runButton.setAttribute("loading", "1");
        const icon = this.runButton.innerHTML;
        this.runButton.innerHTML = `<div class="loader"></div>`;
        await Promise.all(
            this.editors.map((editor) => {
                editor.clearBuildErrors();
                return editor.updateFile();
            })
        );
        this.renderEditors();
        this.console.term.clear();
        setTimeout(async () => {
            const buildErrors = await rpc().build(this.project);
            if(buildErrors) this.processBuildErrors(buildErrors)
            else rpc().run(this.project);
            this.runButton.innerHTML = icon;
            this.runButton.removeAttribute("loading");
        }, 200);
    }

    private async renderTopRightActions() {
        const container = document.createElement("div");

        if (this.packagesView) {
            const deleteAllPackagesButton = document.createElement("button");
            deleteAllPackagesButton.id = DELETE_ALL_PACKAGES_ID;
            deleteAllPackagesButton.classList.add("danger", "text");
            deleteAllPackagesButton.innerText = "Delete All";
            deleteAllPackagesButton.addEventListener("click", async () => {
                await rpc().fs.rmdir(this.project.location, { absolutePath: true });
                this.backAction();
            });
            container.append(deleteAllPackagesButton);
        } else {
            const shareButton = document.createElement("button");
            shareButton.classList.add("text");
            shareButton.innerHTML = await (
                await fetch("/assets/icons/share.svg")
            ).text();
            shareButton.addEventListener("click", async () => {
                const zipData = await api.projects.export(this.project);
                const refreshedFileTree = await this.fileTree.instance.render();
                this.fileTree.element?.replaceWith(refreshedFileTree);
                this.fileTree.element = refreshedFileTree;
                if(await rpc().platform() === "node"){
                    const blob = new Blob([zipData]);
                    const url = window.URL.createObjectURL(blob);
        
                    const element = document.createElement("a");
                    element.setAttribute("href", url);
                    element.setAttribute(
                        "download",
                        this.project.title + ".zip"
                    );
                    element.style.display = "none";
        
                    document.body.appendChild(element);
        
                    element.click();
                    document.body.removeChild(element);
                    window.URL.revokeObjectURL(url);
                }else {
                    rpc().open(this.project)
                }
            });
            container.append(shareButton);

            this.runButton = document.createElement("button");
            this.runButton.id = RUN_PROJECT_ID;
            this.runButton.classList.add("text");
            this.runButton.innerHTML = await (
                await fetch("/assets/icons/run.svg")
            ).text();
            this.runButton.addEventListener(
                "click",
                this.runProject.bind(this)
            );
            container.append(this.runButton);
        }

        return container;
    }

    private async renderToolbar() {
        const container = document.createElement("div");
        container.classList.add("top-bar");

        const leftSide = document.createElement("div");

        const backButton = document.createElement("button");
        backButton.innerHTML = await (
            await fetch("/assets/icons/chevron.svg")
        ).text();
        backButton.classList.add("text");
        backButton.addEventListener("click", this.backAction);
        leftSide.append(backButton);

        const fileTreeToggle = document.createElement("button");
        fileTreeToggle.innerHTML = await (
            await fetch("/assets/icons/side-panel.svg")
        ).text();
        fileTreeToggle.classList.add("text");
        fileTreeToggle.addEventListener("click", () => {
            this.container.classList.toggle("side-panel-closed");
            setTimeout(() => {
                this.console.fitAddon.fit();
            }, 350);
        });
        leftSide.append(fileTreeToggle);

        const projectTitle = document.createElement("h3");
        projectTitle.id = PROJECT_TITLE_ID;
        projectTitle.innerText = this.project.title;
        leftSide.append(projectTitle);

        leftSide.append(await this.gitWidget.renderButton(true));

        container.append(leftSide);

        const rightSide = await this.renderTopRightActions();
        container.append(rightSide);

        return container;
    }

    renderEditors() {
        Array.from(this.editorsContainer.children).forEach((child) =>
            child.remove()
        );

        const tabsContainer = document.createElement("ul");
        tabsContainer.classList.add("tabs-container");

        this.editors.forEach(async (editor, index) => {
            const tab = document.createElement("li");
            if (editor.hasBuildErrors()) {
                tab.classList.add("has-errors");
            }
            tab.innerText = editor.filePath.at(-1) || "file";
            tab.addEventListener("click", () => {
                this.currentFile = editor.filePath.join("/");
                this.renderEditors();
            });

            const removeBtn = document.createElement("button");
            removeBtn.classList.add("text", "small");
            removeBtn.innerHTML = await (
                await fetch("/assets/icons/close.svg")
            ).text();
            removeBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                await editor.updateFile();
                this.editors.splice(index, 1);
                this.renderEditors();
            });
            tab.append(removeBtn);

            tabsContainer.append(tab);

            if (editor.filePath.join("/") === this.currentFile) {
                tab.classList.add("active");
                this.editorsContainer.append(await editor.render());
            }
        });

        this.tabsContainer.replaceWith(tabsContainer);
        this.tabsContainer = tabsContainer;
    }

    async renderConsole() {
        const consoleContainer = document.createElement("div");
        consoleContainer.classList.add("console");
        consoleContainer.append(this.console.render());

        const toggleConsoleButton = document.createElement("button");
        toggleConsoleButton.classList.add("text");
        toggleConsoleButton.innerHTML = await (
            await fetch("assets/icons/caret-down.svg")
        ).text();
        toggleConsoleButton.addEventListener("click", () => {
            this.container.classList.toggle("console-opened");
            setTimeout(() => {
                this.console.fitAddon.fit();
            }, 350);
        });
        consoleContainer.append(toggleConsoleButton);
        return consoleContainer;
    }

    async render() {
        this.container = document.createElement("div");
        this.gitWidget.parentContainer = this.container;
        this.container.classList.add("project");

        this.container.append(await this.renderToolbar());

        const fileTreeContainer = document.createElement("div");
        fileTreeContainer.classList.add("left-sidebar");
        this.fileTree.instance.allowDeletion = true;
        this.fileTree.instance.noNewItems = this.packagesView;
        this.fileTree.element = await this.fileTree.instance.render();
        fileTreeContainer.append(this.fileTree.element);
        this.container.append(fileTreeContainer);

        this.tabsContainer.classList.add("tabs-container");
        this.container.append(this.tabsContainer);

        this.editorsContainer.classList.add("editor-container");
        this.container.append(this.editorsContainer);

        this.container.append(await this.renderConsole());

        return this.container;
    }
}


function isPlainObject(input: any) {
    return input && !Array.isArray(input) && typeof input === 'object';
 }
 
 function uncapitalizeKeys<T>(obj: T) {
   const final = {};
   for (const [key, value] of Object.entries(obj)) {
     final[key.at(0).toLowerCase() + key.slice(1)] = isPlainObject(value) ? uncapitalizeKeys(value) : value;
   }
   return final as T;
 }