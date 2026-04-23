import { z } from "zod";

const coordinatePairSchema = z.tuple([
  z.number().min(-90).max(90),
  z.number().min(-180).max(180),
]);

export const assessmentGeofenceSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(300).optional().or(z.literal("")),
    coordinates: z.array(coordinatePairSchema),
    category: z.enum([
      "delivery_zone",
      "restricted_zone",
      "toll_zone",
      "customer_area",
    ]),
  })
  .superRefine((value, context) => {
    if (value.coordinates.length < 4) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["coordinates"],
        message: "At least 4 coordinates are required.",
      });
      return;
    }

    const [firstLat, firstLng] = value.coordinates[0];
    const [lastLat, lastLng] = value.coordinates[value.coordinates.length - 1];

    if (firstLat !== lastLat || firstLng !== lastLng) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["coordinates"],
        message: "First and last coordinates must be identical.",
      });
    }
  });

export const assessmentVehicleSchema = z.object({
  vehicle_number: z.string().trim().min(3).max(40),
  driver_name: z.string().trim().min(2).max(80),
  vehicle_type: z.string().trim().min(2).max(40),
  phone: z.string().trim().min(7).max(20),
});

export const vehicleLocationSchema = z.object({
  vehicle_id: z.string().trim().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timestamp: z.string().datetime({ offset: true }),
});

export const alertConfigurationSchema = z.object({
  geofence_id: z.string().trim().min(1),
  vehicle_id: z.string().trim().min(1).optional(),
  event_type: z.enum(["entry", "exit", "both"]),
});
