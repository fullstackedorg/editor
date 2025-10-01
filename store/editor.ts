import { createSubscribable } from ".";
import { Diagnostic } from "@codemirror/lint";

let sidePanelClosed = false;
const sidePanel = createSubscribable(() => sidePanelClosed);

export type BuildError = {
    file: string;
    line: number;
    col: number;
    length: number;
    message: string;
};
let codeEditorBuildErrors: BuildError[] = [];
const buildErrors = createSubscribable(() => codeEditorBuildErrors);

const lspFileDiagnostics = new Map<string, Diagnostic[]>();
const lspDiagnostics = createSubscribable(() => lspFileDiagnostics);

type ChatStatus = "ERROR" | "STREAMING";
const chats = new Map<string, ChatStatus>();
const chatsStatus = createSubscribable(() => chats);

export const editor = {
    sidePanelClosed: sidePanel.subscription,
    setSidePanelClosed,

    codeEditor: {
        buildErrors: buildErrors.subscription,
        addBuildErrors,
        clearAllBuildErrors,

        chatsStatus: chatsStatus.subscription,
        setChatStatus,
        removeChatStatus,
        clearAllChats,

        lspDiagnostics: lspDiagnostics.subscription,
        setFileDiagnostics,
        clearAllFileDiagnostics
    }
};

function setSidePanelClosed(closed: boolean) {
    sidePanelClosed = closed;
    sidePanel.notify();
}

function addBuildErrors(errors: BuildError[]) {
    codeEditorBuildErrors.push(...errors);
    buildErrors.notify();
}

function clearAllBuildErrors() {
    codeEditorBuildErrors = [];
    buildErrors.notify();
}

function setFileDiagnostics(filePath: string, diasgnostics: Diagnostic[]) {
    lspFileDiagnostics.set(filePath, diasgnostics);
    lspDiagnostics.notify();
}
function clearAllFileDiagnostics() {
    lspFileDiagnostics.clear();
    lspDiagnostics.notify();
}

function setChatStatus(filePath: string, status: ChatStatus) {
    chats.set(filePath, status);
    chatsStatus.notify();
}

function removeChatStatus(filePath: string) {
    chats.delete(filePath);
    chatsStatus.notify();
}
function clearAllChats() {
    chats.clear();
    chatsStatus.notify();
}
