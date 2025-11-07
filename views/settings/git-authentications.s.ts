import style from "style";
import spacing from "../../style/spacing.s";
import colors from "../../style/colors.s";

export const settingsGitAuthClass = style.createClass("git-authentications", {
    "> div:first-child": {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        paddingBottom: spacing.s
    },

    ul: {
        display: "flex",
        flexDirection: "column",
        gap: spacing.s,

        li: {
            "> div": {
                border: `1px solid ${colors.gray.main}`,
                backgroundColor: colors.gray.dark,
                padding: spacing.s,
                borderRadius: spacing.xs,
                display: "flex",
                flexDirection: "column",
                gap: spacing.s,

                "> div:first-child": {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",

                    "> button > .icon": {
                        color: colors.light
                    }
                },

                "> div:not(:first-child)": {
                    display: "flex",
                    flexDirection: "column",
                    gap: 3
                }
            }
        }
    },

    form: {
        backgroundColor: colors.gray.dark,
        border: `1px solid ${colors.gray.main}`,
        padding: spacing.s,
        borderRadius: spacing.xs,
        display: "flex",
        flexDirection: "column",
        gap: spacing.s,

        "> div:last-child": {
            display: "flex",
            justifyContent: "space-between"
        },

        "+ ul": {
            paddingTop: spacing.s
        }
    }
});
