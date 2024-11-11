import { Button } from "../../components/primitives/button";
import { InputText } from "../../components/primitives/inputs";
import { Store } from "../../store";
import { AddProject } from "../add-project";

export function SearchAdd() {
    const container = document.createElement("div");
    container.classList.add("search-and-add");

    const search = Search();
    const add = Add();
    container.append(search, add);
    return container;
}

function Search() {
    const inputSearch = InputText({
        label: "Search"
    });

    inputSearch.input.onkeyup = () => {
        Store.projects.filter.set(inputSearch.input.value);
    };

    return inputSearch.container;
}

function Add() {
    const addButton = Button({
        style: "icon-large",
        iconLeft: "Plus"
    });

    addButton.onclick = AddProject;

    return addButton;
}