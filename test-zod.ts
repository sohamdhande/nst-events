import { z } from "zod";

const ParamIdSchema = z.object({
  params: z.object({ id: z.string() }).passthrough(),
});

async function run() {
  const parsed = await ParamIdSchema.parseAsync({
    body: { title: "Hello" },
    query: {},
    params: { id: "123" }
  });
  console.log("Parsed by ParamIdSchema:", parsed);
}
run();
