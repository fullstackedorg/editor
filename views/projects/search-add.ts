import { Button, InputSelect, InputText } from "@fullstacked/ui";
import { NEW_PROJECT_ID } from "../../constants";
import { AddProject } from "../add-project";
import { projectsList } from "./list";
import { Store } from "../../store";
import { hideClass, searchAndAddClass, searchFormClass } from "./search-add.s";
import { createElement } from "../../components/element";
import { ProjectsList } from "../../types";

export function SearchAdd() {
    const container = createElement("div");
    container.classList.add(searchAndAddClass);

    const search = Search();
    const add = Add();
    container.append(search, add);

    container.ondestroy = () => {
        search.destroy();
    };

    return container;
}

function Search() {
    const form = createElement("form");
    form.classList.add(searchFormClass);

    const inputSearch = InputText({
        label: "Search",
        clear: true
    });

    const inputProjectsLists = InputSelect({
        label: "Projects lists",
        placeholder: "Select projects list"
    });
    inputProjectsLists.options.add({ name: "All", id: "all" });
    inputProjectsLists.select.value = "all";

    const onProjectsListsChange = (projectsLists: ProjectsList[]) => {
        if (!projectsLists || projectsLists.length === 0) {
            inputProjectsLists.container.classList.add(hideClass);
        } else {
            inputProjectsLists.container.classList.remove(hideClass);
        }
        inputProjectsLists.options.set(
            { name: "All", id: "all" },
            ...projectsLists
        );
    };
    Store.projects.projectsLists.list.subscribe(onProjectsListsChange);

    inputSearch.input.onkeyup = () => {
        projectsList.filter(inputSearch.input.value);
    };

    form.onsubmit = (e) => {
        e.preventDefault();
        const firstProjectDisplayed = projectsList.displayed?.at(0);
        if (firstProjectDisplayed) {
            Store.projects.setCurrent(firstProjectDisplayed);
        }
    };

    form.append(inputSearch.container, inputProjectsLists.container);

    form.ondestroy = () => {
        Store.projects.projectsLists.list.unsubscribe(onProjectsListsChange);
    };

    return form;
}

function Add() {
    const addButton = Button({
        style: "icon-large",
        iconLeft: "Plus"
    });
    addButton.id = NEW_PROJECT_ID;

    addButton.onclick = AddProject;

    return addButton;
}
