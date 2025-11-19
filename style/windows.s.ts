import style from "style";
import colors, { opacity } from "@fullstacked/ui/values/colors.s";

export const windowsClass = style.createClass("windows", {
    "*::-webkit-scrollbar": {
        width: 8,
        height: 5,
        backgroundColor: opacity(colors.gray.dark, 0)
    },

    "*::-webkit-scrollbar:hover": {
        backgroundColor: opacity(colors.gray.dark, 50)
    },

    "*::-webkit-scrollbar-thumb": {
        background: opacity(colors.gray.main, 50),
        borderRadius: 10
    },

    "*::-webkit-scrollbar-thumb:active": {
        background: opacity(colors.gray.main, 80),
        borderRadius: 10
    },

    "*::-webkit-scrollbar-corner": {
        backgroundColor: opacity(colors.gray.dark, 0)
    }
});
