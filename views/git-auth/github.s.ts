import style from "style";
import spacing from "../../style/spacing.s";
import colors from "../../style/colors.s";
import typography from "../../style/typography.s";

export const githubAuthClass = style.createClass("github-auth", {
    h3: {
        paddingBottom: spacing.m
    },

    "> div": {
        display: "flex",
        flexDirection: "column",
        gap: spacing.m,
        alignItems: "center",

        p: {
            alignSelf: "flex-start"
        },

        "> button": {
            alignSelf: "flex-end"
        },

        code: {
            display: "flex",
            padding: spacing.s,
            gap: spacing.s,
            backgroundColor: colors.gray.dark,
            border: `1px solid ${colors.gray.main}`,
            alignItems: "center",
            fontFamily: "inherit",
            borderRadius: spacing.xs,
            fontSize: typography.h2,

            "> .icon": {
                height: 38,
                width: 38,
                color: colors.green,

                svg: {
                    height: 30,
                    width: 30
                }
            }
        }
    }
});
