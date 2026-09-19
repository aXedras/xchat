import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { ProviderHealth } from "../compliance/types";
import {
  DocumentRenderer,
  RenderDocumentInput,
  RenderedDocument,
} from "./types";

const execFileAsync = promisify(execFile);

const PDF_MAGIC = "%PDF";

/**
 * Renders Typst templates by invoking the `typst` CLI as a subprocess.
 *
 * Security: user data never reaches a shell — the CLI is invoked with an
 * argument array (no shell interpolation), the render root is pinned to a
 * per-job temporary directory, and the input is passed as a JSON file that the
 * template reads explicitly.
 */
export class TypstDocumentRenderer implements DocumentRenderer {
  constructor(
    private readonly options: {
      typstBin: string;
      templatesDir: string;
      fontsDir?: string;
      timeoutMs?: number;
    },
  ) {}

  async render(input: RenderDocumentInput): Promise<RenderedDocument> {
    const workDir = await mkdtemp(join(tmpdir(), "xchat-render-"));

    try {
      const inputPath = join(workDir, "input.json");
      await writeFile(inputPath, JSON.stringify(input.input), "utf8");

      const templateName = `${input.documentType}.typ`;
      const templatePath = join(workDir, templateName);
      await copyFile(resolve(this.options.templatesDir, templateName), templatePath);

      const pdfPath = join(workDir, "output.pdf");

      const args = ["compile", "--root", workDir];
      if (this.options.fontsDir) {
        args.push("--font-path", resolve(this.options.fontsDir));
      }
      args.push(templatePath, pdfPath);

      await execFileAsync(this.options.typstBin, args, {
        timeout: this.options.timeoutMs ?? 30_000,
        maxBuffer: 16 * 1024 * 1024,
        shell: false,
      });

      const pdf = await readFile(pdfPath);
      if (pdf.length < 5 || pdf.subarray(0, 4).toString() !== PDF_MAGIC) {
        throw new Error("render produced an invalid PDF");
      }

      const sha256 = createHash("sha256").update(pdf).digest("hex");
      return {
        pdf: new Uint8Array(pdf),
        sha256,
        sizeBytes: pdf.length,
        mimeType: "application/pdf",
        templateId: input.templateId,
        templateVersion: input.templateVersion,
      };
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  async health(): Promise<ProviderHealth> {
    try {
      await execFileAsync(this.options.typstBin, ["--version"], {
        timeout: 5_000,
        shell: false,
      });
      return { ok: true, provider: "typst", latencyMs: 0 };
    } catch (error) {
      return {
        ok: false,
        provider: "typst",
        latencyMs: 0,
        message: error instanceof Error ? error.message : "typst unavailable",
      };
    }
  }
}
