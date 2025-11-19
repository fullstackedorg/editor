import style from "style";
import spacing, { maxWidth } from "@fullstacked/ui/values/spacing.s";
import colors from "@fullstacked/ui/values/colors.s";

export const addProjectButtonsClass = "buttons";
export const addProjectClass = style.createClass("add-project", {
    paddingBottom: spacing.s,

    [`.${addProjectButtonsClass}`]: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: spacing.l,
        paddingTop: spacing.l
    }
});

export const createFormClass = style.createClass("create-form", {
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",

    ".top-bar": {
        paddingBottom: spacing.s
    },

    form: {
        paddingTop: spacing.m,
        paddingBottom: spacing.m,

        display: "flex",
        flexDirection: "column",
        gap: spacing.s,

        width: "100%",
        maxWidth,

        margin: "0 auto",

        button: {
            alignSelf: "flex-end"
        }
    }
});

export const createLoaderClass = style.createClass("create-loader", {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    gap: spacing.m,
    paddingBottom: spacing.m,
    ".loader": {
        width: 60
    }
});

export const createTerminalClass = style.createClass("create-terminal", {
    backgroundColor: colors.dark,
    border: `1px solid ${colors.gray.main}`,
    color: colors.light,
    overflow: "auto",
    height: "100%",
    borderRadius: spacing.xs,
    minHeight: 250,
    flex: 1,
    "> pre": {
        padding: spacing.m,
        minHeight: "100%"
    }
});
