import { z } from 'zod';

// TODO: Stub for Zod validator schemas (Phase 0)
export const StubSchema = z.object({
  id: z.string().optional(),
});

export type StubSchemaType = z.infer<typeof StubSchema>;
