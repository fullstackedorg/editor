import { Button, InputSelect, InputText } from "@fullstacked/ui";
import { NEW_PROJECT_ID } from "../../constants";
import { AddProject } from "../add-project";
import { projectsList } from "./list";
import { Store } from "../../store";
import {
    buttonContainer,
    hideClass,
    redBadgeClass,
    searchAndAddClass,
    searchFormClass
} from "./search-add.s";
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

function allProjectsInSingleList() {
    const projectsLists = Store.projects.projectsLists.list.check();
    if (projectsLists.length !== 1) {
        return false;
    }
    const projects = Store.projects.list.check();
    return projects.every(
        (p) => p.lists?.length === 1 && p.lists.at(0) === projectsLists.at(0).id
    );
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
    inputProjectsLists.select.onchange = (listId) => {
        if (listId === "all") {
            listSelectedIcon.classList.add(hideClass);
        } else {
            listSelectedIcon.classList.remove(hideClass);
        }
        projectsList.filter(inputSearch.input.value, listId);
    };

    const buttonProjectsListsContainer = document.createElement("div");
    buttonProjectsListsContainer.classList.add(buttonContainer);

    const listSelectedIcon = document.createElement("div");
    listSelectedIcon.classList.add(redBadgeClass, hideClass);

    const buttonProjectsLists = Button({
        iconRight: "Filter",
        style: "icon-large"
    });
    buttonProjectsLists.type = "button";
    buttonProjectsLists.onclick = inputProjectsLists.select.open;

    buttonProjectsListsContainer.append(listSelectedIcon, buttonProjectsLists);

    const onProjectsListsChange = () => {
        const projectsLists = Store.projects.projectsLists.list.check();
        if (
            !projectsLists ||
            projectsLists.length === 0 ||
            allProjectsInSingleList()
        ) {
            inputProjectsLists.container.classList.add(hideClass);
            buttonProjectsListsContainer.classList.add(hideClass);
        } else {
            inputProjectsLists.container.classList.remove(hideClass);
            buttonProjectsListsContainer.classList.remove(hideClass);
        }
        inputProjectsLists.options.set(
            { name: "All", id: "all" },
            ...projectsLists
        );
    };
    Store.projects.projectsLists.list.subscribe(onProjectsListsChange);
    Store.projects.list.subscribe(onProjectsListsChange);

    inputSearch.input.onkeyup = () => {
        projectsList.filter(
            inputSearch.input.value,
            inputProjectsLists.select.value
        );
    };

    form.onsubmit = (e) => {
        e.preventDefault();
        const firstProjectDisplayed = projectsList.displayed?.at(0);
        if (firstProjectDisplayed) {
            Store.projects.setCurrent(firstProjectDisplayed);
        }
    };

    form.append(
        inputSearch.container,
        buttonProjectsListsContainer,
        inputProjectsLists.container
    );

    form.ondestroy = () => {
        Store.projects.projectsLists.list.unsubscribe(onProjectsListsChange);
        Store.projects.list.subscribe(onProjectsListsChange);
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
