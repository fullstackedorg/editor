import { Button } from "@fullstacked/ui";
import { TopBar } from "../../components/top-bar";
import { BG_COLOR, IMPORT_ZIP_ID } from "../../constants";
import stackNavigation from "../../stack-navigation";
import { Store } from "../../store";
import { CloneGit } from "./clone-git";
import { CreateEmpty } from "./create-empty";
import { ImportZip } from "./import-zip";
import { viewClass } from "../../style/index.s";
import { addProjectButtonsClass, addProjectClass } from "./index.s";
import { ProjectsList } from "./projects-list";

export function AddProject() {
    const container = document.createElement("div");
    container.id = "add-project";
    container.classList.add(viewClass, addProjectClass);

    const topBar = TopBar({
        title: "Add Project"
    });

    container.append(topBar);

    const buttonsContainer = document.createElement("div");
    buttonsContainer.classList.add(addProjectButtonsClass);

    const cloneGitButton = Button({
        text: "Clone git repository",
        iconLeft: "Git"
    });
    cloneGitButton.onclick = () => CloneGit();

    const importZipButton = Button({
        text: "Import zip",
        iconLeft: "Archive"
    });
    importZipButton.id = IMPORT_ZIP_ID;
    importZipButton.onclick = ImportZip;

    const createEmptyButton = Button({
        text: "Create empty project",
        iconLeft: "Glitter"
    });
    createEmptyButton.onclick = CreateEmpty;

    const projectsListButton = Button({
        text: "Projects list",
        iconLeft: "Items"
    });
    projectsListButton.onclick = ProjectsList;

    buttonsContainer.append(
        cloneGitButton,
        importZipButton,
        createEmptyButton,
        projectsListButton
    );
    container.append(buttonsContainer);

    // on project list update (most probably new project created)
    // go back
    const goBackOnNewProject = () => stackNavigation.back();
    Store.projects.list.subscribe(goBackOnNewProject);
    Store.projects.projectsLists.list.subscribe(goBackOnNewProject);

    stackNavigation.navigate(container, {
        bgColor: BG_COLOR,
        onDestroy: () => {
            Store.projects.list.unsubscribe(goBackOnNewProject);
            Store.projects.projectsLists.list.unsubscribe(goBackOnNewProject);
        }
    });
}
