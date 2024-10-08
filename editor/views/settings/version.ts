import rpc from "../../rpc";
import { Editor } from "../editor";
import semver from "semver";

export default async function () {
    const container = document.createElement("div");

    const title = document.createElement("h2");
    title.innerText = "Version";
    container.append(title);

    const versionEditor = document.createElement("div");
    versionEditor.classList.add("setting-row");

    versionEditor.innerHTML = `<label>Editor</label>`;

    const currentVersion: {
        version: string;
        branch: string;
        commit: string;
    } = JSON.parse(
        (await rpc().fs.readFile("version.json", {
            encoding: "utf8"
        })) as string
    );

    const versionEditorContainer = document.createElement("div");
    versionEditorContainer.classList.add("version-editor");

    const versionWithBadge = document.createElement("div");
    versionWithBadge.innerHTML = `<div class="version">${currentVersion.version}</div>`;

    versionEditorContainer.append(versionWithBadge);

    versionEditor.append(versionEditorContainer);
    container.append(versionEditor);

    getLatestVersionTag().then((latestVersion) => {
        const badge = document.createElement("div");
        badge.classList.add("badge");
        versionWithBadge.prepend(badge);

        if (semver.gt(currentVersion.version, latestVersion)) {
            badge.classList.add("accent");
            badge.innerText = "Development";

            const branchAndCommit = document.createElement("div");
            branchAndCommit.innerHTML = `<div class="ref">${currentVersion.commit.slice(0, 8)} (${currentVersion.branch})</div>`;
            versionEditorContainer.append(branchAndCommit);
        } else if (semver.eq(currentVersion.version, latestVersion)) {
            badge.innerText = "Latest";
        } else if (semver.lt(currentVersion.version, latestVersion)) {
            badge.classList.add("warning");
            badge.innerText = "Update Available";
        }
    });

    const versionEsbuild = document.createElement("div");
    versionEsbuild.classList.add("setting-row");

    versionEsbuild.innerHTML = `<label>Esbuild</label>
        <div>${await rpc().esbuild.version()}</div>`;

    container.append(versionEsbuild);

    const versionTypeScript = document.createElement("div");
    versionTypeScript.classList.add("setting-row");

    const appendTypeScriptVersion = async () => {
        versionTypeScript.innerHTML = `<label>TypeScript</label>
            <div>${await Editor.tsWorker.call().version()}</div>`;

        container.append(versionTypeScript);
    };

    if (!Editor.tsWorker)
        Editor.restartTSWorker().then(appendTypeScriptVersion);
    else appendTypeScriptVersion();

    return container;
}

async function getLatestVersionTag() {
    const response = await rpc().fetch(
        "https://api.github.com/repos/fullstackedorg/editor/releases/latest",
        {
            encoding: "utf8"
        }
    );
    return JSON.parse(response.body as string).tag_name;
}
