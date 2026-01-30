import { ProjectsList } from "../../types";
import { createElement } from "../../components/element";
import { Badge, Button, ButtonGroup, Popover } from "@fullstacked/ui";
import { Store } from "../../store";
import { projectsListsSettingsClass } from "./projects-lists.s";
import { testProjectsListUrl } from "../add-project/projects-list";

export function ProjectsListItem(projectsList: ProjectsList) {
    const item = document.createElement("li");

    item.innerHTML = `<div>
        <div>${projectsList.name}</div>
        <div>${projectsList.url}</div>
    </div>`;

    const rightEnd = document.createElement("div");

    const optsBtn = Button({
        iconRight: "Options",
        style: "icon-small"
    });

    optsBtn.onclick = () => {
        const deleteBtn = Button({
            text: "Delete",
            iconLeft: "Trash",
            color: "red"
        });

        deleteBtn.onclick = () => {
            Store.projects.projectsLists.remove(projectsList);
        };

        const buttonGroup = ButtonGroup([deleteBtn]);

        Popover({
            anchor: optsBtn,
            content: buttonGroup,
            align: {
                x: "right",
                y: "top"
            }
        });
    };

    let statusBadge = Badge({
        text: "Checking"
    });

    item.append(rightEnd);

    rightEnd.append(statusBadge, optsBtn);

    testProjectsListUrl(projectsList.url).then((status) => {
        const testResultBadge = status.error
            ? Badge({
                  text: "Error",
                  type: "error"
              })
            : Badge({
                  text: "Valid",
                  type: "success"
              });
        statusBadge.replaceWith(testResultBadge);
        statusBadge = testResultBadge;
    });

    return item;
}

export function ProjectsLists() {
    const container = createElement("div");
    container.classList.add(projectsListsSettingsClass);
    container.innerHTML = `<h2>Projects Lists</h2>`;

    let inner: HTMLElement = document.createElement("ul");
    const renderProjectsListsList = (list: ProjectsList[]) => {
        const updatedInner =
            list.length === 0
                ? document.createElement("p")
                : document.createElement("ul");
        if (list.length === 0) {
            updatedInner.innerText = "No projects list added.";
        } else {
            const projectsListsElements = list.map(ProjectsListItem);
            updatedInner.append(...projectsListsElements);
        }

        inner.replaceWith(updatedInner);
        inner = updatedInner;
    };
    container.append(inner);

    Store.projects.projectsLists.list.subscribe(renderProjectsListsList);

    container.ondestroy = () => {
        Store.projects.projectsLists.list.unsubscribe(renderProjectsListsList);
    };

    return container;
}
