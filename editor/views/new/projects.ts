import api from "../../api";
import { Project as ProjectType } from "../../api/config/types";
import { Popover } from "../../components/popover";
import { Button, ButtonGroup } from "../../components/primitives/button";
import { InputText } from "../../components/primitives/inputs";
import { TopBar as TopBarComponent } from "../../components/top-bar";
import { ViewScrollable } from "../../components/view-scrollable";
import { BG_COLOR } from "../../constants";
import stackNavigation from "../../stack-navigation";
import { AddProject } from "./add-project";
import { Peers } from "./peers";
import { Project } from "./project";
import { Settings } from "./settings";

export function Projects() {
    const { container, scrollable } = ViewScrollable();
    container.id = "projects-view";

    container.prepend(TopBar());

    scrollable.append(SearchAndAdd(), ProjectsList());

    return container;
}

function TopBar() {
    const peers = Button({
        style: "icon-large",
        iconLeft: "Peers"
    });

    peers.onclick = () => stackNavigation.navigate(Peers(), BG_COLOR);

    const settings = Button({
        style: "icon-large",
        iconLeft: "Settings"
    });

    settings.onclick = () => {
        stackNavigation.navigate(Settings(), BG_COLOR);
    };

    const topBar = TopBarComponent({
        noBack: true,
        title: "Projects",
        actions: [peers, settings]
    });

    return topBar;
}

function SearchAndAdd() {
    const container = document.createElement("div");
    container.classList.add("search-and-add");

    const inputText = InputText({
        label: "Search"
    });

    const addButton = Button({
        style: "icon-large",
        iconLeft: "Plus"
    });

    addButton.onclick = () => {
        stackNavigation.navigate(AddProject(), BG_COLOR);
    };

    container.append(inputText.container, addButton);

    return container;
}

function ProjectsList() {
    const container = document.createElement("div");
    container.classList.add("projects-list");

    api.projects.list().then((projects) => {
        projects.forEach((project) => {
            container.append(ProjectTile(project));
        });
    });

    return container;
}

function ProjectTile(project: ProjectType) {
    const container = document.createElement("div");
    container.classList.add("project-tile");

    container.onclick = () =>
        stackNavigation.navigate(Project(project), BG_COLOR);

    const titleAndId = document.createElement("div");
    titleAndId.classList.add("title-id");
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
        content.classList.add("options-popover");

        const buttonsGroup = ButtonGroup([
            Button({
                text: "Delete",
                iconLeft: "Trash",
                color: "red"
            }),
            Button({
                text: "Share",
                iconLeft: "Export"
            })
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
