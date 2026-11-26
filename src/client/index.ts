import axios, { AxiosInstance, AxiosError } from "axios";
import { ServerConfig } from "../config.js";
import {
  ApiResponse,
  PlatformStatus,
  PlatformSettings,
  Pantheon,
  God,
  Myth,
  LiveClusterResult,
  ClusterSnapshot,
  ClusterGroup,
  ClusterReport,
  ClusterReportSummary,
  ClusterSubReport,
  JobStatus
} from "./types.js";

export class SyncreticaApiError extends Error {
  public code: string;
  public status?: number;
  public details?: string[];

  constructor(message: string, code = "api_error", status?: number, details?: string[]) {
    super(message);
    this.name = "SyncreticaApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class SyncreticaApiClient {
  private http: AxiosInstance;
  public readonly apiUrl: string;

  constructor(config: ServerConfig) {
    this.apiUrl = config.apiUrl;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json"
    };

    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    this.http = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeoutMs,
      headers
    });
  }

  private handleError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const axiosErr = error as AxiosError<{ error?: { code?: string; message?: string; details?: string[] } }>;
      const status = axiosErr.response?.status;
      const errorPayload = axiosErr.response?.data?.error;

      if (errorPayload) {
        throw new SyncreticaApiError(
          errorPayload.message || axiosErr.message,
          errorPayload.code || "api_error",
          status,
          errorPayload.details
        );
      }

      throw new SyncreticaApiError(
        axiosErr.message,
        status ? `http_${status}` : "network_error",
        status
      );
    }

    if (error instanceof Error) {
      throw new SyncreticaApiError(error.message);
    }

    throw new SyncreticaApiError(String(error));
  }

  // System & Status
  async getStatus(): Promise<PlatformStatus> {
    try {
      const res = await this.http.get<ApiResponse<PlatformStatus>>("/status");
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getOpenApiSpec(): Promise<Record<string, unknown>> {
    try {
      const res = await this.http.get<Record<string, unknown>>("/openapi.json");
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getSettings(): Promise<PlatformSettings> {
    try {
      const res = await this.http.get<ApiResponse<PlatformSettings>>("/settings");
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async updateContextWindow(contextWindow: number): Promise<PlatformSettings> {
    try {
      const res = await this.http.patch<ApiResponse<PlatformSettings>>("/settings/context_window", {
        context_window: contextWindow
      });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async generateBulkEmbeddings(modelType: "God" | "Myth", onlyMissing = true): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>("/settings/generate_embeddings", {
        model_type: modelType,
        only_missing: onlyMissing
      });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Global Search
  async search(params: {
    q: string;
    mode?: "semantic" | "keyword" | "auto";
    target_type?: "all" | "god" | "myth";
    limit?: number;
  }): Promise<ApiResponse<unknown>> {
    try {
      const res = await this.http.get<ApiResponse<unknown>>("/search", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Pantheons
  async listPantheons(params?: {
    q?: string;
    include_gods?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<Pantheon[]>> {
    try {
      const res = await this.http.get<ApiResponse<Pantheon[]>>("/pantheons", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getPantheon(id: number, params?: { include_gods?: boolean }): Promise<Pantheon> {
    try {
      const res = await this.http.get<ApiResponse<Pantheon>>(`/pantheons/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async createPantheon(pantheon: { name: string; description?: string }): Promise<Pantheon> {
    try {
      const res = await this.http.post<ApiResponse<Pantheon>>("/pantheons", { pantheon });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async updatePantheon(id: number, pantheon: { name?: string; description?: string }): Promise<Pantheon> {
    try {
      const res = await this.http.patch<ApiResponse<Pantheon>>(`/pantheons/${id}`, { pantheon });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deletePantheon(id: number): Promise<{ message: string }> {
    try {
      const res = await this.http.delete<ApiResponse<{ message: string }>>(`/pantheons/${id}`);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async upsertPantheonsBatch(pantheons: Array<{ name: string; description?: string }>): Promise<{ upserted_count: number }> {
    try {
      const res = await this.http.post<ApiResponse<{ upserted_count: number }>>("/pantheons/upsert_batch", {
        pantheons
      });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async populatePantheons(sync = false): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>("/pantheons/populate", {}, {
        params: { sync }
      });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async populatePantheonGods(pantheonId: number, sync = true): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>(`/pantheons/${pantheonId}/populate_gods`, {}, {
        params: { sync }
      });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Gods
  async listGods(params?: {
    pantheon_id?: number;
    pantheon?: string;
    theme?: string;
    q?: string;
    embedded?: boolean;
    include_myth?: boolean;
    include_embedding?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<God[]>> {
    try {
      const res = await this.http.get<ApiResponse<God[]>>("/gods", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getGod(id: number, params?: { include_embedding?: boolean; include_myth?: boolean }): Promise<God> {
    try {
      const res = await this.http.get<ApiResponse<God>>(`/gods/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async createGod(god: {
    pantheon_id: number;
    name: string;
    description?: string;
    themes?: string[];
  }): Promise<God> {
    try {
      const res = await this.http.post<ApiResponse<God>>("/gods", { god });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async updateGod(id: number, god: {
    name?: string;
    description?: string;
    themes?: string[];
    pantheon_id?: number;
  }): Promise<God> {
    try {
      const res = await this.http.patch<ApiResponse<God>>(`/gods/${id}`, { god });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deleteGod(id: number): Promise<{ message: string }> {
    try {
      const res = await this.http.delete<ApiResponse<{ message: string }>>(`/gods/${id}`);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async upsertGodsBatch(pantheonId: number, gods: Array<{
    name: string;
    description?: string;
    themes?: string[];
  }>): Promise<{ upserted_count: number }> {
    try {
      const res = await this.http.post<ApiResponse<{ upserted_count: number }>>("/gods/upsert_batch", {
        pantheon_id: pantheonId,
        gods
      });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getGodNeighbors(id: number, params?: { limit?: number; pantheon_id?: number; include_embedding?: boolean }): Promise<God[]> {
    try {
      const res = await this.http.get<ApiResponse<God[]>>(`/gods/${id}/neighbors`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async generateGodEmbedding(id: number, sync = true): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>(`/gods/${id}/generate_embedding`, {}, {
        params: { sync }
      });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async populateGodMyth(id: number, sync = true): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>(`/gods/${id}/populate_myth`, {}, {
        params: { sync }
      });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async populateGods(pantheonId?: number, sync = false): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>("/gods/populate", {}, {
        params: { pantheon_id: pantheonId, sync }
      });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Myths
  async listMyths(params?: {
    god_id?: number;
    pantheon_id?: number;
    theme?: string;
    q?: string;
    include_embedding?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<Myth[]>> {
    try {
      const res = await this.http.get<ApiResponse<Myth[]>>("/myths", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getMyth(id: number, params?: { include_embedding?: boolean }): Promise<Myth> {
    try {
      const res = await this.http.get<ApiResponse<Myth>>(`/myths/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async createMyth(myth: { god_id: number; themes: Record<string, string> }): Promise<Myth> {
    try {
      const res = await this.http.post<ApiResponse<Myth>>("/myths", { myth });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async updateMyth(id: number, myth: { themes: Record<string, string> }): Promise<Myth> {
    try {
      const res = await this.http.patch<ApiResponse<Myth>>(`/myths/${id}`, { myth });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deleteMyth(id: number): Promise<{ message: string }> {
    try {
      const res = await this.http.delete<ApiResponse<{ message: string }>>(`/myths/${id}`);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getMythNeighbors(id: number, params?: { limit?: number; include_embedding?: boolean }): Promise<Myth[]> {
    try {
      const res = await this.http.get<ApiResponse<Myth[]>>(`/myths/${id}/neighbors`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async generateMythEmbedding(id: number, sync = true): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>(`/myths/${id}/generate_embedding`, {}, {
        params: { sync }
      });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async populateMyths(godId?: number, sync = false): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>("/myths/populate", {}, {
        params: { god_id: godId, sync }
      });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Clusters & Snapshots
  async computeClusters(params?: {
    target_type?: "God" | "Myth";
    level?: number;
    full_coverage?: boolean;
    force?: boolean;
  }): Promise<LiveClusterResult> {
    try {
      const res = await this.http.get<ApiResponse<LiveClusterResult>>("/clusters", { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async createClusterSnapshot(data: {
    target_type: "God" | "Myth";
    level: number;
    full_coverage?: boolean;
    title: string;
  }): Promise<ClusterSnapshot> {
    try {
      const res = await this.http.post<ApiResponse<ClusterSnapshot>>("/clusters/snapshot", data);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async listClusterSnapshots(params?: {
    target_type?: "God" | "Myth";
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<ClusterSnapshot[]>> {
    try {
      const res = await this.http.get<ApiResponse<ClusterSnapshot[]>>("/cluster_snapshots", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getClusterSnapshot(id: number, params?: {
    include_groups?: boolean;
    include_members?: boolean;
    include_reports?: boolean;
  }): Promise<ClusterSnapshot> {
    try {
      const res = await this.http.get<ApiResponse<ClusterSnapshot>>(`/cluster_snapshots/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deleteClusterSnapshot(id: number): Promise<{ message: string }> {
    try {
      const res = await this.http.delete<ApiResponse<{ message: string }>>(`/cluster_snapshots/${id}`);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getClusterGroup(id: number, params?: { include_members?: boolean }): Promise<ClusterGroup> {
    try {
      const res = await this.http.get<ApiResponse<ClusterGroup>>(`/cluster_groups/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Synthesis Reports
  async listClusterReports(params?: {
    cluster_snapshot_id?: number;
    target_type?: "God" | "Myth";
    status?: string;
    is_detailed?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<ClusterReport[]>> {
    try {
      const res = await this.http.get<ApiResponse<ClusterReport[]>>("/cluster_reports", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getClusterReport(id: number, params?: {
    include_summaries?: boolean;
    include_sub_reports?: boolean;
  }): Promise<ClusterReport> {
    try {
      const res = await this.http.get<ApiResponse<ClusterReport>>(`/cluster_reports/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async createClusterReport(data: {
    cluster_snapshot_id: number;
    prompt: string;
  }): Promise<ClusterReport> {
    try {
      const res = await this.http.post<ApiResponse<ClusterReport>>("/cluster_reports", data);
      const report = res.data.data;
      if (res.data.meta && (res.data.meta as Record<string, unknown>).job_id) {
        report.job_id = (res.data.meta as Record<string, unknown>).job_id as string;
      }
      return report;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deepSynthesis(reportId: number, data?: { batch_size?: number }): Promise<ClusterReport> {
    try {
      const res = await this.http.post<ApiResponse<ClusterReport>>(`/cluster_reports/${reportId}/deep_synthesis`, data || {});
      const report = res.data.data;
      if (res.data.meta && (res.data.meta as Record<string, unknown>).job_id) {
        report.job_id = (res.data.meta as Record<string, unknown>).job_id as string;
      }
      return report;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async waitForClusterReport(
    id: number,
    pollIntervalMs = 5000,
    timeoutMs = 600000
  ): Promise<ClusterReport> {
    const startTime = Date.now();
    let lastReport: ClusterReport | null = null;
    while (Date.now() - startTime < timeoutMs) {
      const report = await this.getClusterReport(id, {
        include_summaries: false,
        include_sub_reports: false
      });
      lastReport = report;
      if (report.status === "completed") {
        return await this.getClusterReport(id, {
          include_summaries: false,
          include_sub_reports: true
        });
      }
      if (report.status === "failed") {
        throw new SyncreticaApiError(
          report.error_message || `Cluster report ${id} failed`,
          "report_failed"
        );
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    if (lastReport && (lastReport.status === "running" || lastReport.status === "queued")) {
      return {
        ...lastReport,
        timed_out: true,
        is_running: true
      };
    }
    throw new SyncreticaApiError(
      `Cluster report ${id} timed out after ${timeoutMs}ms while waiting for completion`,
      "report_timeout"
    );
  }

  async getClusterReportSummary(id: number): Promise<ClusterReportSummary> {
    try {
      const res = await this.http.get<ApiResponse<ClusterReportSummary>>(`/cluster_report_summaries/${id}`);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getClusterSubReport(id: number): Promise<ClusterSubReport> {
    try {
      const res = await this.http.get<ApiResponse<ClusterSubReport>>(`/cluster_sub_reports/${id}`);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Jobs
  async listJobs(limit = 20): Promise<JobStatus[]> {
    try {
      const res = await this.http.get<ApiResponse<JobStatus[]>>("/jobs", { params: { limit } });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getJob(jobId: string): Promise<JobStatus> {
    try {
      const res = await this.http.get<ApiResponse<JobStatus>>(`/jobs/${jobId}`);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async waitForJob(jobId: string, pollIntervalMs = 2000, timeoutMs = 60000): Promise<JobStatus> {
    const startTime = Date.now();
    let lastJob: JobStatus | null = null;
    while (Date.now() - startTime < timeoutMs) {
      const job = await this.getJob(jobId);
      lastJob = job;
      if (job.status === "completed") {
        return job;
      }
      if (job.status === "failed") {
        throw new SyncreticaApiError(
          job.error || job.message || `Job ${jobId} failed`,
          "job_failed"
        );
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    if (lastJob && (lastJob.status === "running" || lastJob.status === "queued")) {
      return {
        ...lastJob,
        timed_out: true,
        is_running: true,
        message: `Job ${jobId} is still ${lastJob.status} in the background after ${timeoutMs}ms. Do NOT retry or duplicate.`
      };
    }
    throw new SyncreticaApiError(
      `Job ${jobId} timed out after ${timeoutMs}ms while waiting for completion`,
      "job_timeout"
    );
  }
}
