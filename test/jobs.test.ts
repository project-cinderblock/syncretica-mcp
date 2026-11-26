import { describe, it, expect, beforeEach, afterEach } from "vitest";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { SyncreticaApiClient } from "../src/client/index.js";

describe("Job polling (waitForJob)", () => {
  let mock: MockAdapter;
  let client: SyncreticaApiClient;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    client = new SyncreticaApiClient({
      apiUrl: "http://localhost:3000/api/v1",
      timeoutMs: 5000
    });
  });

  afterEach(() => {
    mock.restore();
  });

  it("polls job until status becomes completed", async () => {
    let callCount = 0;
    mock.onGet("http://localhost:3000/api/v1/jobs/test-job-1").reply(() => {
      callCount++;
      if (callCount === 1) {
        return [200, { data: { job_id: "test-job-1", status: "running", progress: { current: 1, total: 10 } } }];
      }
      return [200, { data: { job_id: "test-job-1", status: "completed", result: { success: true } } }];
    });

    const job = await client.waitForJob("test-job-1", 10, 1000);
    expect(job.status).toBe("completed");
    expect(callCount).toBe(2);
  });

  it("throws when job status is failed", async () => {
    mock.onGet("http://localhost:3000/api/v1/jobs/failed-job").reply(200, {
      data: {
        job_id: "failed-job",
        status: "failed",
        error: "Ollama connection refused"
      }
    });

    await expect(client.waitForJob("failed-job", 10, 500)).rejects.toThrow("Ollama connection refused");
  });

  it("returns still-running state if job times out while active", async () => {
    mock.onGet("http://localhost:3000/api/v1/jobs/slow-job").reply(200, {
      data: { job_id: "slow-job", status: "running" }
    });

    const job = await client.waitForJob("slow-job", 20, 50);
    expect(job.timed_out).toBe(true);
    expect(job.is_running).toBe(true);
    expect(job.status).toBe("running");
  });
});

describe("Cluster Report polling (waitForClusterReport)", () => {
  let mock: MockAdapter;
  let client: SyncreticaApiClient;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    client = new SyncreticaApiClient({
      apiUrl: "http://localhost:3000/api/v1",
      timeoutMs: 5000
    });
  });

  afterEach(() => {
    mock.restore();
  });

  it("polls cluster report until status is completed", async () => {
    let callCount = 0;
    mock.onGet("http://localhost:3000/api/v1/cluster_reports/8").reply(() => {
      callCount++;
      if (callCount === 1) {
        return [200, { data: { id: 8, status: "running", progress_percentage: 20 } }];
      }
      return [200, { data: { id: 8, status: "completed", progress_percentage: 100, content: "# Monograph" } }];
    });

    const report = await client.waitForClusterReport(8, 10, 1000);
    expect(report.status).toBe("completed");
    expect(report.content).toBe("# Monograph");
  });

  it("returns running state with timed_out if wait limit reached", async () => {
    mock.onGet("http://localhost:3000/api/v1/cluster_reports/8").reply(200, {
      data: { id: 8, status: "running", progress_percentage: 35, phase_description: "Analyzing cluster 40" }
    });

    const report = await client.waitForClusterReport(8, 10, 30);
    expect(report.timed_out).toBe(true);
    expect(report.is_running).toBe(true);
    expect(report.progress_percentage).toBe(35);
  });

  it("throws error when report fails", async () => {
    mock.onGet("http://localhost:3000/api/v1/cluster_reports/8").reply(200, {
      data: { id: 8, status: "failed", error_message: "LLM synthesis error" }
    });

    await expect(client.waitForClusterReport(8, 10, 500)).rejects.toThrow("LLM synthesis error");
  });
});
