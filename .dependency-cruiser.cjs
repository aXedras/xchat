module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies make UI state and quote-request flows hard to reason about.",
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: "no-orphans-in-domain",
      severity: "warn",
      from: {
        orphan: true,
        path: "^src/(hooks|utils|types)/",
      },
      to: {},
    },
  ],
  options: {
    tsConfig: {
      fileName: "./tsconfig.json",
    },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    },
    doNotFollow: {
      path: "node_modules",
    },
    exclude: {
      path: "(^dist/)|(^node_modules/)",
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};