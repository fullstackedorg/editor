import "./index.css";
import api from "../../api";

type requestedGitAuthCallback = (gitAuth: {
    host: string;
    username: string;
    email: string;
    password: string;
}) => void;

export class GitAuth {
    private static async githubDeviceFlow(confirm: requestedGitAuthCallback) {
        const container = document.createElement("div");
        container.classList.add("github-device-flow");

        const start: {
            device_code: string;
            expires_in: number;
            interval: number;
            user_code: string;
            verification_uri: string;
        } = JSON.parse(await api.git.github.deviceFlowStart());

        const ol = document.createElement("ol");

        const step1 = document.createElement("li");
        step1.innerHTML = `<div>Copy this code</div>`;

        const code = document.createElement("div");
        code.classList.add("code");
        code.innerHTML = `<span>${start.user_code}</span>`;
        const copyToClip = document.createElement("button");

        const [copyIcon, checkIcon] = await Promise.all([
            (await fetch("assets/icons/copy.svg")).text(),
            (await fetch("assets/icons/check.svg")).text()
        ]);
        copyToClip.addEventListener("click", () => {
            copyToClipboard(start.user_code);
            copyToClip.innerHTML = checkIcon;
            copyToClip.classList.add("copied");
        });
        copyToClip.classList.add("text");
        copyToClip.innerHTML = copyIcon;
        code.append(copyToClip);

        step1.append(code);

        ol.append(step1);

        const step2 = document.createElement("li");
        step2.innerHTML = `<div>Go to <a href="${start.verification_uri}" target="_blank">${start.verification_uri}</a> to verify.</div>
        <a href="${start.verification_uri}" target="_blank"><button>Verify</button></a>`;

        ol.append(step2);

        const step3 = document.createElement("li");
        ol.append(step3);

        let waitTime = start.interval;
        const startPolling = async () => {
            let authenticated = false;

            while (!authenticated) {
                step3.innerText = `Validating authentication in ${waitTime}s...`;
                await sleep(1000);
                waitTime--;

                if (waitTime === 0) {
                    step3.innerText = `Validating authentication...`;

                    const poll = await api.git.github.deviceFlowPoll(
                        start.device_code
                    );

                    if (poll.password) {
                        authenticated = true;
                        step3.innerText = `Authenticated`;
                        console.log(poll);
                        confirm({
                            host: "github.com",
                            ...poll
                        } as any);
                        break;
                    } else if (poll.error) {
                        step3.innerText = poll.error;
                        return;
                    }

                    waitTime = poll.wait || start.interval;
                }
            }
        };

        container.append(ol);

        startPolling();

        return container;
    }

    static async renderGitAuthForm(
        confirm: requestedGitAuthCallback,
        cancel: () => void,
        auth?: {
            host?: string;
            username?: string;
            email?: string;
        },
        create = true
    ) {
        if (auth?.host === "github.com" && create) {
            return this.githubDeviceFlow(confirm);
        }

        const form = document.createElement("form");
        form.classList.add("git-form");

        let hostnameInput: HTMLInputElement;
        if (!auth?.host) {
            const hostLabel = document.createElement("label");
            hostLabel.innerText = "Hostname";
            form.append(hostLabel);

            hostnameInput = document.createElement("input");
            form.append(hostnameInput);
        }

        const usernameLabel = document.createElement("label");
        usernameLabel.innerText = "Username";
        form.append(usernameLabel);

        const usernameInput = document.createElement("input");
        usernameInput.value = auth?.username || "";
        form.append(usernameInput);

        const emailInputLabel = document.createElement("label");
        emailInputLabel.innerText = "Email (optional)";
        form.append(emailInputLabel);

        const emailInput = document.createElement("input");
        emailInput.type = "email";
        emailInput.value = auth?.email || "";
        form.append(emailInput);

        const passwordLabel = document.createElement("label");
        passwordLabel.innerText = "Password";
        form.append(passwordLabel);

        let passwordInput: HTMLInputElement;
        if (create) {
            passwordInput = document.createElement("input");
            passwordInput.type = "password";
            form.append(passwordInput);
        } else {
            const div = document.createElement("div");
            div.innerText = "To change password, delete and re-create.";
            form.append(div);
        }

        const buttonGroup = document.createElement("div");

        const confirmButton = document.createElement("button");
        confirmButton.classList.add("text");
        confirmButton.innerHTML = await (
            await fetch("assets/icons/check.svg")
        ).text();
        buttonGroup.append(confirmButton);

        const cancelButton = document.createElement("button");
        cancelButton.classList.add("text", "danger");
        cancelButton.innerHTML = await (
            await fetch("assets/icons/close.svg")
        ).text();
        cancelButton.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            cancel();
        });
        buttonGroup.append(cancelButton);

        form.append(buttonGroup);

        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const host = hostnameInput?.value || auth.host;
            const username = usernameInput.value;
            const email = emailInput.value;
            const password = passwordInput?.value;

            confirm({
                host,
                username,
                email,
                password
            });
        });

        return form;
    }

    static async requestAuth(
        host: string,
        confirm: requestedGitAuthCallback,
        cancel: () => void
    ) {
        const dialog = document.createElement("div");
        dialog.classList.add("dialog", "git-auth");

        const container = document.createElement("div");

        const text = document.createElement("p");
        text.innerHTML = `Authenticate for <b>${host}<b>`;
        container.append(text);

        container.append(
            await GitAuth.renderGitAuthForm(
                (gitAuth) => {
                    confirm(gitAuth);
                    dialog.remove();
                },
                cancel,
                { host }
            )
        );

        dialog.append(container);

        document.body.append(dialog);
    }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function copyToClipboard(str: string) {
    const input = document.createElement("textarea");
    input.innerHTML = str;
    document.body.appendChild(input);
    input.select();
    const result = document.execCommand("copy");
    document.body.removeChild(input);
    return result;
}
