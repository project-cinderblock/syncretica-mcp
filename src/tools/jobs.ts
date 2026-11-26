import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SyncreticaApiClient } from "../client/index.js";

export function registerJobTools(server: McpServer, client: SyncreticaApiClient): void {
  server.tool(
    "list_jobs",
    "List recent asynchronous background jobs (embedding calculations, LLM discoveries, synthesis reports).",
    {
      limit: z.number().int().min(1).max(50).optional().default(20).describe("Maximum number of recent jobs to return")
    },
    async ({ limit }) => {
      try {
        const jobs = await client.listJobs(limit);
        return {
          content: [{ type: "text", text: JSON.stringify(jobs, null, 2) }]
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to list jobs: ${err.message || String(err)}` }]
        };
      }
    }
  );

  server.tool(
    "get_job_status",
    "Check the status, progress, and result of an ActiveJob/Sidekiq background task.",
    {
      job_id: z.string().describe("ActiveJob UUID")
    },
    async ({ job_id }) => {
      try {
        const job = await client.getJob(job_id);
        return {
          content: [{ type: "text", text: JSON.stringify(job, null, 2) }]
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to get status for job ${job_id}: ${err.message || String(err)}` }]
        };
      }
    }
  );

  server.tool(
    "wait_for_job",
    "Poll a background job until completion or failure with configurable timeout.",
    {
      job_id: z.string().describe("ActiveJob UUID to wait for"),
      poll_interval_ms: z.number().int().min(500).max(30000).optional().default(2000).describe("Polling interval in milliseconds (default: 2000)"),
      timeout_ms: z.number().int().min(1000).max(1800000).optional().default(300000).describe("Maximum wait timeout in milliseconds (default: 300000 = 5 min, max: 30 min)")
    },
    async ({ job_id, poll_interval_ms, timeout_ms }) => {
      try {
        const job = await client.waitForJob(job_id, poll_interval_ms, timeout_ms);
        if (job.timed_out || job.is_running || job.status === "running" || job.status === "queued") {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                status: "still_running",
                job_id,
                job_status: job.status,
                progress: job.progress,
                message: `Job ${job_id} is still running in background (${job.status}). Do NOT retry or trigger duplicate tasks. You can continue waiting with wait_for_job(job_id='${job_id}').`
              }, null, 2)
            }]
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(job, null, 2) }]
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Job waiting failed: ${err.message || String(err)}` }]
        };
      }
    }
  );
}
