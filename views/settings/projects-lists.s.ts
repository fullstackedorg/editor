import style from "style";
import colors, { opacity } from "@fullstacked/ui/values/colors.s";
import spacing from "@fullstacked/ui/values/spacing.s";
import typography from "@fullstacked/ui/values/typography.s";
import breakpoints from "@fullstacked/ui/values/breakpoints.s";

export const projectsListsSettingsClass = style.createClass(
    "projects-lists-settings",
    {
        p: {
            paddingTop: spacing.s,
            fontSize: typography.s
        },
        ul: {
            display: "flex",
            flexDirection: "column",
            gap: spacing.s,
            paddingTop: spacing.s,

            li: {
                border: `1px solid ${colors.gray.main}`,
                backgroundColor: colors.gray.dark,
                padding: spacing.s,
                borderRadius: spacing.xs,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "stretch",

                "> div:first-child": {
                    display: "flex",
                    flexDirection: "column",

                    "> div:last-child": {
                        fontSize: typography.s,
                        color: opacity(colors.light, 80)
                    }
                },
                "> div:last-child": {
                    display: "flex",
                    alignItems: "center",
                    gap: spacing.xs,
                    minHeight: "100%",

                    button: {
                        color: colors.light,
                        alignSelf: "flex-start"
                    },

                    [`@media (max-width: ${breakpoints.s}px)`]: {
                        flexDirection: "column",

                        button: {
                            alignSelf: "flex-end",
                            order: 1
                        },
                        ".badge": {
                            order: 2
                        }
                    }
                }
            }
        }
    }
);
