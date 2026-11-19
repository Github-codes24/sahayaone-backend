import { envConfig } from './env.config.js';

export const swaggerConfig = Object.freeze({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sahayaone Enterprise Loan ERP API',
      version: '1.0.0',
      description: 'API documentation for panel-based Sahayaone ERP.'
    },
    servers: [
      {
        url: `${envConfig.appUrl}${envConfig.apiPrefix}`,
        description: 'Gateway API v1'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/panels/**/*.routes.js', './src/app.js']
});
