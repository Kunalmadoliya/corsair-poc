import express from "express";
import type {Request, Response} from "express";
import {OpenAIAgentsProvider} from "@corsair-dev/mcp";
import {Agent, run, tool} from "@openai/agents";
import {corsair} from "./src/server/corsair";

const app = express();

app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
  res.send("Hello World!");
});

app.post("/api", async (req: Request, res: Response) => {
  try {
    const {message} = req.body;

    if (!message?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    console.log("📨 Message:", message);

    const provider = new OpenAIAgentsProvider();

    const tools = provider.build({
      corsair,
      tool,
    });

    // Only patch invalid schemas
    for (const t of tools as any[]) {
      if (t.name === "run_script") {
        t.parameters = {
          type: "object",
          properties: {
            code: {
              type: "string",
            },
          },
          required: ["code"],
          additionalProperties: false,
        };
      }

      if (t.name === "get_schema") {
        t.parameters = {
          type: "object",
          properties: {
            path: {
              type: "string",
            },
          },
          required: ["path"],
          additionalProperties: false,
        };
      }

      if (t.name === "list_operations") {
        t.parameters = {
          type: "object",
          properties: {},
          additionalProperties: false,
        };
      }

      if (t.name === "corsair_setup") {
        t.parameters = {
          type: "object",
          properties: {},
          additionalProperties: false,
        };
      }
    }
    const agent = new Agent({
      name: "corsair-agent",
      model: "gpt-5.1",
      instructions: `
You have access to Corsair tools.

Tool usage rules:

1. Use list_operations only to discover available operations.
2. Use get_schema only when you need the input/output schema of an operation.
3. Use run_script to execute Corsair operations.
4. Do not repeatedly call the same tool.
5. After receiving the requested data, return the final answer immediately.

IMPORTANT:

For get_schema always provide:

{
  "path": "<operation_path>"
}

Example:

{
  "path": "github.api.repositories.list"
}

For run_script always provide:

{
  "code": "<javascript>"
}

Example:

{
  "code": "return await corsair.github.api.repositories.list({ owner: 'kunalmadoliya' });"
}

Never use:

{
  "script": "..."
}

because run_script expects a field named "code".

Never use:

corsair.execute(...)

Instead use the operation paths directly, for example:

await corsair.github.api.repositories.list(...)
await corsair.github.api.repositories.star(...)
await corsair.github.api.issues.list(...)

Do not assume authentication is missing unless a tool explicitly returns an authentication error.

If a tool returns data successfully, stop calling tools and answer the user.
`,
      tools,
    });

    const result = await run(agent, message);

    console.log("✅ Result:");
    console.dir(result, {depth: null});

    return res.status(200).json({
      success: true,
      message: result.finalOutput,
    });
  } catch (error) {
    console.error("❌ Agent Error:", error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
});

app.get("/repos", async (_req: Request, res: Response) => {
  try {
    const repos = await corsair.github.api.repositories.list({
      owner: "kunalmadoliya",
    });

    return res.json({
      success: true,
      data: repos,
    });
  } catch (error) {
    console.error("❌ Repo Error:", error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port http://localhost:${PORT}`);
});
