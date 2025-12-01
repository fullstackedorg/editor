import { ViewScrollable } from "../../components/view-scrollable";
import {
    BG_COLOR,
    PROJECTS_TITLE,
    PROJECTS_VIEW_ID,
    SETTINGS_BUTTON_ID
} from "../../constants";
import stackNavigation from "../../stack-navigation";
import { List } from "./list";
import { SearchAdd } from "./search-add";
import { TopBar as TopBarComponent } from "../../components/top-bar";
import { Settings } from "../settings";
import { Button } from "@fullstacked/ui";
import { projectsViewClass } from "./index.s";

export function Projects() {
    const { container, scrollable } = ViewScrollable();
    container.id = PROJECTS_VIEW_ID;
    container.classList.add(projectsViewClass);

    const topBar = TopBar();
    container.prepend(topBar);

    const list = List();

    scrollable.append(SearchAdd(), list);

    stackNavigation.navigate(container, {
        bgColor: BG_COLOR,
        onDestroy: () => {
            topBar.destroy();
            list.destroy();
        }
    });
}

function TopBar() {
    const settings = Button({
        style: "icon-large",
        iconLeft: "Settings"
    });
    settings.id = SETTINGS_BUTTON_ID;
    settings.onclick = Settings;

    const topBar = TopBarComponent({
        noBack: true,
        title: PROJECTS_TITLE,
        actions: [settings]
    });

    return topBar;
}
