import fs from "fs";
import path from "path";

export interface VersionInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  updateType: "major" | "minor" | "patch" | null;
  releaseUrl: string;
  releaseName?: string;
  releaseNotes?: string;
  publishedAt?: string | null;
  cached?: boolean;
}

class VersionService {
  private cache: VersionInfo | null = null;
  private cacheTime = 0;
  private readonly cacheTtlMs = 30 * 60 * 1000; // 30 minutos

  public getLocalVersion(): string {
    try {
      const pkgPath = path.resolve(process.cwd(), "package.json");
      if (fs.existsSync(pkgPath)) {
        const data = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        if (data?.version) return data.version.trim();
      }
    } catch (e) {
      console.warn("[VersionService] Error leyendo versión local:", e instanceof Error ? e.message : e);
    }
    return "0.1.0";
  }

  public compareVersions(current: string, latest: string): "major" | "minor" | "patch" | null {
    const clean = (v: string) => (v || "").replace(/^v/i, "").trim();
    const cParts = clean(current).split(".").map((n) => parseInt(n, 10) || 0);
    const lParts = clean(latest).split(".").map((n) => parseInt(n, 10) || 0);

    for (let i = 0; i < Math.max(cParts.length, lParts.length); i++) {
      const c = cParts[i] || 0;
      const l = lParts[i] || 0;
      if (l > c) {
        if (i === 0) return "major";
        if (i === 1) return "minor";
        return "patch";
      }
      if (c > l) {
        return null;
      }
    }
    return null;
  }

  public async checkUpdate(force = false): Promise<VersionInfo> {
    const now = Date.now();
    if (!force && this.cache && now - this.cacheTime < this.cacheTtlMs) {
      return { ...this.cache, cached: true };
    }

    const currentVersion = this.getLocalVersion();
    let latestVersion = currentVersion;
    let releaseUrl = "https://github.com/alebupal/GastroMap/releases";
    let releaseName = "";
    let releaseNotes = "";
    let publishedAt: string | null = null;

    try {
      // 1. Consulta la API de GitHub Releases
      const res = await fetch("https://api.github.com/repos/alebupal/GastroMap/releases/latest", {
        headers: {
          "User-Agent": "GastroMap-App/1.0",
          Accept: "application/vnd.github.v3+json",
        },
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.tag_name) {
          latestVersion = data.tag_name.replace(/^v/i, "").trim();
          releaseUrl = data.html_url || releaseUrl;
          releaseName = data.name || data.tag_name;
          releaseNotes = data.body || "";
          publishedAt = data.published_at || null;
        }
      } else {
        // 2. Fallback: raw package.json del repo
        const rawRes = await fetch(
          "https://raw.githubusercontent.com/alebupal/GastroMap/main/package.json",
          { signal: AbortSignal.timeout(4000) }
        );
        if (rawRes.ok) {
          const rawData = await rawRes.json();
          if (rawData?.version) {
            latestVersion = rawData.version.replace(/^v/i, "").trim();
          }
        }
      }
    } catch (err) {
      // Si no hay conexión o falla GitHub, continúa silenciosamente con la versión local
    }

    const updateType = this.compareVersions(currentVersion, latestVersion);
    const hasUpdate = Boolean(updateType);

    const result: VersionInfo = {
      currentVersion,
      latestVersion,
      hasUpdate,
      updateType,
      releaseUrl,
      releaseName,
      releaseNotes,
      publishedAt,
    };

    this.cache = result;
    this.cacheTime = now;

    return result;
  }
}

export const versionService = new VersionService();
