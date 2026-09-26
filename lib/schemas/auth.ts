import { z } from "zod";

/**
 * Structural shape shared by the server-side authorize() check and (with
 * locale-aware messages layered on top) the client login form. Message text
 * itself lives in next-intl dictionaries, not here — this just guards shape.
 */
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
