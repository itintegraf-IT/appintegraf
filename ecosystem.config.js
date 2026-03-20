module.exports = {
  apps: [
    {
      name: "appintegraf",
      cwd: "/var/www/appintegraf",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3010",
      env: {
        NODE_ENV: "production",
        DATABASE_URL: "mysql://root:mysql@localhost:3306/appintegraf",
        AUTH_SECRET: "fnkxYM7xFXAqYlyzFgB8KB/NLiDSnzdEniopPrVLwv8=",
        AUTH_URL: "https://appintegraf.integraf.cz",
        NEXT_PUBLIC_API_URL: "https://appintegraf.integraf.cz"
      }
    }
  ]
}
