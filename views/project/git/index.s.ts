import style from "style";
import spacing from "../../../style/spacing.s";
import typography from "../../../style/typography.s";
import colors from "../../../style/colors.s";

export const gitDialogClass = style.createClass("git-dialog", {
    display: "flex",
    flexDirection: "column",

    ul: {
        listStyleType: "none"
    },
    ol: {
        listStyleType: "none"
    }
});

export const gitStatusPlacholderClass = style.createClass(
    "status-placeholder",
    {
        paddingTop: spacing.m
    }
);

export const gitTopClass = style.createClass("git-top", {
    display: "flex",
    alignItems: "center",
    gap: spacing.xs,
    paddingBottom: spacing.s,

    "> .icon": {
        height: 38,
        width: 38
    }
});

export const gitFormClass = style.createClass("git-form", {
    display: "flex",
    flexDirection: "column",

    form: {
        display: "flex",
        flexDirection: "column",
        paddingTop: spacing.s,

        ".message": {
            paddingTop: spacing.s
        }
    },

    ".message": {
        justifyContent: "flex-end"
    }
});

export const gitFormButtonClass = style.createClass("git-buttons", {
    display: "flex",
    justifyContent: "space-between",
    paddingTop: spacing.s
});

export const gitInfoClass = style.createClass("git-info", {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",

    "> *": {
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
    },

    a: {
        fontSize: typography.s
    },
    "> div:last-child": {
        fontSize: typography.s
    }
});

export const gitAuthorClass = style.createClass("git-author", {
    display: "flex",
    backgroundColor: colors.gray.dark,
    border: `1px solid ${colors.gray.main}`,
    padding: spacing.s,
    borderRadius: spacing.xs,
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.s,

    ".icon": {
        height: 30
    }
});
export const gitAuthorInfoClass = style.createClass("git-author-infos", {
    flex: 1,
    display: "flex",
    justifyContent: "space-between",
    fontSize: typography.s,
    alignItems: "center"
});
export const gitAuthorFormClass = style.createClass("git-author-form", {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: spacing.s,

    "> div:last-child": {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
    }
});

export const gitStatusClass = style.createClass("git-status", {
    paddingTop: spacing.m,

    ".input-text": {
        paddingTop: spacing.s,
        paddingBottom: spacing.s
    }
});

export const gitChangesClass = style.createClass("git-changes", {
    "> div": {
        fontWeight: "bold"
    },

    ul: {
        display: "flex",
        flexDirection: "column",
        gap: spacing.xs,
        paddingTop: spacing.xs,
        paddingBottom: spacing.s,

        li: {
            backgroundColor: colors.gray.dark,
            border: `1px solid ${colors.gray.main}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: `0 ${spacing.xs}px`,
            borderRadius: spacing.xs,

            "> button": {
                color: colors.light
            }
        }
    }
});
