import style from "style";
import spacing, { maxWidth } from "@fullstacked/ui/values/spacing.s";
import typography from "@fullstacked/ui/values/typography.s";

export const settingsClass = style.createClass("settings", {
    "ul, ol": {
        listStyleType: "none"
    },

    ".top-bar": {
        paddingBottom: spacing.s
    },

    ".scrollable": {
        paddingTop: spacing.s,
        gap: spacing.l,

        "> div": {
            width: "100%",
            maxWidth: maxWidth,
            margin: "0 auto"
        }
    }
});

export const userModeClass = style.createClass("user-mode", {
    paddingTop: spacing.s,
    display: "flex",
    gap: spacing.xs,
    flexDirection: "column",
    h2: {
        minWidth: 200
    },

    "> div:first-child": {
        display: "flex",
        justifyContent: "space-between"
    },

    "> p": {
        fontSize: typography.s
    }
});

export const agentConfigsClass = style.createClass("agent-provider-config", {
    display: "flex",
    flexDirection: "column",
    gap: spacing.xs
});
