import { bridge } from "../lib/bridge";
import { serializeArgs } from "../lib/bridge/serialization";
import core_fetch from "../lib/fetch";
import core_message from "../lib/core_message";
import archive from "./lib/archive";
import git from "./lib/git";
import {
    createAndMoveProjectFromTmp,
    tmpDir
} from "./views/add-project/import-zip";

export async function Demo() {
    try {
        await core_fetch("https://github.com/fullstackedorg", { timeout: 3 });
    } catch (e) {
        return demoFromZip();
    }

    return demoFromGitHub();
}

async function demoFromZip() {
    const payload = new Uint8Array([
        1, // static file serving

        ...serializeArgs(["Demo.zip"])
    ]);

    const [_, demoZipData] = await bridge(payload);
    await archive.unzip(tmpDir, demoZipData);
    createAndMoveProjectFromTmp(
        {
            container: null,
            logger: () => {},
            text: null
        },
        "Demo",
        null
    );
}

const demoRepoUrl = "https://github.com/fullstackedorg/editor-sample-demo.git";

async function demoFromGitHub() {
    let checkForDone: (message: string) => void;
    const donePromise = new Promise<void>((resolve) => {
        checkForDone = (progress: string) => {
            if (progress.trim().endsWith("done")) {
                resolve();
            }
        };
    });

    core_message.addListener("git-clone", checkForDone);

    git.clone(demoRepoUrl, tmpDir);

    await donePromise;

    core_message.removeListener("git-clone", checkForDone);

    await createAndMoveProjectFromTmp(
        {
            container: null,
            logger: () => {},
            text: null
        },
        "Demo",
        demoRepoUrl
    );
}
