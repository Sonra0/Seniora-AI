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
      script: "npx",
      args: "tsx src/cron/worker.ts",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
