import {
    Button,
    Icon,
    Loader,
    Badge,
    Popover,
    ButtonGroup,
    InputText
} from "@fullstacked/ui";
import { projectChanges, toggleCommitAndBranchView } from ".";
import { refreshGitWidgetBranchAndCommit } from "..";
import { createElement } from "../../../components/element";
import { createRefresheable } from "../../../components/refresheable";
import git from "../../../lib/git";
import { Project } from "../../../types";

let refreshBranches: ReturnType<typeof createRefresheable>["refresh"];

export function Branches(project: Project, closeButton: HTMLButtonElement) {
    const container = createElement("div");
    container.classList.add("git-branches");

    const top = document.createElement("div");

    const backButton = Button({
        style: "icon-large",
        iconLeft: "Arrow"
    });
    backButton.onclick = toggleCommitAndBranchView;

    const title = document.createElement("h3");
    title.innerText = "Branches";

    const createButton = Button({
        style: "icon-large",
        iconLeft: "Plus"
    });

    top.append(backButton, title, createButton);

    let showCreateBranchForm = false;

    createButton.onclick = () => {
        showCreateBranchForm = true;
        createBranchRefresheable.refresh();
    };

    const renderBranchForm = () => {
        if (showCreateBranchForm) {
            createButton.style.display = "none";
            return CreateBranchForm(project, () => {
                showCreateBranchForm = false;
                createBranchRefresheable.refresh();
            });
        } else {
            createButton.style.display = null;
            return createElement("div");
        }
    };

    const createBranchRefresheable = createRefresheable(renderBranchForm);
    createBranchRefresheable.refresh();

    const renderBranchesList = () => BranchesList(project);
    const branchesListRefresheable = createRefresheable(renderBranchesList);
    refreshBranches = branchesListRefresheable.refresh;
    refreshBranches();

    container.append(
        top,
        createBranchRefresheable.element,
        branchesListRefresheable.element,
        closeButton
    );

    return container;
}

async function BranchesList(project: Project) {
    const container = createElement("ul");
    container.classList.add("git-branch-list");

    const [branches, head, { hasChanges }] = await Promise.all([
        git.branches(project),
        git.head(project.id),
        projectChanges(project)
    ]);

    const checkoutButtons: HTMLButtonElement[] = [];

    const items = branches
        .sort((a, b) => (a.name < b.name ? -1 : 1))
        .map((branch) => {
            const item = document.createElement("li");

            const branchName = document.createElement("div");
            branchName.innerText = branch.name;
            item.append(branchName);

            const isCurrent = branch.name === head.name;

            if (isCurrent) {
                const icon = Icon("Arrow 2");
                item.prepend(icon);
            } else if (!hasChanges) {
                const checkoutButton = Button({
                    style: "icon-small",
                    iconLeft: "Arrow Corner"
                });

                checkoutButtons.push(checkoutButton);

                checkoutButton.onclick = async () => {
                    checkoutButton.replaceWith(Loader());
                    checkoutButtons.forEach((button) => {
                        button.replaceWith(document.createElement("div"));
                    });

                    await git.checkout(project, branch.name, false);
                    refreshGitWidgetBranchAndCommit();
                    refreshBranches();
                };

                item.prepend(checkoutButton);
            } else {
                item.prepend(createElement("div"));
            }

            if (branch.local && !branch.remote) {
                item.append(
                    Badge({
                        text: "local-only",
                        type: "info"
                    })
                );
            } else if (!branch.local && branch.remote) {
                item.append(
                    Badge({
                        text: "remote-only"
                    })
                );
            }

            if (!isCurrent && branch.local) {
                const deleteButton = Button({
                    text: "Delete",
                    iconLeft: "Trash",
                    color: "red"
                });

                const optionsButton = Button({
                    style: "icon-small",
                    iconLeft: "Options"
                });

                deleteButton.onclick = async () => {
                    await git.branchDelete(project, branch.name);
                    refreshBranches();
                };

                optionsButton.onclick = () => {
                    Popover({
                        anchor: optionsButton,
                        content: ButtonGroup([deleteButton]),
                        align: {
                            x: "right",
                            y: "center"
                        }
                    });
                };

                item.append(optionsButton);
            } else {
                item.append(createElement("div"));
            }

            return item;
        });

    container.append(...items);

    return container;
}

function CreateBranchForm(project: Project, close: () => void) {
    const form = createElement("form");
    form.classList.add("create-branch-form");

    const branchNameInput = InputText({
        label: "Branch name"
    });

    const cancelButton = Button({
        style: "text",
        text: "Cancel"
    });
    cancelButton.type = "button";
    cancelButton.onclick = close;

    const createButton = Button({
        text: "Create"
    });

    const buttons = document.createElement("div");
    buttons.append(cancelButton, createButton);

    form.onsubmit = async (e) => {
        e.preventDefault();

        await git.checkout(project, branchNameInput.input.value, true);
        close();
        refreshGitWidgetBranchAndCommit();
        refreshBranches();
    };

    form.append(branchNameInput.container, buttons);

    setTimeout(() => branchNameInput.input.focus(), 1);

    return form;
}
