import style from "style";
import spacing from "@fullstacked/ui/values/spacing.s";
import colors from "@fullstacked/ui/values/colors.s";
import typography from "@fullstacked/ui/values/typography.s";

export const packagesViewClass = style.createClass("packages-view", {
    h3: {
        paddingBottom: spacing.s
    },

    ul: {
        display: "flex",
        flexDirection: "column",
        gap: spacing.s,

        li: {
            backgroundColor: colors.gray.dark,
            border: `1px solid ${colors.gray.main}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            padding: spacing.s,
            borderRadius: spacing.xs,
            overflow: "hidden",

            "> div:nth-child(2)": {
                fontSize: typography.s
            }
        }
    }
});

export const progressBarClass = style.createClass("progress-bar", {
    position: "absolute",
    left: 0,
    bottom: 0,
    width: 0,
    height: spacing.xs,
    backgroundColor: colors.blue.main
});
