import { ValidationError } from '../common/validation.error.js';

export const validateRequest = (schemas) => {
  return (req, res, next) => {
    const targets = ['body', 'query', 'params'];

    for (const target of targets) {
      if (schemas[target] && req[target]) {
        const { error, value } = schemas[target].validate(req[target], {
          abortEarly: false,
          allowUnknown: false,
          stripUnknown: true
        });

        if (error) {
          return next(ValidationError.fromJoi(error));
        }

        req[target] = value;
      }
    }

    next();
  };
};
