import { EditorView } from "@codemirror/view";
import { WorkerTS } from "../../../typescript";
import { CompletionContext } from "@codemirror/autocomplete"

export const tsErrorLinter = (filePath: string) =>
    async (view: EditorView) => {
        await WorkerTS
            .call()
            .updateFile(
                filePath,
                view.state.doc.toString()
            );

        const getAllTsError = async () => {
            const tsErrors = await Promise.all([
                WorkerTS
                    .call()
                    .getSemanticDiagnostics(filePath),
                WorkerTS
                    .call()
                    .getSyntacticDiagnostics(filePath),
                WorkerTS
                    .call()
                    .getSuggestionDiagnostics(filePath)
            ]);

            return tsErrors.flat();
        };

        const tsErrors = await getAllTsError();

        // const needsTypes = tsErrors.filter((e) => {
        //     if (e.code !== 7016) return false;

        //     const text =
        //         e.file?.text || this.editor.state.doc.toString();

        //     const moduleName = text
        //         .toString()
        //         .slice(e.start, e.start + e.length)
        //         .slice(1, -1);

        //     return (
        //         !moduleName.startsWith(".") &&
        //         !Editor.ignoredTypes.has(`@types/${moduleName}`)
        //     );
        // });

        // if (needsTypes.length) {
        //     const ignored = await PackageInstaller.install(
        //         needsTypes.map((e) => {
        //             const text =
        //                 e.file?.text ||
        //                 this.editor.state.doc.toString();
        //             const moduleName = text
        //                 .toString()
        //                 .slice(e.start, e.start + e.length)
        //                 .slice(1, -1);
        //             return {
        //                 name: `@types/${moduleName}`,
        //                 deep: true
        //             };
        //         })
        //     );

        //     ignored?.forEach(({ name }) =>
        //         Editor.ignoredTypes.add(name)
        //     );

        //     await Editor.restartTSWorker();
        //     await this.updateFile();
        //     tsErrors = await getAllTsError();
        // }

        return tsErrors.map((tsError) => ({
            from: tsError.start,
            to: tsError.start + tsError.length,
            severity: tsError.code === 7016 ? "warning" : "error",
            message:
                typeof tsError.messageText === "string"
                    ? tsError.messageText
                    : (tsError?.messageText?.messageText ?? "")
        }));
    }


export const tsAutocomplete = (filePath: string) =>
    async (ctx: CompletionContext) => {
        const text = ctx.state.doc.toString();
        await WorkerTS
            .call()
            .updateFile(filePath, text);

        let tsCompletions = await WorkerTS
            .call()
            .getCompletionsAtPosition(
                filePath,
                ctx.pos,
                {}
            );

        if (!tsCompletions) return { from: ctx.pos, options: [] };

        let lastWord, from;
        for (let i = ctx.pos - 1; i >= 0; i--) {
            if (
                [
                    " ",
                    ".",
                    "\n",
                    ":",
                    "{",
                    "<",
                    '"',
                    "'",
                    "(",
                    "["
                ].includes(text[i]) ||
                i === 0
            ) {
                from = i === 0 ? i : i + 1;
                lastWord = text.slice(from, ctx.pos).trim();
                break;
            }
        }

        if (lastWord) {
            tsCompletions.entries = tsCompletions.entries.filter(
                (completion) => completion.name.startsWith(lastWord)
            );
        }

        return {
            from: ctx.pos,
            options: tsCompletions.entries.map((completion) => ({
                label: completion.name,
                apply: (view: EditorView) => {
                    view.dispatch({
                        changes: {
                            from,
                            to: ctx.pos,
                            insert: completion.name
                        }
                    });
                    if (from === ctx.pos) {
                        view.dispatch({
                            selection: {
                                anchor:
                                    from + completion.name.length,
                                head: from + completion.name.length
                            }
                        });
                    }
                }
            }))
        };
    };

export const tsTypeDefinition = (filePath: string) =>
    async (view, pos, side) => {
        const info = await WorkerTS
            .call()
            .getQuickInfoAtPosition(filePath, pos);
        const text = info?.displayParts
            ?.map(({ text }) => text)
            .join("");

        if (!text) return null;

        return {
            pos: info.textSpan.start,
            end: info.textSpan.start + info.textSpan.length,
            above: true,
            create(view) {
                let dom = document.createElement("div");
                const pre = document.createElement("pre");
                pre.innerText = text;
                dom.append(pre);
                return { dom };
            }
        };
    };