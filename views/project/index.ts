import type { Project as ProjectType } from "../../types";
import { BG_COLOR, PROJECT_VIEW_ID, RUN_PROJECT_ID } from "../../constants";
import stackNavigation from "../../stack-navigation";
import { TopBar as TopBarComponent } from "../../components/top-bar";
import { Store } from "../../store";
import { createElement } from "../../components/element";
import { Git } from "./git";
import { createRefresheable } from "../../components/refresheable";
import git from "../../../fullstacked_modules/git";
import core_message from "../../../fullstacked_modules/core_message";
import { Button, Icon, Loader } from "@fullstacked/ui";
import { FileTree } from "./file-tree";
import { openPrompt } from "../prompt";
import { createWorkspace } from "./workspace";
import { Workspace } from "./workspace";
import { viewClass } from "../../style/index.s";
import {
    fileAndEditorClosedClass,
    fileTreeAndEditorClass,
    gitStatusArrowClass,
    gitStatusArrowRedClass,
    gitWidgetClass,
    leftPanelClass,
    projectClass
} from "./index.s";

export function Project(project: ProjectType) {
    if (!project) return;

    const container = createElement("div");
    container.id = PROJECT_VIEW_ID;
    container.classList.add(viewClass, projectClass);

    const { fileTreeAndEditor, workspace } = FileTreeAndEditor(project);
    const topBar = TopBar(project, fileTreeAndEditor, workspace);

    container.append(topBar, fileTreeAndEditor);

    stackNavigation.navigate(container, {
        bgColor: BG_COLOR,
        onDestroy: () => {
            topBar.destroy();
            fileTreeAndEditor.destroy();
            container.destroy();
        }
    });

    return container;
}

function TopBar(
    project: ProjectType,
    fileTreeAndEditor: HTMLElement,
    workspace: Workspace
) {
    const gitWidget = GitWidget(project);

    const runButton = RunButton(project, workspace);

    const topBar = TopBarComponent({
        title: project.title,
        subtitle: project.id,
        actions: [gitWidget, runButton],
        onBack: () => {
            if (
                fileTreeAndEditor.classList.contains(fileAndEditorClosedClass)
            ) {
                Store.editor.setSidePanelClosed(false);
            } else {
                Store.projects.setCurrent(null);
            }

            return false;
        }
    });

    topBar.ondestroy = () => {
        gitWidget?.destroy();
        runButton?.destroy();
    };

    return topBar;
}

function FileTreeAndEditor(project: ProjectType) {
    const container = createElement("div");
    container.classList.add(fileTreeAndEditorClass);

    const toggleSidePanel = (closed: boolean) => {
        if (closed) {
            container.classList.add(fileAndEditorClosedClass);
        } else {
            container.classList.remove(fileAndEditorClosedClass);
        }
    };

    Store.editor.sidePanelClosed.subscribe(toggleSidePanel);
    container.ondestroy = () =>
        Store.editor.sidePanelClosed.unsubscribe(toggleSidePanel);

    const workspace = createWorkspace(project);
    Store.projects.current.check().workspace = workspace;
    const fileTree = FileTree(project, workspace);

    const leftPanel = document.createElement("div");
    leftPanel.classList.add(leftPanelClass);

    const buttonContainer = document.createElement("div");

    const promptButton = Button({
        style: "text",
        iconLeft: "Terminal"
    });
    promptButton.onclick = () => {
        openPrompt();
    };
    buttonContainer.append(promptButton);

    leftPanel.append(fileTree, buttonContainer);

    container.append(leftPanel, workspace.element);

    container.ondestroy = () => {
        fileTree.destroy();
        workspace.destroy();
    };

    return {
        fileTreeAndEditor: container,
        workspace
    };
}

function RunButton(project: ProjectType, workspace: Workspace) {
    const container = createElement("div");
    const clearContainer = () => {
        Array.from(container.children).find((c) => c.remove());
    };

    const button = Button({
        style: "icon-large",
        iconLeft: "Play"
    });
    button.id = RUN_PROJECT_ID;
    const showButton = () => {
        if (Array.from(container.children).find((c) => c === button)) {
            return;
        }
        clearContainer();
        container.append(button);
    };

    const loaderContainer = document.createElement("div");
    loaderContainer.classList.add("loader-container");
    loaderContainer.append(Loader());
    const showLoader = () => {
        if (Array.from(container.children).find((c) => c === loaderContainer)) {
            return;
        }
        clearContainer();
        container.append(loaderContainer);
    };

    const onBuild = (projectsBuild: Set<string>) => {
        if (projectsBuild.has(project.id)) {
            showLoader();
        } else {
            showButton();
        }
    };
    Store.projects.builds.subscribe(onBuild);

    button.onclick = async () => {
        showLoader();
        await workspace.save();
        Store.projects.build(project);
    };

    showButton();

    container.ondestroy = () => {
        Store.projects.builds.unsubscribe(onBuild);
    };

    return container;
}

let refreshBranchAndCommit: ReturnType<typeof createRefresheable>["refresh"];
export const refreshGitWidgetBranchAndCommit = () => {
    refreshBranchAndCommit?.();
};
function GitWidget(project: ProjectType) {
    const container = createElement("div");
    container.classList.add(gitWidgetClass);

    const hasGit = Boolean(project.gitRepository?.url);
    const gitButton = Button({
        style: "icon-large",
        iconLeft: "Git"
    });
    gitButton.disabled = !hasGit;
    gitButton.onclick = () => Git(project);
    container.append(gitButton);

    if (!hasGit) return container;

    const branchAndCommitRender = async () => {
        const result = await git.head(project.id);
        const branchAndCommitContainer = createElement("div");
        branchAndCommitContainer.innerHTML = `
                <div><b>${result.name}</b></div>
                <div>${result.hash?.slice(0, 7) || "-"}<div>
            `;
        return branchAndCommitContainer;
    };

    const branchAndCommit = createRefresheable(branchAndCommitRender);
    container.prepend(branchAndCommit.element);
    refreshBranchAndCommit = branchAndCommit.refresh;
    refreshBranchAndCommit();

    const statusArrow = Icon("Arrow 2");
    statusArrow.classList.add(gitStatusArrowClass);
    statusArrow.style.display = "none";
    container.append(statusArrow);

    const pullEvent = (gitProgress: string) => {
        statusArrow.style.display = "flex";
        statusArrow.classList.remove(gitStatusArrowRedClass);

        let json: { finished: boolean };
        try {
            json = JSON.parse(gitProgress);
        } catch (e) {
            return;
        }

        if (json.finished) {
            statusArrow.style.display = "none";
            branchAndCommit.refresh();
        }
    };

    const pushEvent = (gitProgress: string) => {
        statusArrow.style.display = "flex";
        statusArrow.classList.add(gitStatusArrowRedClass);

        let json: { finished: boolean };
        try {
            json = JSON.parse(gitProgress);
        } catch (e) {
            return;
        }

        if (json.finished) {
            statusArrow.style.display = "none";
            branchAndCommit.refresh();
        }
    };

    core_message.addListener("git-pull", pullEvent);
    core_message.addListener("git-push", pushEvent);

    container.ondestroy = () => {
        core_message.removeListener("git-pull", pullEvent);
        core_message.removeListener("git-push", pushEvent);
    };

    git.pull(project);

    return container;
}
