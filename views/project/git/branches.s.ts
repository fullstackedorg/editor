import colors from "../../../style/colors.s";
import spacing from "../../../style/spacing.s";
import style from "style";

export const gitBranchesClass = style.createClass("git-branches", {
    "> div:first-child": {
        display: "flex",
        justifyContent: "space-between",
        gap: spacing.xs,
        alignItems: "center",

        h3: {
            flex: 1
        }
    }
});

export const createBranchFormClass = style.createClass("create-branch-form", {
    display: "flex",
    flexDirection: "column",
    gap: spacing.s,
    paddingTop: spacing.s,

    "> div:last-child": {
        display: "flex",
        justifyContent: "space-between"
    }
});

export const gitBranchListClass = style.createClass("git-branch-list", {
    display: "flex",
    flexDirection: "column",
    gap: spacing.s,
    padding: `${spacing.m}px 0`,

    li: {
        backgroundColor: colors.gray.dark,
        border: `1px solid ${colors.gray.main}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.xs,
        borderRadius: spacing.xs,
        padding: spacing.s,

        "> div:first-child": {
            height: 24,
            width: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            "> svg": {
                height: 20,
                width: 20
            }
        },

        "> div:nth-child(2)": {
            flex: 1
        },

        "> div:nth-child(4)": {
            height: 24,
            width: 24
        },

        "> button:last-child": {
            color: colors.light
        }
    }
});
