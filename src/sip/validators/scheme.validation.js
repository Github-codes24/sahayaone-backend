
import Joi from "joi";

const FIXED_AMOUNTS = [
  100,
  300,
  500,
  800,
  1000,
  1200,
  1500,
  1800,
  2100,
];

const durationPlanSchema = Joi.object({
  durationMonths: Joi.number()
    .valid(1, 3, 6, 12)
    .required(),

  interestRate: Joi.number()
    .min(0)
    .required(),
});

export const createSchemeSchema = Joi.object({
  schemeCode: Joi.string()
    .trim()
    .uppercase()
    .required(),

  schemeName: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required(),

  description: Joi.string()
    .trim()
    .allow("")
    .default(""),

  frequency: Joi.string()
    .valid("DAILY")
    .default("DAILY"),

  durationPlans: Joi.array()
    .items(durationPlanSchema)
    .min(1)
    .required(),

  allowedAmounts: Joi.array()
    .items(
      Joi.number()
        .valid(...FIXED_AMOUNTS)
    )
    .min(1)
    .required(),

  customAmountEnabled: Joi.boolean()
    .default(true),

  customAmountMin: Joi.when("customAmountEnabled", {
    is: true,
    then: Joi.number()
      .min(5000)
      .required(),

    otherwise: Joi.number()
      .min(5000)
      .optional()
      .allow(null),
  }),

  customAmountMax: Joi.when("customAmountEnabled", {
    is: true,
    then: Joi.number()
      .greater(Joi.ref("customAmountMin"))
      .required(),

    otherwise: Joi.number()
      .greater(Joi.ref("customAmountMin"))
      .optional()
      .allow(null),
  }),

  status: Joi.string()
    .valid("ACTIVE", "INACTIVE")
    .default("ACTIVE"),
}).unknown(false);

export { FIXED_AMOUNTS };






// import Joi from "joi";


// const FIXED_AMOUNTS = [
//   100,
//   300,
//   500,
//   800,
//   1000,
//   1200,
//   1500,
//   1800,
//   2100,
// ];

// const durationPlanSchema = Joi.object({
//   durationMonths: Joi.number()
//     .valid(1, 3, 6, 12)
//     .required(),

//   interestRate: Joi.number()
//     .min(0)
//     .required(),
// });

// export const createSchemeSchema = Joi.object({
//   schemeCode: Joi.string()
//     .trim()
//     .uppercase()
//     .required(),

//   schemeName: Joi.string()
//     .trim()
//     .min(2)
//     .max(100)
//     .required(),

//   description: Joi.string()
//     .trim()
//     .allow("")
//     .optional(),

//   frequency: Joi.string()
//     .valid("DAILY")
//     .default("DAILY"),

//   durationPlans: Joi.array()
//     .items(durationPlanSchema)
//     .min(1)
//     .required(),

//   allowedAmounts: Joi.array()
//     .items(
//       Joi.number()
//         .valid(...FIXED_AMOUNTS)
//     )
//     .min(1)
//     .required(),

//   customAmountEnabled: Joi.boolean()
//     .default(true),

//   customAmountMin: Joi.when("customAmountEnabled", {
//     is: true,
//     then: Joi.number()
//       .min(3000)
//       .required(),
//     otherwise: Joi.number()
//       .min(3000)
//       .optional(),
//   }),

//   customAmountMax: Joi.when("customAmountEnabled", {
//     is: true,
//     then: Joi.number()
//       .greater(Joi.ref("customAmountMin"))
//       .required(),
//     otherwise: Joi.number()
//       .optional()
//       .allow(null),
//   }),

//   status: Joi.string()
//     .valid("ACTIVE", "INACTIVE")
//     .default("ACTIVE"),
// });

// export { FIXED_AMOUNTS };