import * as cheerio from "cheerio";
import fs from "fs-extra";
import path from "path";
import { logAction } from "../db/sqlite";
import { resolvePath } from "../utils/path";

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function searchBing(
  query: string,
  maxResults: number
): Promise<WebSearchResult[]> {
  const url = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`;
  const resp = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(15000),
  });
  const html = await resp.text();
  const $ = cheerio.load(html);
  const results: WebSearchResult[] = [];

  $("li.b_algo").each((_, el) => {
    if (results.length >= maxResults) return false;
    const $el = $(el);
    const $h2 = $el.find("h2").first();
    const title = $h2.text().trim();
    const link = $h2.find("a").first().attr("href") || "";
    const snippet = $el.find("p, .b_caption p").first().text().trim();

    if (title && link && link.startsWith("http")) {
      results.push({ title, url: link, snippet: snippet.slice(0, 300) });
    }
  });

  return results;
}

export const webSearch = async (
  query: string,
  maxResults: number = 5
): Promise<string> => {
  try {
    const results = await searchBing(query, maxResults);

    if (results.length === 0) {
      return `未找到与"${query}"相关的搜索结果。`;
    }

    const output = results
      .map(
        (r, i) =>
          `[${i + 1}] ${r.title}\n    ${r.url}\n    ${r.snippet || "(无摘要)"}`
      )
      .join("\n\n");

    await logAction("webSearch", { query, resultCount: results.length });

    return `搜索"${query}"找到 ${results.length} 条结果:\n\n${output}`;
  } catch (error: any) {
    return `搜索失败: ${error?.message || error}`;
  }
};

export const webSearchAndSave = async (
  query: string,
  savePath: string,
  maxResults: number = 10,
  format: "txt" | "json" | "md" = "txt"
): Promise<string> => {
  try {
    const results = await searchBing(query, maxResults);

    if (results.length === 0) {
      return `未找到与"${query}"相关的搜索结果，无法保存。`;
    }

    let content: string;
    const absolutePath = resolvePath(savePath);

    switch (format) {
      case "json":
        content = JSON.stringify(
          { query, timestamp: new Date().toISOString(), results },
          null,
          2
        );
        break;
      case "md":
        content =
          `# 搜索结果: ${query}\n\n` +
          `> 搜索时间: ${new Date().toLocaleString()}\n\n` +
          results
            .map(
              (r, i) =>
                `## ${i + 1}. ${r.title}\n\n${r.snippet || ""}\n\n🔗 [链接](${r.url})\n`
            )
            .join("\n---\n\n");
        break;
      default:
        content =
          `搜索结果: ${query}\n${"=".repeat(50)}\n\n` +
          results
            .map(
              (r, i) =>
                `[${i + 1}] ${r.title}\n    ${r.url}\n    ${r.snippet || "(无摘要)"}`
            )
            .join("\n\n");
    }

    const dir = path.dirname(absolutePath);
    await fs.ensureDir(dir);
    await fs.writeFile(absolutePath, content, "utf-8");

    await logAction("webSearchAndSave", {
      query,
      savePath: absolutePath,
      resultCount: results.length,
      format,
    });

    return `搜索"${query}"找到 ${results.length} 条结果，已保存到 ${absolutePath}`;
  } catch (error: any) {
    return `搜索或保存失败: ${error?.message || error}`;
  }
};
