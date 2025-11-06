import style from "style";
import spacing from "../../style/spacing.s";

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

    ".editor-version": {
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
