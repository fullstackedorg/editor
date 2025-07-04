import { createSequential, createSubscribable, Store } from ".";
import { CONFIG_TYPE, Project } from "../types";
import fs from "../../lib/fs";
import config from "../lib/config";
import { SnackBar } from "../../lib/components/snackbar";
import core_open from "../lib/core_open";
import { buildSASS } from "../lib/esbuild/sass";
import esbuild from "../lib/esbuild";
import git from "../lib/git";
import packages from "../lib/packages";
import { updatePackagesView } from "../views/packages";
import stackNavigation from "../stack-navigation";

const list = createSubscribable(listP, []);

const activeProjectBuilds = new Set<string>();
const builds = createSubscribable(() => activeProjectBuilds);

const activeProjectPulls = new Set<string>();
const pulls = createSubscribable(() => activeProjectPulls);

let currentOpenedProject: Project = null;
const current = createSubscribable(() => currentOpenedProject);

export const projects = {
    list: list.subscription,
    create: createSequential(create),
    update,
    deleteP,

    setCurrent,
    current: current.subscription,

    build,
    builds: builds.subscription,

    pull,
    pulls: pulls.subscription
};

function setCurrent(project: Project) {
    if (currentOpenedProject) {
        stackNavigation.back();
    }
    currentOpenedProject = project;
    current.notify();
}

async function listP() {
    const { projects } = await config.get(CONFIG_TYPE.PROJECTS);
    return projects || [];
}

async function create(project: Omit<Project, "createdDate">) {
    const newProject: Project = {
        ...project,
        createdDate: Date.now()
    };
    const projects = await listP();
    projects.push(newProject);
    await config.save(CONFIG_TYPE.PROJECTS, { projects });
    list.notify();

    return newProject;
}

async function update(project: Project, updatedProject: Project) {
    const projects = await listP();
    const indexOf = projects.findIndex(({ id }) => id === project.id);
    if (indexOf === -1) return;

    if (project.id != updatedProject.id) {
        await fs.rename(project.id, updatedProject.id);
    }

    projects[indexOf] = updatedProject;
    await config.save(CONFIG_TYPE.PROJECTS, { projects });
    list.notify();
}

async function deleteP(project: Project) {
    const projects = await listP();
    const indexOf = projects.findIndex(({ id }) => id === project.id);
    if (indexOf === -1) return;
    projects.splice(indexOf, 1);
    await config.save(CONFIG_TYPE.PROJECTS, { projects });
    list.notify();

    fs.rmdir(project.id);
}

async function build(project: Project) {
    Store.editor.codeEditor.clearAllBuildErrors();

    activeProjectBuilds.add(project.id);
    builds.notify();

    const removeProjectBuild = () => {
        activeProjectBuilds.delete(project.id);
        builds.notify();
    };

    const isUserMode = Store.preferences.isUserMode.check();
    if (!isUserMode || (await esbuild.shouldBuild(project))) {
        await packages.install(project, null, updatePackagesView, true);
        const buildErrorsSASS = await buildSASS(project, fs);
        const buildErrorsEsbuild = await esbuild.build(project);
        const buildErrors = [buildErrorsSASS, ...(buildErrorsEsbuild || [])]
            .flat()
            .filter(Boolean);
        const errors = buildErrors.map((error) => {
            return {
                file: error.location?.file,
                line: error.location?.line,
                col: error.location?.column,
                length: error.location?.length,
                message: error.text
            };
        });

        if (errors.length) {
            if (isUserMode) {
                SnackBar({
                    message: `Encountered errors while building <b>${project.title}</b>.`,
                    autoDismissTimeout: 4000
                });
            } else {
                Store.editor.codeEditor.addBuildErrors(errors);
            }
        }
    }

    core_open(project.id);
    removeProjectBuild();
}

async function pull(project: Project) {
    if (!project.gitRepository?.url) {
        return;
    }

    activeProjectPulls.add(project.id);
    pulls.notify();
    try {
        await git.pull(project);
    } catch (e) {
        SnackBar({
            message: `Failed to update <b>${project.title}</b>.`,
            autoDismissTimeout: 4000
        });
    }
    activeProjectPulls.delete(project.id);
    pulls.notify();
}
