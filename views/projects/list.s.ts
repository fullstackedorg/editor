import style from "style";
import spacing from "@fullstacked/ui/values/spacing.s";
import breakpoints from "@fullstacked/ui/values/breakpoints.s";
import colors, { opacity } from "@fullstacked/ui/values/colors.s";

export const projectTileClass = "project-tile";
export const projectLoadingClass = "loading";
export const projectTitleIdClass = "title-id";
export const projectOptionsPopoverClass = "options-popover";
export const projectDeleteDialogClass = "confirm";
export const projectsListClass = style.createClass("projects-list", {
    display: "grid",
    gap: spacing.m,
    gridTemplateColumns: "repeat(4, 1fr)",

    [`@media (max-width: ${breakpoints.xl}px)`]: {
        gridTemplateColumns: "repeat(3, 1fr)"
    },
    [`@media (max-width: ${breakpoints.l}px)`]: {
        gridTemplateColumns: "repeat(2, 1fr)"
    },
    [`@media (max-width: ${breakpoints.sm}px)`]: {
        gridTemplateColumns: "repeat(1, 1fr)"
    },

    [`.${projectTileClass}`]: {
        position: "relative",
        cursor: "pointer",
        backgroundColor: opacity(colors.light, 15),
        width: "100%",
        aspectRatio: "39 / 22",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        overflow: "hidden",
        padding: spacing.s,

        [`&.${projectLoadingClass}`]: {
            backgroundColor: opacity(colors.light, 25)
        },

        [`> .${projectTitleIdClass}`]: {
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: spacing.xs,

            "> h2": {
                width: "100%",
                textOverflow: "ellipsis",
                overflow: "hidden",
                direction: "rtl",
                whiteSpace: "nowrap"
            }
        },

        "> button": {
            position: "absolute",
            color: colors.light,
            bottom: 0,
            right: spacing.xs
        },

        [`.${projectOptionsPopoverClass}`]: {
            padding: spacing.xs
        },

        ".loader": {
            position: "absolute",
            top: spacing.xs,
            left: spacing.xs,
            height: 24,
            width: 24
        }
    }
});
