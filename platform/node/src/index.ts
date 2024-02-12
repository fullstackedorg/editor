import { JavaScript } from "./javascript";
import os from "os";
import path from "path";
import createInstance from "./createInstance";
import open from "open";
import { buildAPI } from "./build";
import fs from "fs";
import editorContext from "./editorContext";

const home = os.homedir();
const dist = path.resolve(process.cwd(), "..", "..", "dist");

const js = new JavaScript(
    home,
    path.join(dist, "webview"),
    fs.readFileSync(path.join(dist, "api", "index.js"), { encoding: "utf-8" }),
    "node"
);
js.privileged = true;

const launchInstance = (js: JavaScript) => {
    const port = createInstance(js);
    open(`http://localhost:${port}`);
}

editorContext(home, js);

const originalZip = js.ctx.zip;
js.ctx.zip = (projectdir: string, items: string[], to: string) => {
   open(originalZip(projectdir, items, to));
}

js.ctx.run = (projectdir: string, assetdir: string, entrypoint: string, hasErrors: boolean) => {
    const apiScript = buildAPI(path.join(home, entrypoint));

    if(typeof apiScript != 'string' && apiScript?.errors) {
        hasErrors = true;
        js.push("buildError", JSON.stringify(apiScript.errors));
    }

    if(hasErrors)
        return;

    launchInstance(new JavaScript(
        path.join(home, projectdir),
        assetdir,
        apiScript as string,
        "node"
    ));
}

launchInstance(js);