export default () => ({
  port: parseInt(process.env.PORT || '4000', 10),
  database: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME || 'kamux',
  },
  jwtSecret: process.env.JWT_SECRET,
});
