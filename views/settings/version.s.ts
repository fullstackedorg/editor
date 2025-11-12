import style from "style";
import spacing from "../../style/spacing.s";

export const editorVersionClass = "editor-version";
export const tsVersionClass = "ts-version";
export const versionClass = style.createClass("version", {
    display: "flex",
    flexDirection: "column",
    gap: spacing.m,

    "> div": {
        display: "flex",
        flexDirection: "column",
        gap: spacing.xs,

        "> div": {
            alignSelf: "flex-end"
        }
    },

    [`.${tsVersionClass}`]: {
        "> div": {
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end"
        }
    },

    [`.${editorVersionClass}`]: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",

        "> div:first-child": {
            display: "flex",
            alignItems: "flex-end",
            gap: spacing.xs
        }
    }
});
