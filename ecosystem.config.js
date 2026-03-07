module.exports = {
  apps: [
    {
      name: "seniora-web",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "seniora-cron",
      script: "node_modules/.bin/tsx",
      args: "src/cron/worker.ts",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
