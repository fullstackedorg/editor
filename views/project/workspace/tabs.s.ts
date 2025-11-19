import style, { CSSProperties } from "style";
import colors, { opacity } from "@fullstacked/ui/values/colors.s";
import spacing from "@fullstacked/ui/values/spacing.s";
import typography from "@fullstacked/ui/values/typography.s";

const tabsRedDot: CSSProperties = {
    "> span::after": {
        content: '""',
        backgroundColor: colors.red,
        position: "absolute",
        height: 8,
        width: 8,
        borderRadius: "50%",
        top: -2,
        right: -6
    }
};

export const activeTabClass = "active";
export const errorTabClass = "has-error";
export const streamingTabClass = "is-streaming";

export const tabsClass = style.createClass("tabs", {
    whiteSpace: "nowrap",
    overflow: "auto",
    display: "flex",
    alignItems: "center",

    "> div": {
        display: "inline-flex",
        alignItems: "center",
        padding: `${spacing.xs}px ${spacing.xs}px ${spacing.xs}px ${spacing.s}px`,
        borderRight: `1px solid ${colors.gray.main}`,
        gap: spacing.xs,
        cursor: "pointer",

        "> span": {
            position: "relative",
            color: opacity(colors.light, 50),

            small: {
                paddingLeft: spacing.xs,
                opacity: 0.6,
                fontSize: typography.s
            }
        },

        [`&.${activeTabClass}`]: {
            "> span": {
                color: colors.light
            }
        },

        [`&.${errorTabClass}`]: tabsRedDot,
        [`&.${streamingTabClass}`]: {
            "> span::after": {
                ...tabsRedDot["> span::after"],
                animation: `${style.createAnimation("flash", {
                    from: {
                        opacity: 1
                    },
                    to: {
                        opacity: 0.3
                    }
                })} 1s linear infinite alternate`
            }
        },

        ".dev-icon": {
            fontSize: 24,
            height: 24,
            width: 24,
            ".icon": {
                padding: 3
            }
        },

        "button svg": {
            height: 18,
            width: 18
        }
    }
});

export const filePathHelperClass = style.createClass("file-path-helper", {
    backgroundColor: colors.gray.dark,
    padding: `${spacing.xs}px ${spacing.s}px`,
    borderRadius: spacing.xs,
    fontSize: typography.s,
    whiteSpace: "nowrap",
    position: "fixed",
    pointerEvents: "none"
});
