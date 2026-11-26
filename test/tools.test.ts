import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { SyncreticaApiClient } from "../src/client/index.js";
import { registerAllTools } from "../src/tools/index.js";
import { registerResources } from "../src/resources/index.js";
import { registerPrompts } from "../src/prompts/index.js";

describe("MCP Server Tool Execution", () => {
  let mock: MockAdapter;
  let server: McpServer;
  let client: SyncreticaApiClient;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    server = new McpServer(
      { name: "syncretica-test", version: "1.0.0" },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );
    client = new SyncreticaApiClient({
      apiUrl: "http://localhost:3000/api/v1",
      timeoutMs: 5000
    });
    registerAllTools(server, client);
    registerResources(server, client);
    registerPrompts(server);
  });

  afterEach(() => {
    mock.restore();
  });

  it("registers all expected tools across all domains", () => {
    const registeredToolNames = Object.keys((server as any)._registeredTools);
    
    const expectedTools = [
      // Search
      "search",
      "find_counterparts",
      // Pantheons
      "list_pantheons",
      "get_pantheon",
      "create_pantheon",
      "update_pantheon",
      "delete_pantheon",
      "upsert_pantheons_batch",
      "populate_pantheons",
      "populate_pantheon_gods",
      // Gods
      "list_gods",
      "get_god",
      "create_god",
      "update_god",
      "delete_god",
      "upsert_gods_batch",
      "generate_god_embedding",
      "populate_god_myth",
      "populate_gods_bulk",
      // Myths
      "list_myths",
      "get_myth",
      "create_myth",
      "update_myth",
      "delete_myth",
      "generate_myth_embedding",
      "populate_myths_bulk",
      // Clusters & Snapshots
      "compute_clusters",
      "create_cluster_snapshot",
      "list_cluster_snapshots",
      "get_cluster_snapshot",
      "delete_cluster_snapshot",
      "get_cluster_group",
      // Reports
      "list_cluster_reports",
      "get_cluster_report",
      "create_cluster_report",
      "generate_deep_synthesis",
      "wait_for_cluster_report",
      "get_report_summary",
      "get_report_sub_report",
      // Jobs
      "list_jobs",
      "get_job_status",
      "wait_for_job",
      // System
      "get_platform_status",
      "get_settings",
      "update_context_window",
      "trigger_bulk_embeddings",
      "get_openapi_spec"
    ];

    for (const tool of expectedTools) {
      expect(registeredToolNames).toContain(tool);
    }
    expect(registeredToolNames.length).toBe(expectedTools.length);
  });

  it("executes the search tool handler successfully", async () => {
    const searchTool = (server as any)._registeredTools["search"];
    expect(searchTool).toBeDefined();

    mock.onGet("http://localhost:3000/api/v1/search").reply(200, {
      data: [{ id: 1, type: "God", name: "Anubis" }]
    });

    const result = await searchTool.handler({ q: "jackal", mode: "auto", target_type: "all", limit: 10 });
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toContain("Anubis");
  });

  it("executes the get_god tool handler and handles errors", async () => {
    const getGodTool = (server as any)._registeredTools["get_god"];
    expect(getGodTool).toBeDefined();

    mock.onGet("http://localhost:3000/api/v1/gods/42").reply(200, {
      data: { id: 42, name: "Horus", themes: ["sky", "kingship"] }
    });

    const result = await getGodTool.handler({ id: 42, include_myth: true, include_embedding: false });
    expect(result.content[0].text).toContain("Horus");

    // Test error case
    mock.onGet("http://localhost:3000/api/v1/gods/999").reply(404, {
      error: { code: "not_found", message: "God not found" }
    });

    const errorResult = await getGodTool.handler({ id: 999, include_myth: true, include_embedding: false });
    expect(errorResult.isError).toBe(true);
    expect(errorResult.content[0].text).toContain("God not found");
  });

  it("registers resources correctly", () => {
    const registeredResources = (server as any)._registeredResources;
    const registeredTemplates = (server as any)._registeredResourceTemplates;

    expect(registeredResources["syncretica://status"]).toBeDefined();
    expect(registeredResources["syncretica://pantheons"]).toBeDefined();
    expect(Object.keys(registeredTemplates)).toHaveLength(2);
  });

  it("registers prompts correctly", () => {
    const registeredPrompts = (server as any)._registeredPrompts;
    expect(registeredPrompts["comparative_archetype_analysis"]).toBeDefined();
    expect(registeredPrompts["cross_cultural_synthesis"]).toBeDefined();

    const promptObj = registeredPrompts["comparative_archetype_analysis"];
    const generated = promptObj.callback({ deity_a: "Zeus", deity_b: "Indra" });
    expect(generated.messages[0].content.text).toContain("Zeus");
    expect(generated.messages[0].content.text).toContain("Indra");
  });
});
