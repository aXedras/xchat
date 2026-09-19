import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { TypstDocumentRenderer } from "../../src/services/integrations/documents/typstDocumentRenderer";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TYPST_BIN = process.env.TYPST_BIN ?? "typst";
const TEMPLATES_DIR =
  process.env.TYPST_TEMPLATES_DIR ?? "./templates";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 1000);
const BUCKET = process.env.DOCUMENT_BUCKET ?? "trade-documents";

const TRANSIENT_ERRORS = new Set([
  "render_failed",
  "storage_upload_failed",
  "typst_unavailable",
]);

function classifyError(error: unknown): {
  code: string;
  transient: boolean;
} {
  const message = error instanceof Error ? error.message : String(error);
  if (/ENOENT|typst unavailable|command not found/i.test(message)) {
    return { code: "typst_unavailable", transient: true };
  }
  if (/template.*not found|no such file|EACCES/i.test(message)) {
    return { code: "template_error", transient: false };
  }
  if (/invalid.*pdf|magic bytes/i.test(message)) {
    return { code: "render_validation_failed", transient: false };
  }
  if (/storage.*upload|bucket/i.test(message)) {
    return { code: "storage_upload_failed", transient: true };
  }
  return { code: "render_failed", transient: true };
}

function requireClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

function storagePath(documentId: string): string {
  // The document_versions table keeps the per-version SHA-256/metadata; the
  // storage object is keyed by document id and overwritten on re-render.
  return `deal/${documentId}/document.pdf`;
}

async function processOne(
  client: SupabaseClient,
  renderer: TypstDocumentRenderer,
): Promise<boolean> {
  const { data: job, error } = await client.rpc("claim_document_generation_job");
  if (error) {
    console.error("claim failed", error.message);
    return false;
  }
  if (!job) {
    return false;
  }

  const jobId = job.id as string;
  const documentId = job.documentId as string;
  const snapshot = (job.inputSnapshot ?? {}) as Record<string, unknown>;

  try {
    const rendered = await renderer.render({
      documentType: (snapshot.documentType as "rfq_summary") ?? "trade_confirmation",
      templateId: "default",
      templateVersion: "1",
      locale: "en",
      timezone: "UTC",
      schemaVersion: 1,
      input: snapshot,
    });

    const { error: uploadError } = await client.storage
      .from(BUCKET)
      .upload(storagePath(documentId), rendered.pdf, {
        contentType: "application/pdf",
      });
    if (uploadError) {
      throw new Error(`storage_upload_failed: ${uploadError.message}`);
    }

    await client.rpc("complete_document_generation_job", {
      p_job_id: jobId,
      p_storage_path: storagePath(documentId),
      p_sha256: rendered.sha256,
      p_mime_type: rendered.mimeType,
      p_size_bytes: rendered.sizeBytes,
      p_template_id: rendered.templateId,
      p_template_version: rendered.templateVersion,
    });

    console.log("completed job", jobId);
    return true;
  } catch (error) {
    const { code, transient } = classifyError(error);
    await client.rpc("fail_document_generation_job", {
      p_job_id: jobId,
      p_error_code: transient ? code : "permanent",
    });
    console.error("failed job", jobId, code);
    return true;
  }
}

async function main() {
  const client = requireClient();
  const renderer = new TypstDocumentRenderer({
    typstBin: TYPST_BIN,
    templatesDir: TEMPLATES_DIR,
  });

  const health = await renderer.health();
  if (!health.ok) {
    console.error("typst is not available:", health.message);
    process.exit(1);
  }

  console.log("document worker started");
  for (;;) {
    const processed = await processOne(client, renderer);
    if (!processed) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

void main();
