import { Button, InputText } from "@fullstacked/ui";
import { NEW_PROJECT_ID } from "../../constants";
import { AddProject } from "../add-project";
import { projectsList } from "./list";
import { Store } from "../../store";

export function SearchAdd() {
    const container = document.createElement("div");
    container.classList.add("search-and-add");

    const search = Search();
    const add = Add();
    container.append(search, add);
    return container;
}

function Search() {
    const form = document.createElement("form");

    const inputSearch = InputText({
        label: "Search",
        clear: true
    });

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

    form.append(inputSearch.container);

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
