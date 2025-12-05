import Fuse, { IFuseOptions } from "fuse.js";
import { createElement } from "../../components/element";
import { createRefresheable } from "../../components/refresheable";
import { Store } from "../../store";
import { Project as ProjectType } from "../../types";
import { Project } from "../project";
import { ProjectSettings } from "../project-settings";
import { Loader, Button, ButtonGroup, Popover, Dialog } from "@fullstacked/ui";
import archive from "../../../fullstacked_modules/archive";
import {
    projectTitleIdClass,
    projectLoadingClass,
    projectOptionsPopoverClass,
    projectTileClass,
    projectsListClass
} from "./list.s";

export function List() {
    const container = createElement("div");

    const grid = createRefresheable(Grid);
    Store.projects.list.subscribe(grid.refresh);
    container.ondestroy = () => {
        grid.element.destroy();
        Store.projects.list.unsubscribe(grid.refresh);
    };
    container.append(grid.element);

    return container;
}

const fuseOptions: IFuseOptions<ProjectType> = {
    keys: [
        {
            name: "title",
            weight: 0.8
        },
        {
            name: "id",
            weight: 0.3
        }
    ]
};

export let projectsList: {
    filter(searchStr?: string, listId?: string): void;
    displayed: ProjectType[];
} = {
    filter: () => {},
    displayed: []
};
function Grid(projects: ProjectType[]) {
    const container = createElement("div");

    const fuse = new Fuse(projects, fuseOptions);

    const filteredGrid = createRefresheable(GridFiltered);

    projectsList.filter = (searchString = "", listId = undefined) => {
        if (!searchString) {
            projectsList.displayed = [...projects].sort(
                (a, b) => b.createdDate - a.createdDate
            );
        } else {
            const fuseResults = fuse.search(searchString);
            projectsList.displayed = fuseResults.map(({ item }) => item);
        }

        if (listId && listId !== "all") {
            projectsList.displayed = projectsList.displayed.filter(
                ({ lists }) => lists?.includes(listId)
            );
        }

        filteredGrid.refresh(projectsList.displayed);
    };
    projectsList.filter();

    container.append(filteredGrid.element);

    container.ondestroy = () => {
        filteredGrid.element.destroy();
    };

    return container;
}

function GridFiltered(projects: ProjectType[]) {
    const container = createElement("div");
    container.classList.add(projectsListClass);

    const projectsTiles = projects.map(ProjectTile);

    container.append(...projectsTiles);

    container.ondestroy = () => {
        projectsTiles.forEach((p) => p.destroy());
    };

    return container;
}

function ProjectTile(project: ProjectType) {
    const container = createElement("div");
    container.classList.add(projectTileClass);

    const loader = Loader();

    const onPullAndBuild = (projectIds: Set<string>) => {
        if (projectIds.has(project.id)) {
            container.classList.add(projectLoadingClass);
            container.prepend(loader);
        } else {
            container.classList.remove(projectLoadingClass);
            loader.remove();
        }
    };

    Store.projects.builds.subscribe(onPullAndBuild);
    Store.projects.pulls.subscribe(onPullAndBuild);

    container.ondestroy = () => {
        Store.projects.builds.unsubscribe(onPullAndBuild);
        Store.projects.pulls.unsubscribe(onPullAndBuild);
    };

    container.onclick = () => {
        if (Store.preferences.isUserMode.check()) {
            Store.projects
                .pull(project)
                .then(() => Store.projects.build(project));
        } else {
            Store.projects.setCurrent(project);
        }
    };

    const titleAndId = document.createElement("div");
    titleAndId.classList.add(projectTitleIdClass);
    titleAndId.innerHTML = `
        <h2>${project.title}</h2>
        <div><small>${project.id}</small></div>
    `;
    container.append(titleAndId);

    const optionsButton = Button({
        style: "icon-small",
        iconLeft: "Options"
    });

    optionsButton.onclick = (e) => {
        e.stopPropagation();

        const content = document.createElement("div");
        content.classList.add(projectOptionsPopoverClass);

        const deleteButton = Button({
            text: "Delete",
            iconLeft: "Trash",
            color: "red"
        });
        deleteButton.onclick = () => {
            const confirm = createElement("div");
            confirm.classList.add("confirm");

            confirm.innerHTML = `<p>Are you sure you want to delete <b>${project.title}</b>?</p>`;

            const buttonRow = document.createElement("div");

            const keepButton = Button({
                style: "text",
                text: "Keep"
            });
            const deleteButton = Button({
                color: "red",
                text: "Delete"
            });

            buttonRow.append(keepButton, deleteButton);

            confirm.append(buttonRow);

            const { remove } = Dialog(confirm);

            keepButton.onclick = remove;
            deleteButton.onclick = () => {
                remove();
                Store.projects.deleteP(project);
            };
        };

        const shareButton = Button({
            text: "Share",
            iconLeft: "Export"
        });

        shareButton.onclick = async () => {
            const zipData = (await archive.zip(project.id, null, [
                ".build",
                "data",
                "node_modules",
                ".git"
            ])) as Uint8Array<ArrayBuffer>;
            const blob = new Blob([zipData]);
            const a = document.createElement("a");
            document.body.appendChild(a);
            const url = window.URL.createObjectURL(blob);
            a.href = url;
            a.download = project.id + ".zip";
            a.click();
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }, 0);
        };

        const projectSettingsButton = Button({
            text: "Settings",
            iconLeft: "Settings"
        });
        projectSettingsButton.onclick = () => ProjectSettings(project);

        const buttonsGroup = ButtonGroup([
            deleteButton,
            shareButton,
            projectSettingsButton
        ]);

        content.append(buttonsGroup);

        Popover({
            anchor: container,
            content,
            align: {
                y: "bottom",
                x: "right"
            }
        });
    };

    container.append(optionsButton);

    return container;
}
