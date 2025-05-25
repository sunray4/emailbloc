module.exports = {
    content: [
        "./src/**/*.{js,ts,jsx,tsx,html}",
    ],
    safelist: [
        { pattern: /bg-(red|blue|green|zinc|gray|slate|neutral|stone|amber|yellow|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900)/ },
        { pattern: /bg-\[\#.*\]/ }, // arbitrary bg colors
    ],
};