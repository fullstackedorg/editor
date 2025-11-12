import { bridge } from "../../../fullstacked_modules/bridge";
import { serializeArgs } from "../../../fullstacked_modules/bridge/serialization";
import core_fetch from "../../../fullstacked_modules/fetch";
import semver from "semver";
import * as sass from "sass";
import { Badge } from "@fullstacked/ui";
import build from "../../../fullstacked_modules/build";
import * as lsp from "../../editor_modules/lsp";
import { editorVersionClass, tsVersionClass, versionClass } from "./version.s";

export function Version() {
    const container = document.createElement("div");
    container.classList.add(versionClass);

    container.innerHTML = `<h2>Version</h2>`;

    container.append(
        EditorVersion(),
        EsbuildVersion(),
        TypescriptVersion(),
        SassVersion()
    );

    return container;
}

function EditorVersion() {
    const container = document.createElement("div");

    container.innerHTML = `
        <label>Editor</label>
    `;

    getVersionJSON().then((version) => {
        const versionStr = `${version.major}.${version.minor}.${version.patch}`;

        const editorVersionContainer = document.createElement("div");
        editorVersionContainer.classList.add(editorVersionClass);

        const topRow = document.createElement("div");
        topRow.innerText = versionStr;
        editorVersionContainer.append(topRow);

        container.append(editorVersionContainer);

        getLatestVersionTag().then((latestVersion) => {
            const isDev = semver.gt(versionStr, latestVersion);

            const badge = isDev
                ? Badge({
                      text: "Development",
                      type: "info"
                  })
                : semver.eq(versionStr, latestVersion)
                  ? Badge({
                        text: "Latest",
                        type: "info-2"
                    })
                  : Badge({
                        text: "Update Available",
                        type: "warning"
                    });

            topRow.prepend(badge);

            if (isDev) {
                topRow.append(` (${version.build})`);
                const bottomRow = document.createElement("div");
                bottomRow.innerHTML = `<small>${version.hash.slice(0, 8)} (${version.branch})</small>`;
                editorVersionContainer.append(bottomRow);
            }
        });
    });

    return container;
}

async function getLatestVersionTag() {
    const response = await core_fetch(
        "https://api.github.com/repos/fullstackedorg/fullstacked/releases/latest",
        {
            encoding: "utf8"
        }
    );
    return JSON.parse(response.body as string).tag_name;
}

function EsbuildVersion() {
    const container = document.createElement("div");

    container.innerHTML = `
        <label>Esbuild</label>
    `;

    build.esbuildVersion().then((v) => {
        container.innerHTML += `<div>${v.slice(1)}</div>`;
    });

    return container;
}

function TypescriptVersion() {
    const container = document.createElement("div");
    container.classList.add(tsVersionClass);

    container.innerHTML = `
        <label>TypeScript</label>
    `;

    Promise.all([lsp.version(), getVersionJSON(true)]).then(
        ([v, { branch, hash, build }]) => {
            container.innerHTML += `<div>
        <div>${v} (${build})</div>
        <div><small>${hash.slice(0, 8)} (${branch})</small></div>
    </div>`;
        }
    );

    return container;
}

function SassVersion() {
    const container = document.createElement("div");

    container.innerHTML = `
        <label>Sass</label>
        <div>${sass.info.match(/\d+\.\d+\.\d+/)[0]}</div>
    `;

    return container;
}

const td = new TextDecoder();

function getVersionJSON(tsgo?: boolean): Promise<{
    major: string;
    minor: string;
    patch: string;
    build: string;
    branch: string;
    hash: string;
}> {
    const payload = new Uint8Array([
        1, // static file serving,
        ...serializeArgs([tsgo ? "/version-tsgo.json" : "/version.json"])
    ]);

    return bridge(payload, ([_, jsonData]) => JSON.parse(td.decode(jsonData)));
}
